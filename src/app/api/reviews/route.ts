import { NextResponse } from "next/server";

import { apiError, authorizeSession, rejectOversizedRequest } from "@/lib/api-utils";
import { generateReview, moderateText } from "@/lib/openai";
import { hasVerifiedReadiness, isValidEvidence } from "@/lib/readiness";
import { ReviewRequestSchema } from "@/lib/schemas";
import { checkForPii, safetyMessageFor } from "@/lib/safety";
import { hashIdentifier, verifyStateProof } from "@/lib/session-token";
import {
  claimGeneration,
  consumeRateLimit,
  loadStoredMessagesByIds,
  loadStoredReview,
  markGenerationFailed,
  persistReview,
} from "@/lib/supabase-server";
import type { ReviewResult } from "@/types/debate";

export const runtime = "nodejs";
export const maxDuration = 60;

function storedReviewResponse(
  replay: { reviewId: string; review: ReviewResult; fingerprint: string },
  fingerprint: string,
) {
  if (replay.fingerprint !== fingerprint) {
    return apiError(
      "request_id_reused",
      "같은 요청 번호에 다른 성찰 초안이 사용되었어요. 초안을 고쳐 다시 시도해 주세요.",
      409,
    );
  }
  return NextResponse.json({
    ok: true,
    review: replay.review,
    reviewId: replay.reviewId,
    persistence: "stored",
  });
}

export async function POST(request: Request) {
  const oversized = rejectOversizedRequest(request, 120_000);
  if (oversized) return oversized;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError("invalid_json", "요청 형식을 확인해 주세요.", 400);
  }
  const parsed = ReviewRequestSchema.safeParse(json);
  if (!parsed.success) return apiError("invalid_review", "성찰 초안과 토론 근거를 확인해 주세요.", 400);
  const body = parsed.data;

  const auth = await authorizeSession(body.sessionId, body.token);
  if (!auth.authorized) return apiError("invalid_session", "세션이 만료되었거나 올바르지 않습니다.", 401);
  if (!verifyStateProof(body.stateProof, body.sessionId, body.setup, body.state, body.stateVersion)) {
    return apiError("invalid_state", "토론 진행 상태를 확인할 수 없어요. 토론 화면에서 다시 시도해 주세요.", 409);
  }

  let evidenceMessages = body.evidenceMessages;
  if (auth.mode === "stored") {
    try {
      const canonical = await loadStoredMessagesByIds(
        body.sessionId,
        body.evidenceMessages.map((message) => message.id),
      );
      if (!canonical) throw new Error("Stored evidence was unavailable.");
      evidenceMessages = canonical;
    } catch {
      return apiError("persistence_unavailable", "토론 근거를 안전하게 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.", 503);
    }
  }
  if (!hasVerifiedReadiness(body.state, evidenceMessages)) {
    return apiError("not_ready", "다섯 생각 발자국을 실제 토론 근거로 모두 채운 뒤 성찰할 수 있어요.", 409);
  }

  const draftText = [
    body.draft.myThinking,
    body.draft.hardestCounterpoint,
    body.draft.technicalUnderstanding,
  ].join("\n");
  const pii = checkForPii(draftText);
  if (!pii.safe) {
    return apiError(
      "personal_information",
      pii.message ?? "개인정보를 빼고 다시 작성해 주세요.",
      422,
    );
  }

  const requestFingerprint = hashIdentifier(
    JSON.stringify({
      sessionId: body.sessionId,
      requestId: body.requestId,
      setup: body.setup,
      state: body.state,
      stateVersion: body.stateVersion,
      evidenceMessages,
      draft: body.draft,
    }),
  );

  if (auth.mode === "stored") {
    try {
      const replay = await loadStoredReview(body.sessionId, body.requestId);
      if (replay) return storedReviewResponse(replay, requestFingerprint);
    } catch {
      return apiError("persistence_unavailable", "중복 검토 여부를 안전하게 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.", 503);
    }
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    const rates = await Promise.all([
      consumeRateLimit("session", `review:${body.sessionId}`, 3),
      consumeRateLimit("ip", `review:${forwarded}`, 10),
    ]);
    const blocked = rates.find((rate) => !rate.allowed);
    if (blocked) {
      return apiError("rate_limited", "AI 검토를 너무 빠르게 요청하고 있어요. 잠시 뒤 다시 시도해 주세요.", 429, {
        retryAfter: blocked.retryAfter,
      });
    }
  } catch {
    return apiError("rate_limit_unavailable", "안전한 요청 속도를 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.", 503);
  }

  let inputModeration: Awaited<ReturnType<typeof moderateText>>;
  try {
    inputModeration = await moderateText(draftText);
  } catch {
    return apiError("moderation_unavailable", "안전 확인을 잠시 할 수 없어요. 조금 뒤 다시 시도해 주세요.", 503);
  }
  if (inputModeration.flagged) {
    return apiError("unsafe_content", safetyMessageFor(inputModeration.categories, draftText), 422);
  }

  let claimToken: string | undefined;
  if (auth.mode === "stored") {
    try {
      const claim = await claimGeneration({
        sessionId: body.sessionId,
        requestId: body.requestId,
        purpose: "review",
        expectedStateVersion: body.stateVersion,
        fingerprint: requestFingerprint,
        modelName: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      });
      if (!claim.configured) {
        return apiError("persistence_unavailable", "저장소 연결을 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.", 503);
      }
      if (claim.disposition === "conflict") {
        return apiError(
          "request_id_reused",
          "같은 요청 번호에 다른 성찰 초안이 사용되었어요. 초안을 고쳐 다시 시도해 주세요.",
          409,
        );
      }
      if (claim.disposition === "state_conflict") {
        return apiError("state_conflict", "토론 내용이 달라졌어요. 최신 토론에서 성찰을 다시 시작해 주세요.", 409);
      }
      if (claim.disposition === "completed") {
        const replay = await loadStoredReview(body.sessionId, body.requestId);
        if (replay) return storedReviewResponse(replay, requestFingerprint);
        return apiError("generation_in_progress", "같은 AI 검토를 이미 만들고 있어요. 잠시 뒤 다시 눌러 주세요.", 409);
      }
      if (claim.disposition === "in_progress") {
        return apiError("generation_in_progress", "같은 AI 검토를 이미 만들고 있어요. 잠시 뒤 다시 눌러 주세요.", 409);
      }
      claimToken = claim.claimToken;
    } catch {
      return apiError("persistence_unavailable", "AI 검토 요청을 안전하게 예약할 수 없어요. 잠시 뒤 다시 시도해 주세요.", 503);
    }
  }

  const failClaim = async (errorCode: string) => {
    if (auth.mode !== "stored" || !claimToken) return;
    await markGenerationFailed({
      sessionId: body.sessionId,
      requestId: body.requestId,
      purpose: "review",
      fingerprint: requestFingerprint,
      claimToken,
      errorCode,
    }).catch(() => undefined);
  };

  try {
    const generated = await generateReview({
      setup: body.setup,
      state: body.state,
      messages: evidenceMessages,
      draft: body.draft,
      safetyIdentifier: hashIdentifier(body.sessionId).slice(0, 64),
    });
    const invalidEvidence = generated.result.learnerSaid.some(
      (item) =>
        item.evidence.length === 0 ||
        item.evidence.some((evidence) => !isValidEvidence(evidence, evidenceMessages)),
    );
    const validLearnerIds = new Set(
      evidenceMessages
        .filter((message) => message.role === "learner" && message.kind === "move")
        .map((message) => message.id),
    );
    const invalidInference = generated.result.systemInferred.some((item) =>
      item.basedOnMessageIds.some((id) => !validLearnerIds.has(id)),
    );
    const analysisSignals = [
      ...generated.result.ethicsAnalysis.principleSignals,
      ...generated.result.ethicsAnalysis.sensitivitySignals,
    ];
    const invalidAnalysisEvidence = analysisSignals.some((item) => {
      if (item.level === "next") return item.evidence.length > 0;
      return (
        item.evidence.length === 0 ||
        item.evidence.some((evidence) => !isValidEvidence(evidence, evidenceMessages))
      );
    });
    const principleIds = new Set(
      generated.result.ethicsAnalysis.principleSignals.map((item) => item.id),
    );
    const sensitivityIds = new Set(
      generated.result.ethicsAnalysis.sensitivitySignals.map((item) => item.id),
    );
    const invalidAnalysisShape =
      principleIds.size !== 3 ||
      !(["human_dignity", "social_good", "technical_purpose"] as const).every((id) => principleIds.has(id)) ||
      sensitivityIds.size !== 4 ||
      !(["situation", "consequence", "empathy", "responsibility"] as const).every((id) => sensitivityIds.has(id));
    if (invalidEvidence || invalidInference || invalidAnalysisEvidence || invalidAnalysisShape) {
      await failClaim("invalid_evidence");
      return apiError("invalid_evidence", "AI 검토의 근거를 확인하지 못했어요. 다시 생성해 주세요.", 502);
    }

    const moderation = await moderateText(JSON.stringify(generated.result));
    if (moderation.flagged) {
      await failClaim("unsafe_review");
      return apiError("unsafe_review", "안전한 검토를 만들지 못했어요. 다시 시도해 주세요.", 502);
    }

    let persistence: { stored: boolean; reviewId?: string; replayed: boolean } = {
      stored: false,
      replayed: false,
    };
    if (auth.mode === "stored") {
      try {
        persistence = await persistReview({
          sessionId: body.sessionId,
          requestId: body.requestId,
          expectedStateVersion: body.stateVersion,
          requestFingerprint,
          claimToken,
          review: generated.result,
          state: body.state,
          draft: body.draft,
          meta: generated.meta,
        });
      } catch {
        await failClaim("persistence_failed");
        return apiError("persistence_unavailable", "AI 검토를 안전하게 저장하지 못했어요. 초안은 남아 있으니 다시 시도해 주세요.", 503);
      }
    }
    if (persistence.replayed) {
      try {
        const replay = await loadStoredReview(body.sessionId, body.requestId);
        if (!replay) throw new Error("Canonical review was not found.");
        return storedReviewResponse(replay, requestFingerprint);
      } catch {
        return apiError("persistence_unavailable", "저장된 AI 검토를 안전하게 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.", 503);
      }
    }
    if (auth.mode === "stored" && !persistence.stored) {
      await failClaim("state_conflict");
      return apiError("state_conflict", "토론 내용이 달라졌어요. 최신 토론에서 성찰을 다시 시작해 주세요.", 409);
    }

    return NextResponse.json({
      ok: true,
      review: generated.result,
      reviewId: persistence.reviewId,
      persistence: persistence.stored ? "stored" : "local_only",
    });
  } catch (error) {
    await failClaim(error instanceof Error ? error.name.slice(0, 120) : "review_failed");
    console.error("review_generation_failed", {
      sessionHash: hashIdentifier(body.sessionId).slice(0, 12),
      error: error instanceof Error ? error.name : "unknown",
    });
    return apiError("review_failed", "AI 검토를 만들지 못했어요. 초안은 남아 있으니 다시 시도해 주세요.", 502);
  }
}
