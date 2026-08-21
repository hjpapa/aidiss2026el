import { NextResponse } from "next/server";

import { getSessionTokenMode, verifySessionToken } from "@/lib/session-token";
import { sessionTokenMatches } from "@/lib/supabase-server";

export function apiError(code: string, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status });
}
export function rejectOversizedRequest(request: Request, maxBytes = 80_000): NextResponse | null {
  const length = Number(request.headers.get("content-length") ?? 0);
  return length > maxBytes ? apiError("body_too_large", "요청 내용이 너무 깁니다.", 413) : null;
}

export async function authorizeSession(
  sessionId: string,
  token: string,
): Promise<{ authorized: boolean; mode: "stored" | "local_only" | null }> {
  if (!verifySessionToken(token, sessionId)) return { authorized: false, mode: null };
  const mode = getSessionTokenMode(token);
  if (mode === "stored" && !(await sessionTokenMatches(sessionId, token))) {
    return { authorized: false, mode };
  }
  return { authorized: true, mode };
}
