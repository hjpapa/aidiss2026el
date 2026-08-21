import { NextResponse } from "next/server";

import { apiError, authorizeSession, rejectOversizedRequest } from "@/lib/api-utils";
import { ReflectionRequestSchema } from "@/lib/schemas";
import { hashIdentifier } from "@/lib/session-token";
import { persistReflection } from "@/lib/supabase-server";

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
  const requestFingerprint = hashIdentifier(
    JSON.stringify({
      sessionId: body.sessionId,
      requestId: body.requestId,
      reviewId: body.reviewId ?? null,
      draft: body.draft,
      final: body.final,
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
