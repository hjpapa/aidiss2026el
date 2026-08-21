"use client";

import type {
  ChatTurnResult,
  DebateMessage,
  DebateState,
  ReflectionDraft,
  ReviewResult,
  SessionSetup,
} from "@/types/debate";

export class AppApiError extends Error {
  constructor(
    message: string,
    public readonly code = "unknown",
    public readonly status = 500,
  ) {
    super(message);
    this.name = "AppApiError";
  }
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new AppApiError(
      typeof json.message === "string" ? json.message : "요청을 처리하지 못했어요.",
      typeof json.code === "string" ? json.code : "request_failed",
      response.status,
    );
  }
  return json as T;
}

export function createSession(setup: SessionSetup) {
  return requestJson<{
    ok: true;
    sessionId: string;
    token: string;
    createdAt: string;
    expiresAt: string;
    state: DebateState;
    stateVersion: number;
    stateProof: string;
    persistence: "stored" | "local_only";
  }>("/api/sessions", { method: "POST", body: JSON.stringify({ setup }) });
}

export function sendChat(args: {
  sessionId: string;
  token: string;
  requestId: string;
  message: string;
  setup: SessionSetup;
  state: DebateState;
  stateVersion: number;
  stateProof: string;
  recentMessages: DebateMessage[];
}) {
  return requestJson<{ ok: true } & ChatTurnResult>("/api/chat", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export function createReview(args: {
  sessionId: string;
  token: string;
  requestId: string;
  setup: SessionSetup;
  state: DebateState;
  stateVersion: number;
  stateProof: string;
  evidenceMessages: DebateMessage[];
  draft: ReflectionDraft;
}) {
  return requestJson<{
    ok: true;
    review: ReviewResult;
    reviewId?: string;
    persistence: "stored" | "local_only";
  }>("/api/reviews", { method: "POST", body: JSON.stringify(args) });
}

export function submitReflection(args: {
  sessionId: string;
    token: string;
    requestId: string;
    reviewId?: string;
    draft: ReflectionDraft;
    final: ReflectionDraft;
}) {
  return requestJson<{ ok: true; persistence: "stored" | "local_only" }>("/api/reflections", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function removeServerSession(sessionId: string, token: string): Promise<void> {
  await requestJson(`/api/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
}
