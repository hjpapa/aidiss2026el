import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyDebateState } from "@/types/debate";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/openai", () => ({
  moderateText: vi.fn(async () => ({ flagged: false, categories: [] })),
  generateChatTurn: mocks.generate,
}));
vi.mock("@/lib/api-utils", () => ({
  authorizeSession: vi.fn(async () => ({ authorized: true, mode: "local_only" })),
  rejectOversizedRequest: () => null,
  apiError: (code: string, message: string, status: number) => Response.json({ code, message }, { status }),
}));
vi.mock("@/lib/session-token", () => ({
  hashIdentifier: () => "hash", verifyStateProof: () => true, issueStateProof: () => "proof",
}));
vi.mock("@/lib/supabase-server", () => ({
  consumeRateLimit: vi.fn(async () => ({ allowed: true })),
  claimGeneration: vi.fn(), loadRecentMessages: vi.fn(), loadStoredChatTurn: vi.fn(),
  markGenerationFailed: vi.fn(), persistChatTurn: vi.fn(),
}));

import { POST } from "@/app/api/chat/route";

describe("non-substantive chat turns", () => {
  beforeEach(() => mocks.generate.mockReset());

  it.each(["off_topic", "needs_support", "repeated"])("preserves all state and excludes %s from evidence", async (engagement) => {
    const state = createEmptyDebateState();
    mocks.generate.mockResolvedValue({
      result: { engagement, opponentReply: "이 선택으로 누가 불편해질까?", allyHint: "", state: { ...state, summary: "must not be adopted" } },
      meta: { model: "test" },
    });
    const response = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        sessionId: crypto.randomUUID(), requestId: crypto.randomUUID(), token: "a".repeat(32),
        stateProof: "b".repeat(32), stateVersion: 0, state, recentMessages: [],
        setup: { gradeBand: "g34", learnerPetId: "lumi", opponentPetId: "pori", topicId: "ai-answer-trust", initialStance: "a" },
        message: "오늘 점심 메뉴 얘기나 해 보자",
      }),
    }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.state).toEqual(state);
    expect(result.acceptedLearnerMessage.kind).toBe("guidance");
    expect(result.opponentMessage.kind).toBe("guidance");
    expect(result.stateVersion).toBe(1);
  });
});
