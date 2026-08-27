import { NextResponse } from "next/server";

import { apiError, authorizeSession } from "@/lib/api-utils";
import { localOnlyCommunityInsights } from "@/lib/community-insights";
import {
  consumeRateLimit,
  isStoredSessionCompleted,
  loadCommunityInsights,
} from "@/lib/supabase-server";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const auth = await authorizeSession(id, token);
  if (!auth.authorized) {
    return apiError("invalid_session", "친구들의 생각을 볼 권한을 확인할 수 없어요.", 401);
  }
  if (auth.mode === "local_only") {
    return NextResponse.json(
      { ok: true, insights: localOnlyCommunityInsights() },
      { headers: PRIVATE_HEADERS },
    );
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    const rates = await Promise.all([
      consumeRateLimit("session", `insights:${id}`, 8),
      consumeRateLimit("ip", `insights:${forwarded}`, 20),
    ]);
    const blocked = rates.find((rate) => !rate.allowed);
    if (blocked) {
      return apiError("rate_limited", "조금 뒤에 친구들의 생각을 다시 확인해 주세요.", 429, {
        retryAfter: blocked.retryAfter,
      });
    }
  } catch {
    return apiError("rate_limit_unavailable", "안전한 조회 속도를 확인하지 못했어요.", 503);
  }

  try {
    if (!(await isStoredSessionCompleted(id))) {
      return apiError("debate_not_completed", "토론과 성찰을 마친 뒤 볼 수 있어요.", 409);
    }
  } catch {
    return apiError(
      "persistence_unavailable",
      "완료된 토론인지 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
      503,
    );
  }

  try {
    const insights = await loadCommunityInsights(id);
    if (!insights) throw new Error("Community insights are not configured.");
    return NextResponse.json({ ok: true, insights }, { headers: PRIVATE_HEADERS });
  } catch {
    return apiError(
      "persistence_unavailable",
      "친구들의 생각을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.",
      503,
    );
  }
}
