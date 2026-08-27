import { NextResponse } from "next/server";

import { apiError, authorizeSession, rejectOversizedRequest } from "@/lib/api-utils";
import { moderateText } from "@/lib/openai";
import { ReflectionRequestSchema } from "@/lib/schemas";
import { checkForPii, safetyMessageFor } from "@/lib/safety";
import { hashIdentifier } from "@/lib/session-token";
import { consumeRateLimit, persistReflection } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const oversized = rejectOversizedRequest(request, 100_000);
  if (oversized) return oversized;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError("invalid_json", "요청 형식을 확인해 주세요.", 400);
  }
  const parsed = ReflectionRequestSchema.safeParse(json);
  if (!parsed.success) return apiError("invalid_reflection", "최종 성찰 내용을 확인해 주세요.", 400);
  const body = parsed.data;
  const auth = await authorizeSession(body.sessionId, body.token);
  if (!auth.authorized) return apiError("invalid_session", "세션이 만료되었거나 올바르지 않습니다.", 401);
  if (auth.mode === "stored" && !body.reviewId) {
    return apiError("review_missing", "저장된 AI 검토를 찾을 수 없어요. 검토를 다시 받아 주세요.", 409);
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    const rates = await Promise.all([
      consumeRateLimit("session", `reflection:${body.sessionId}`, 5),
      consumeRateLimit("ip", `reflection:${forwarded}`, 20),
    ]);
    const blocked = rates.find((rate) => !rate.allowed);
    if (blocked) {
      return apiError("rate_limited", "최종 성찰을 너무 빠르게 요청하고 있어요. 잠시 뒤 다시 시도해 주세요.", 429, {
        retryAfter: blocked.retryAfter,
      });
    }
  } catch {
    return apiError("rate_limit_unavailable", "안전한 요청 속도를 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.", 503);
  }

  const reflectionText = [
    body.draft.myThinking,
    body.draft.hardestCounterpoint,
    body.draft.technicalUnderstanding,
    body.final.myThinking,
    body.final.hardestCounterpoint,
    body.final.technicalUnderstanding,
  ].join("\n");
  const pii = checkForPii(reflectionText);
  if (!pii.safe) {
    return apiError(
      "personal_information",
      pii.message ?? "개인정보를 빼고 다시 작성해 주세요.",
      422,
    );
  }
  let moderation: Awaited<ReturnType<typeof moderateText>>;
  try {
    moderation = await moderateText(reflectionText);
  } catch {
    return apiError(
      "moderation_unavailable",
      "안전 확인을 잠시 할 수 없어요. 조금 뒤 다시 시도해 주세요.",
      503,
    );
  }
  if (moderation.flagged) {
    return apiError("unsafe_content", safetyMessageFor(moderation.categories, reflectionText), 422);
  }
  const requestFingerprint = hashIdentifier(
    JSON.stringify({
      sessionId: body.sessionId,
      requestId: body.requestId,
      reviewId: body.reviewId ?? null,
      draft: body.draft,
      final: body.final,
      shareWithCommunity: body.shareWithCommunity,
    }),
  );
  if (auth.mode === "local_only") {
    return NextResponse.json({ ok: true, persistence: "local_only" });
  }
  let stored = false;
  try {
    stored = await persistReflection({
      sessionId: body.sessionId,
      requestId: body.requestId,
      reviewId: body.reviewId,
      requestFingerprint,
      draft: body.draft,
      final: body.final,
      shareWithCommunity: body.shareWithCommunity,
    });
  } catch {
    if (auth.mode === "stored") {
      return apiError("persistence_unavailable", "최종 성찰을 안전하게 저장하지 못했어요. 작성한 내용은 남아 있으니 다시 시도해 주세요.", 503);
    }
  }
  if (auth.mode === "stored" && !stored) {
    return apiError("state_conflict", "토론이나 AI 검토 내용이 달라졌어요. 최신 상태에서 성찰을 다시 확인해 주세요.", 409);
  }
  return NextResponse.json({ ok: true, persistence: stored ? "stored" : "local_only" });
}
