import { NextResponse } from "next/server";

import { apiError, authorizeSession, rejectOversizedRequest } from "@/lib/api-utils";
import { moderateText, generateChatTurn } from "@/lib/openai";
import { sanitizeDebateState } from "@/lib/readiness";
import { engagementGuidance } from "@/lib/debate-engagement";
import { ChatRequestSchema } from "@/lib/schemas";
import { checkForPii, guidanceFor, safetyMessageFor } from "@/lib/safety";
import { hashIdentifier, issueStateProof, verifyStateProof } from "@/lib/session-token";
import {
  claimGeneration,
  consumeRateLimit,
  loadRecentMessages,
  loadStoredChatTurn,
  markGenerationFailed,
  persistChatTurn,
  type StoredChatTurn,
} from "@/lib/supabase-server";
import type { DebateMessage, SessionSetup } from "@/types/debate";

export const runtime = "nodejs";
export const maxDuration = 60;

function message(args: Omit<DebateMessage, "id" | "createdAt">): DebateMessage {
  return { ...args, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
}

function storedTurnResponse(
  replay: StoredChatTurn,
  args: { sessionId: string; setup: SessionSetup; message: string; fingerprint: string },
) {
  const acceptedLearnerMessage = replay.messages.find((item) => item.role === "learner");
  const opponentMessage =
    replay.messages.find((item) => item.role === "opponent_pet" || item.role === "system") ??
    replay.messages.find((item) => item.role === "ally_pet");
  if (
    replay.fingerprint !== args.fingerprint ||
    !acceptedLearnerMessage ||
    !opponentMessage ||
    acceptedLearnerMessage.content !== args.message
  ) {
    return apiError("request_id_reused", "같은 요청 번호에 다른 내용이 사용되었어요. 입력을 바꿔 다시 보내 주세요.", 409);
  }
  const allyHint = replay.messages.find(
    (item) => item.role === "ally_pet" && item.id !== opponentMessage.id,
  );
  return NextResponse.json({
    ok: true,
    acceptedLearnerMessage,
    opponentMessage,
    allyHint,
    state: replay.state,
    stateVersion: replay.stateVersion,
    stateProof: issueStateProof(args.sessionId, args.setup, replay.state, replay.stateVersion),
    persistence: "stored",
  });
}

export async function POST(request: Request) {
  const oversized = rejectOversizedRequest(request);
  if (oversized) return oversized;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError("invalid_json", "요청 형식을 확인해 주세요.", 400);
  }
  const parsed = ChatRequestSchema.safeParse(json);
  if (!parsed.success) return apiError("invalid_chat", "메시지와 토론 상태를 다시 확인해 주세요.", 400);
  const body = parsed.data;

  const auth = await authorizeSession(body.sessionId, body.token);
  if (!auth.authorized) return apiError("invalid_session", "세션이 만료되었거나 올바르지 않습니다.", 401);
  if (!verifyStateProof(body.stateProof, body.sessionId, body.setup, body.state, body.stateVersion)) {
    return apiError("invalid_state", "토론 진행 상태를 확인할 수 없어요. 화면을 새로 열어 다시 시도해 주세요.", 409);
  }

  const requestFingerprint = hashIdentifier(
    JSON.stringify({
      sessionId: body.sessionId,
      requestId: body.requestId,
      message: body.message,
      setup: body.setup,
      state: body.state,
      stateVersion: body.stateVersion,
    }),
  );
  if (auth.mode === "stored") {
    try {
      const replay = await loadStoredChatTurn(body.sessionId, body.requestId);
      if (replay) {
        return storedTurnResponse(replay, {
          sessionId: body.sessionId,
          setup: body.setup,
          message: body.message,
          fingerprint: requestFingerprint,
        });
      }
    } catch {
      return apiError("persistence_unavailable", "중복 요청 여부를 안전하게 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.", 503);
    }
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  let rates: Awaited<ReturnType<typeof consumeRateLimit>>[];
  try {
    rates = await Promise.all([
      consumeRateLimit("session", body.sessionId, 12),
      consumeRateLimit("ip", forwarded, 30),
    ]);
  } catch {
    return apiError("rate_limit_unavailable", "안전한 요청 속도를 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.", 503);
  }
  const blockedRate = rates.find((rate) => !rate.allowed);
  if (blockedRate) {
    return apiError("rate_limited", "조금 천천히 이야기해 주세요. 잠시 뒤 다시 보낼 수 있어요.", 429, {
      retryAfter: blockedRate.retryAfter,
    });
  }

  const pii = checkForPii(body.message);
  if (!pii.safe) return apiError("personal_information", pii.message ?? "개인정보를 빼고 다시 작성해 주세요.", 422);

  let inputModeration: Awaited<ReturnType<typeof moderateText>>;
  try {
    inputModeration = await moderateText(body.message);
  } catch {
    return apiError("moderation_unavailable", "안전 확인을 잠시 할 수 없어요. 조금 뒤 다시 시도해 주세요.", 503);
  }
  if (inputModeration.flagged) {
    return apiError("unsafe_content", safetyMessageFor(inputModeration.categories, body.message), 422);
  }

  let claimToken: string | undefined;
  if (auth.mode === "stored") {
    try {
      const claim = await claimGeneration({
        sessionId: body.sessionId,
        requestId: body.requestId,
        purpose: "chat",
        expectedStateVersion: body.stateVersion,
        fingerprint: requestFingerprint,
        modelName: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      });
      if (!claim.configured) {
        return apiError("persistence_unavailable", "저장소 연결을 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.", 503);
      }
      if (claim.disposition === "conflict") {
        return apiError("request_id_reused", "같은 요청 번호에 다른 내용이 사용되었어요. 입력을 바꿔 다시 보내 주세요.", 409);
      }
      if (claim.disposition === "state_conflict") {
        return apiError("state_conflict", "다른 창에서 토론이 먼저 이어졌어요. 이 화면을 새로 열어 최신 상태를 확인해 주세요.", 409);
      }
      if (claim.disposition === "completed") {
        const replay = await loadStoredChatTurn(body.sessionId, body.requestId);
        if (replay) {
          return storedTurnResponse(replay, {
            sessionId: body.sessionId,
            setup: body.setup,
            message: body.message,
            fingerprint: requestFingerprint,
          });
        }
        return apiError("generation_in_progress", "같은 답변을 이미 처리하고 있어요. 잠시 뒤 다시 눌러 주세요.", 409);
      }
      if (claim.disposition === "in_progress") {
        return apiError("generation_in_progress", "같은 답변을 이미 처리하고 있어요. 잠시 뒤 다시 눌러 주세요.", 409);
      }
      claimToken = claim.claimToken;
    } catch {
      return apiError("persistence_unavailable", "요청을 안전하게 예약할 수 없어요. 잠시 뒤 다시 시도해 주세요.", 503);
    }
  }

  const failClaim = async (errorCode: string) => {
    if (auth.mode !== "stored" || !claimToken) return;
    await markGenerationFailed({
      sessionId: body.sessionId,
      requestId: body.requestId,
      purpose: "chat",
      fingerprint: requestFingerprint,
      claimToken,
      errorCode,
    }).catch(() => undefined);
  };
  const replayStoredTurn = async () => {
    try {
      const replay = await loadStoredChatTurn(body.sessionId, body.requestId);
      if (!replay) throw new Error("Canonical chat turn was not found.");
      return storedTurnResponse(replay, {
        sessionId: body.sessionId,
        setup: body.setup,
        message: body.message,
        fingerprint: requestFingerprint,
      });
    } catch {
      return apiError("persistence_unavailable", "저장된 토론 답변을 안전하게 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.", 503);
    }
  };

  const safetyGuidance = guidanceFor(body.message);
  let recentMessages = body.recentMessages;
  if (!safetyGuidance && auth.mode === "stored") {
    try {
      recentMessages = (await loadRecentMessages(body.sessionId, 16)) ?? [];
    } catch {
      await failClaim("context_load_failed");
      return apiError("persistence_unavailable", "최근 토론 내용을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.", 503);
    }
  }
  const learnerGuidance = safetyGuidance ?? engagementGuidance(body.message, recentMessages);
  if (learnerGuidance) {
    const learnerMessage = message({
      requestId: body.requestId,
      role: "learner",
      kind: "guidance",
      content: body.message,
    });
    const guidanceMessage = message({
      requestId: body.requestId,
      role: "opponent_pet",
      kind: "guidance",
      content: learnerGuidance,
      replyToMessageId: learnerMessage.id,
    });
    let persistence = { stored: false, nextStateVersion: body.stateVersion + 1, replayed: false };
    if (auth.mode === "stored") {
      try {
        persistence = await persistChatTurn({
          sessionId: body.sessionId,
          requestId: body.requestId,
          messages: [learnerMessage, guidanceMessage],
          state: body.state,
          expectedStateVersion: body.stateVersion,
          requestFingerprint,
          claimToken,
        });
      } catch {
        await failClaim("persistence_failed");
        return apiError("persistence_unavailable", "토론 기록을 안전하게 저장하지 못했어요. 입력은 남아 있으니 다시 시도해 주세요.", 503);
      }
    }
    if (persistence.replayed) return replayStoredTurn();
    if (auth.mode === "stored" && !persistence.stored) {
      await failClaim("state_conflict");
      return apiError("state_conflict", "다른 창에서 토론이 먼저 이어졌어요. 화면을 새로 열어 최신 상태를 확인해 주세요.", 409);
    }
    const nextStateVersion = persistence.stored ? persistence.nextStateVersion : body.stateVersion + 1;
    return NextResponse.json({
      ok: true,
      acceptedLearnerMessage: learnerMessage,
      opponentMessage: guidanceMessage,
      state: body.state,
      stateVersion: nextStateVersion,
      stateProof: issueStateProof(body.sessionId, body.setup, body.state, nextStateVersion),
      persistence: persistence.stored ? "stored" : "local_only",
    });
  }

  const latestOpponent = [...recentMessages]
    .reverse()
    .find((candidate) => candidate.role === "opponent_pet" && candidate.kind === "move");
  const learnerMessage = message({
    requestId: body.requestId,
    role: "learner",
    kind: "move",
    content: body.message,
    replyToMessageId: latestOpponent?.id,
  });
  const contextMessages = [...recentMessages, learnerMessage].slice(-16);

  try {
    const generated = await generateChatTurn({
      setup: body.setup,
      state: body.state,
      messages: contextMessages,
      safetyIdentifier: hashIdentifier(body.sessionId).slice(0, 64),
    });

    const outputModeration = await moderateText(`${generated.result.opponentReply}\n${generated.result.allyHint}`);
    if (outputModeration.flagged) {
      const safetyMessage = message({
        requestId: body.requestId,
        role: "system",
        kind: "safety",
        content: "안전하게 답을 만들지 못했어요. 원래 문장은 저장하지 않았습니다. 다른 표현으로 다시 질문해 주세요.",
        replyToMessageId: learnerMessage.id,
      });
      let persistence = { stored: false, nextStateVersion: body.stateVersion + 1, replayed: false };
      if (auth.mode === "stored") {
        try {
          persistence = await persistChatTurn({
            sessionId: body.sessionId,
            requestId: body.requestId,
            messages: [learnerMessage, safetyMessage],
            state: body.state,
            expectedStateVersion: body.stateVersion,
            requestFingerprint,
            claimToken,
            meta: generated.meta,
            errorCode: "output_moderation",
          });
        } catch {
          await failClaim("persistence_failed");
          return apiError("persistence_unavailable", "안전 안내를 저장하지 못했어요. 입력은 남아 있으니 다시 시도해 주세요.", 503);
        }
      }
      if (persistence.replayed) return replayStoredTurn();
      if (auth.mode === "stored" && !persistence.stored) {
        await failClaim("state_conflict");
        return apiError("state_conflict", "다른 창에서 토론이 먼저 이어졌어요. 화면을 새로 열어 최신 상태를 확인해 주세요.", 409);
      }
      const nextStateVersion = persistence.stored ? persistence.nextStateVersion : body.stateVersion + 1;
      return NextResponse.json({
        ok: true,
        acceptedLearnerMessage: learnerMessage,
        opponentMessage: safetyMessage,
        state: body.state,
        stateVersion: nextStateVersion,
        stateProof: issueStateProof(body.sessionId, body.setup, body.state, nextStateVersion),
        persistence: persistence.stored ? "stored" : "local_only",
      });
    }

    const substantive = generated.result.engagement === "substantive";
    if (!substantive) learnerMessage.kind = "guidance";
    const state = substantive
      ? sanitizeDebateState(body.state, generated.result.state, contextMessages, learnerMessage.id)
      : body.state;
    const opponentMessage = message({
      requestId: body.requestId,
      role: "opponent_pet",
      kind: substantive ? "move" : "guidance",
      content: generated.result.opponentReply,
      replyToMessageId: learnerMessage.id,
    });
    const allyHint = generated.result.allyHint.trim()
      ? message({
          requestId: body.requestId,
          role: "ally_pet",
          kind: "guidance",
          content: generated.result.allyHint,
          replyToMessageId: learnerMessage.id,
        })
      : undefined;
    const messages = [learnerMessage, opponentMessage, ...(allyHint ? [allyHint] : [])];
    let persistence = { stored: false, nextStateVersion: body.stateVersion + 1, replayed: false };
    if (auth.mode === "stored") {
      try {
        persistence = await persistChatTurn({
          sessionId: body.sessionId,
          requestId: body.requestId,
          messages,
          state,
          expectedStateVersion: body.stateVersion,
          requestFingerprint,
          claimToken,
          meta: generated.meta,
        });
      } catch {
        await failClaim("persistence_failed");
        return apiError("persistence_unavailable", "토론 기록을 안전하게 저장하지 못했어요. 입력은 남아 있으니 다시 시도해 주세요.", 503);
      }
    }
    if (persistence.replayed) return replayStoredTurn();
    if (auth.mode === "stored" && !persistence.stored) {
      await failClaim("state_conflict");
      return apiError("state_conflict", "다른 창에서 토론이 먼저 이어졌어요. 화면을 새로 열어 최신 상태를 확인해 주세요.", 409);
    }
    const nextStateVersion = persistence.stored ? persistence.nextStateVersion : body.stateVersion + 1;

    return NextResponse.json({
      ok: true,
      acceptedLearnerMessage: learnerMessage,
      opponentMessage,
      allyHint,
      state,
      stateVersion: nextStateVersion,
      stateProof: issueStateProof(body.sessionId, body.setup, state, nextStateVersion),
      persistence: persistence.stored ? "stored" : "local_only",
    });
  } catch (error) {
    await failClaim(error instanceof Error ? error.name.slice(0, 120) : "generation_failed");
    console.error("chat_generation_failed", {
      sessionHash: hashIdentifier(body.sessionId).slice(0, 12),
      error: error instanceof Error ? error.name : "unknown",
    });
    return apiError("generation_failed", "상대 펫이 잠시 생각을 이어 가지 못했어요. 입력은 남아 있으니 다시 시도해 주세요.", 502);
  }
}
