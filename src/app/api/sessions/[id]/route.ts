import { NextResponse } from "next/server";

import { apiError, authorizeSession } from "@/lib/api-utils";
import { deleteSession } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const auth = await authorizeSession(id, token);
  if (!auth.authorized) return apiError("invalid_session", "삭제 권한을 확인할 수 없습니다.", 401);
  const deleted = auth.mode === "stored" ? await deleteSession(id).catch(() => false) : true;
  if (!deleted) return apiError("delete_failed", "서버 기록을 삭제하지 못했어요. 다시 시도해 주세요.", 503);
  return NextResponse.json({ ok: true });
}
