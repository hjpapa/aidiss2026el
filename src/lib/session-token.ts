import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { DebateState, SessionSetup } from "@/types/debate";

interface SessionTokenPayload {
  sid: string;
  exp: number;
  v: 1;
  mode: "stored" | "local_only";
}

interface StateProofPayload {
  sid: string;
  digest: string;
  v: 1;
}

const LOCAL_ONLY_SECRET = "aidiss-local-development-secret-not-for-production";

function secret(): string {
  const configured = process.env.SESSION_TOKEN_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_TOKEN_SECRET must be configured in production.");
  }
  return LOCAL_ONLY_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function stateDigest(setup: SessionSetup, state: DebateState, stateVersion: number): string {
  return createHmac("sha256", secret()).update(canonicalize({ setup, state, stateVersion })).digest("hex");
}

export function issueSessionToken(
  sessionId: string,
  expiresAt: string,
  mode: SessionTokenPayload["mode"] = "stored",
): string {
  const payload: SessionTokenPayload = {
    sid: sessionId,
    exp: Math.floor(new Date(expiresAt).getTime() / 1000),
    v: 1,
    mode,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function parseSessionToken(token: string): SessionTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionTokenPayload;
    if (
      payload.v !== 1 ||
      !["stored", "local_only"].includes(payload.mode) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function verifySessionToken(token: string, expectedSessionId: string): boolean {
  return parseSessionToken(token)?.sid === expectedSessionId;
}

export function getSessionTokenMode(token: string): SessionTokenPayload["mode"] | null {
  return parseSessionToken(token)?.mode ?? null;
}

export function issueStateProof(
  sessionId: string,
  setup: SessionSetup,
  state: DebateState,
  stateVersion: number,
): string {
  const payload: StateProofPayload = { sid: sessionId, digest: stateDigest(setup, state, stateVersion), v: 1 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyStateProof(
  proof: string,
  sessionId: string,
  setup: SessionSetup,
  state: DebateState,
  stateVersion: number,
): boolean {
  const [encoded, signature] = proof.split(".");
  if (!encoded || !signature) return false;
  const expectedSignature = sign(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as StateProofPayload;
    return payload.v === 1 && payload.sid === sessionId && payload.digest === stateDigest(setup, state, stateVersion);
  } catch {
    return false;
  }
}

export function hashCapability(token: string): string {
  return createHmac("sha256", secret()).update(token).digest("hex");
}

export function hashIdentifier(value: string): string {
  const pepper = process.env.PARTICIPANT_HASH_PEPPER || secret();
  return createHmac("sha256", pepper).update(value).digest("hex");
}
