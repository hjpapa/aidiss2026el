import { describe, expect, it } from "vitest";
import { engagementGuidance } from "@/lib/debate-engagement";
import type { DebateMessage } from "@/types/debate";

describe("debate support", () => {
  it("redirects noise and unfinished starters without treating them as evidence", () => {
    for (const text of ["ㅋㅋㅋㅋ", "!!!!!!", "aaaaaa", "내 생각은 … 왜냐하면 …", "찬성"]) {
      expect(engagementGuidance(text, [])).not.toBeNull();
    }
  });
  it("notices repetition but accepts a new reason", () => {
    const history: DebateMessage[] = [{ id: "a", role: "learner", kind: "move", content: "AI도 틀려요", createdAt: "2026-09-06T00:00:00Z" }];
    expect(engagementGuidance("AI도 틀려요!", history)).not.toBeNull();
    expect(engagementGuidance("AI도 틀려요. 배운 자료가 잘못됐을 수 있어요.", history)).toBeNull();
  });
  it("accepts short relevant ideas, disagreement, questions and ordinary pauses", () => {
    for (const text of ["AI도 틀려요", "왜 틀려?", "반대야. 사생활이 중요해.", "음… 다른 친구도 생각해야 해", "No, AI can be wrong."]) {
      expect(engagementGuidance(text, [])).toBeNull();
    }
  });
});
