import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-utils";
import { purgeExpired } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return apiError("unauthorized", "Unauthorized", 401);
  }
  const totals = { deletedSessions: 0, deletedBuckets: 0 };
  for (let batch = 0; batch < 10; batch += 1) {
    const result = await purgeExpired(500);
    if (!result.configured) {
      return apiError("persistence_unavailable", "Supabase persistence is not configured.", 503);
    }
    totals.deletedSessions += result.deletedSessions;
    totals.deletedBuckets += result.deletedBuckets;
    if (result.deletedSessions < 500 && result.deletedBuckets < 500) break;
  }
  return NextResponse.json({ ok: true, ...totals });
}
