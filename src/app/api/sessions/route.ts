import { NextResponse } from "next/server";

import { apiError, rejectOversizedRequest } from "@/lib/api-utils";
import { SessionRequestSchema } from "@/lib/schemas";
import { issueSessionToken, issueStateProof } from "@/lib/session-token";
import { consumeRateLimit, persistSession } from "@/lib/supabase-server";
import { createEmptyDebateState } from "@/types/debate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const oversized = rejectOversizedRequest(request, 20_000);
  if (oversized) return oversized;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError("invalid_json", "요청 형식을 확인해 주세요.", 400);
  }
  const parsed = SessionRequestSchema.safeParse(json);
  if (!parsed.success) return apiError("invalid_setup", "토론 준비 정보를 다시 확인해 주세요.", 400);

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    const rate = await consumeRateLimit("ip", forwarded, 6);
    if (!rate.allowed) {
      return apiError("rate_limited", "새 토론을 너무 빠르게 만들고 있어요. 잠시 뒤 다시 시도해 주세요.", 429, {
        retryAfter: rate.retryAfter,
      });
    }
  } catch {
    return apiError("rate_limit_unavailable", "안전한 요청 속도를 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요.", 503);
  }

  const sessionId = crypto.randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 29 * 24 * 60 * 60 * 1000).toISOString();
  const state = createEmptyDebateState();
  const storedToken = issueSessionToken(sessionId, expiresAt, "stored");
  const stored = await persistSession({
    id: sessionId,
    token: storedToken,
    expiresAt,
    setup: parsed.data.setup,
    state,
  }).catch(() => false);
  const token = stored ? storedToken : issueSessionToken(sessionId, expiresAt, "local_only");

  return NextResponse.json({
    ok: true,
    sessionId,
    token,
    createdAt: createdAt.toISOString(),
    expiresAt,
    state,
    stateVersion: 0,
    stateProof: issueStateProof(sessionId, parsed.data.setup, state, 0),
    persistence: stored ? "stored" : "local_only",
  });
}
