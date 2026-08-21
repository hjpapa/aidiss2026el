import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { CHAT_PROMPT_VERSION, REVIEW_PROMPT_VERSION } from "@/lib/prompts";
import { hashCapability, hashIdentifier } from "@/lib/session-token";
import type { GenerationMeta } from "@/lib/openai";
import type {
  DebateMessage,
  DebateState,
  ReflectionDraft,
  ReviewResult,
  SessionSetup,
} from "@/types/debate";

const APP_VERSION = "0.1.0";
let adminClient: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    adminClient = null;
    return null;
  }
  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return adminClient;
}

export async function persistSession(args: {
  id: string;
  token: string;
  expiresAt: string;
  setup: SessionSetup;
  state: DebateState;
}): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db.from("aidiss_sessions").insert({
    id: args.id,
    capability_token_hash: hashCapability(args.token),
    expires_at: args.expiresAt,
    grade_band: args.setup.gradeBand,
    learner_pet_id: args.setup.learnerPetId,
    opponent_pet_id: args.setup.opponentPetId,
    topic_id: args.setup.topicId,
    initial_stance: args.setup.initialStance,
    status: "active",
    debate_summary: args.state.summary,
    debate_state: args.state,
    prompt_version: CHAT_PROMPT_VERSION,
    app_version: APP_VERSION,
  });
  return !error;
}

export async function sessionTokenMatches(sessionId: string, token: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return true;
  const { data, error } = await db
    .from("aidiss_sessions")
    .select("capability_token_hash,expires_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data) return false;
  return data.capability_token_hash === hashCapability(token) && new Date(data.expires_at).getTime() > Date.now();
}

export type GenerationPurpose = "chat" | "review";
export type GenerationDisposition = "claimed" | "completed" | "in_progress" | "conflict" | "state_conflict";

export async function claimGeneration(args: {
  sessionId: string;
  requestId: string;
  purpose: GenerationPurpose;
  expectedStateVersion: number;
  fingerprint: string;
  modelName: string;
}): Promise<{ configured: boolean; disposition: GenerationDisposition; claimToken?: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { configured: false, disposition: "claimed" };
  const { data, error } = await db.rpc("aidiss_claim_generation", {
    p_session_id: args.sessionId,
    p_request_id: args.requestId,
    p_purpose: args.purpose,
    p_expected_state_version: args.expectedStateVersion,
    p_fingerprint: args.fingerprint,
    p_model_name: args.modelName,
    p_prompt_version: args.purpose === "chat" ? CHAT_PROMPT_VERSION : REVIEW_PROMPT_VERSION,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const disposition = row?.disposition as GenerationDisposition;
  const claimToken = typeof row?.claim_token === "string" ? row.claim_token : undefined;
  if (disposition === "claimed" && !claimToken) {
    throw new Error("Generation claim did not return a fencing token.");
  }
  return { configured: true, disposition, claimToken };
}

export async function markGenerationFailed(args: {
  sessionId: string;
  requestId: string;
  purpose: GenerationPurpose;
  fingerprint: string;
  claimToken: string;
  errorCode: string;
}): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const { error } = await db
    .from("aidiss_ai_generations")
    .update({
      status: "failed",
      claim_token: null,
      lease_expires_at: null,
      error_code: args.errorCode,
      completed_at: new Date().toISOString(),
    })
    .eq("session_id", args.sessionId)
    .eq("request_id", args.requestId)
    .eq("purpose", args.purpose)
    .eq("request_fingerprint", args.fingerprint)
    .eq("status", "processing")
    .eq("claim_token", args.claimToken);
  if (error) throw error;
}

export interface StoredChatTurn {
  messages: DebateMessage[];
  state: DebateState;
  stateVersion: number;
  fingerprint: string;
}

function mapMessageRow(row: Record<string, unknown>): DebateMessage {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    role: row.role as DebateMessage["role"],
    kind: row.kind as DebateMessage["kind"],
    content: String(row.content),
    createdAt: String(row.created_at),
    ...(row.reply_to_message_id ? { replyToMessageId: String(row.reply_to_message_id) } : {}),
  };
}

export async function loadRecentMessages(sessionId: string, limit = 16): Promise<DebateMessage[] | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("aidiss_messages")
    .select("id,request_id,role,kind,content,reply_to_message_id,created_at")
    .eq("session_id", sessionId)
    .order("sequence_no", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse().map((row) => mapMessageRow(row));
}

export async function loadStoredMessagesByIds(
  sessionId: string,
  messageIds: string[],
): Promise<DebateMessage[] | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const uniqueIds = [...new Set(messageIds)];
  if (uniqueIds.length === 0) return [];
  const { data, error } = await db
    .from("aidiss_messages")
    .select("id,request_id,role,kind,content,reply_to_message_id,created_at")
    .eq("session_id", sessionId)
    .in("id", uniqueIds)
    .order("sequence_no", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapMessageRow(row));
}

export async function loadStoredChatTurn(sessionId: string, requestId: string): Promise<StoredChatTurn | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data: rows, error: messagesError } = await db
    .from("aidiss_messages")
    .select("id,request_id,role,kind,content,reply_to_message_id,created_at")
    .eq("session_id", sessionId)
    .eq("request_id", requestId)
    .order("sequence_no", { ascending: true });
  if (messagesError) throw messagesError;
  if (!rows?.length) return null;
  const { data: generation, error: generationError } = await db
    .from("aidiss_ai_generations")
    .select("request_fingerprint,result_state,result_state_version")
    .eq("session_id", sessionId)
    .eq("request_id", requestId)
    .eq("purpose", "chat")
    .eq("status", "completed")
    .maybeSingle();
  if (generationError) throw generationError;
  if (!generation?.result_state || generation.result_state_version === null) {
    throw new Error("Stored chat turn has no canonical result state.");
  }
  return {
    messages: rows.map((row) => mapMessageRow(row)),
    state: generation.result_state as DebateState,
    stateVersion: Number(generation.result_state_version),
    fingerprint: String(generation.request_fingerprint),
  };
}

export async function loadStoredReview(
  sessionId: string,
  requestId: string,
): Promise<{ reviewId: string; review: ReviewResult; fingerprint: string } | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data: review, error: reviewError } = await db
    .from("aidiss_reviews")
    .select("id,review_json,generation_id")
    .eq("session_id", sessionId)
    .eq("request_id", requestId)
    .maybeSingle();
  if (reviewError) throw reviewError;
  if (!review) return null;
  const { data: generation, error: generationError } = await db
    .from("aidiss_ai_generations")
    .select("request_fingerprint")
    .eq("id", review.generation_id)
    .single();
  if (generationError) throw generationError;
  return {
    reviewId: String(review.id),
    review: review.review_json as ReviewResult,
    fingerprint: String(generation.request_fingerprint),
  };
}

export async function persistChatTurn(args: {
  sessionId: string;
  requestId: string;
  expectedStateVersion: number;
  requestFingerprint: string;
  claimToken?: string;
  messages: DebateMessage[];
  state: DebateState;
  meta?: GenerationMeta;
  errorCode?: string;
}): Promise<{ stored: boolean; nextStateVersion: number; replayed: boolean }> {
  const db = getSupabaseAdmin();
  if (!db) {
    return { stored: false, nextStateVersion: args.expectedStateVersion + 1, replayed: false };
  }
  if (!args.claimToken) throw new Error("A generation claim token is required for stored chat turns.");
  const readinessByMessage = new Map<string, string[]>();
  for (const criterion of args.state.readiness) {
    for (const evidence of criterion.evidence) {
      readinessByMessage.set(evidence.messageId, [
        ...(readinessByMessage.get(evidence.messageId) ?? []),
        criterion.id,
      ]);
    }
  }

  const ready = args.state.readiness.every((item) => item.completed);
  const { data, error } = await db.rpc("aidiss_persist_chat_turn", {
    p_session_id: args.sessionId,
    p_request_id: args.requestId,
    p_expected_state_version: args.expectedStateVersion,
    p_messages: args.messages.map((message) => ({
      id: message.id,
      role: message.role,
      kind: message.kind,
      content: message.content,
      replyToMessageId: message.replyToMessageId ?? null,
      readinessTags: readinessByMessage.get(message.id) ?? [],
      createdAt: message.createdAt,
    })),
    p_state: args.state,
    p_summary: args.state.summary,
    p_status: ready ? "ready" : "active",
    p_generation: {
      fingerprint: args.requestFingerprint,
      // A moderated model output still has a canonical, safely stored system reply.
      // Reserve "failed" for attempts that did not commit a chat turn.
      status: "completed",
      modelName: args.meta?.model ?? "local-guidance",
      responseId: args.meta?.responseId ?? null,
      inputTokens: args.meta?.inputTokens ?? 0,
      outputTokens: args.meta?.outputTokens ?? 0,
      latencyMs: args.meta?.latencyMs ?? 0,
      errorCode: args.errorCode ?? null,
    },
    p_claim_token: args.claimToken,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    stored: Boolean(row?.stored),
    nextStateVersion: Number(row?.next_state_version ?? args.expectedStateVersion),
    replayed: Boolean(row?.replayed),
  };
}

export async function persistReview(args: {
  sessionId: string;
  requestId: string;
  expectedStateVersion: number;
  requestFingerprint: string;
  claimToken?: string;
  review: ReviewResult;
  state: DebateState;
  draft: ReflectionDraft;
  meta: GenerationMeta;
}): Promise<{ stored: boolean; reviewId?: string; replayed: boolean }> {
  const db = getSupabaseAdmin();
  if (!db) return { stored: false, replayed: false };
  if (!args.claimToken) throw new Error("A generation claim token is required for stored reviews.");
  const evidence = args.review.learnerSaid.flatMap((item) => item.evidence);
  const { data, error } = await db.rpc("aidiss_persist_review", {
    p_session_id: args.sessionId,
    p_request_id: args.requestId,
    p_expected_state_version: args.expectedStateVersion,
    p_fingerprint: args.requestFingerprint,
    p_review: args.review,
    p_evidence: evidence,
    p_readiness: args.state.readiness,
    p_draft: args.draft,
    p_generation: {
      modelName: args.meta.model,
      responseId: args.meta.responseId,
      inputTokens: args.meta.inputTokens,
      outputTokens: args.meta.outputTokens,
      latencyMs: args.meta.latencyMs,
    },
    p_claim_token: args.claimToken,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.stored
    ? { stored: true, reviewId: String(row.review_id), replayed: Boolean(row.replayed) }
    : { stored: false, replayed: false };
}

export async function persistReflection(args: {
  sessionId: string;
  requestId: string;
  reviewId?: string;
  requestFingerprint: string;
  draft: ReflectionDraft;
  final: ReflectionDraft;
}): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  if (!args.reviewId) return false;
  const { data, error } = await db.rpc("aidiss_complete_reflection", {
    p_session_id: args.sessionId,
    p_review_id: args.reviewId,
    p_request_id: args.requestId,
    p_final_fingerprint: args.requestFingerprint,
    p_draft: args.draft,
    p_final: args.final,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return Boolean(row?.stored);
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db.from("aidiss_sessions").delete().eq("id", sessionId);
  return !error;
}

const memoryLimits = new Map<string, { window: number; count: number }>();

export async function consumeRateLimit(
  scope: "ip" | "session",
  key: string,
  limit = 12,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const keyHash = hashIdentifier(`${scope}:${key}`);
  const db = getSupabaseAdmin();
  if (db) {
    const { data, error } = await db.rpc("aidiss_consume_rate_limit", {
      p_scope: scope,
      p_key_hash: keyHash,
      p_limit: limit,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row) {
      return { allowed: Boolean(row.allowed), retryAfter: Number(row.retry_after_seconds ?? 60) };
    }
    throw error ?? new Error("Rate limit response was empty.");
  }

  const nowWindow = Math.floor(Date.now() / 60_000);
  const previous = memoryLimits.get(keyHash);
  const next = previous?.window === nowWindow ? { window: nowWindow, count: previous.count + 1 } : { window: nowWindow, count: 1 };
  memoryLimits.set(keyHash, next);
  if (memoryLimits.size > 5_000) {
    for (const [storedKey, value] of memoryLimits) {
      if (value.window < nowWindow) memoryLimits.delete(storedKey);
    }
  }
  return { allowed: next.count <= limit, retryAfter: 60 - Math.floor((Date.now() % 60_000) / 1000) };
}

export async function purgeExpired(batchSize = 500): Promise<{
  configured: boolean;
  deletedSessions: number;
  deletedBuckets: number;
}> {
  const db = getSupabaseAdmin();
  if (!db) return { configured: false, deletedSessions: 0, deletedBuckets: 0 };
  const { data, error } = await db.rpc("aidiss_purge_expired", { p_batch_size: batchSize });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    configured: true,
    deletedSessions: Number(row?.deleted_sessions ?? 0),
    deletedBuckets: Number(row?.deleted_buckets ?? 0),
  };
}
