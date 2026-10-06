import { describe, expect, it } from "vitest";
import { engagementGuidance } from "@/lib/debate-engagement";
import type { DebateMessage } from "@/types/debate";

describe("debate support", () => {
  it("redirects noise and unfinished starters without treating them as evidence", () => {
    for (const text of [
      "ㅋㅋㅋㅋ",
      "ㅋㅋ",
      "ㅠㅠ",
      "ㅇㅋ",
      "!!!!!!",
      "aaaaaa",
      "내 생각은 … 왜냐하면 …",
      "이 기술은 …해서 결과를 만들어요.",
      "이 기술은 …을 받아서 …한 뒤 …을 만들어요.",
      "만약 이 기술이 틀린다면 ",
      "찬성",
    ]) {
      expect(engagementGuidance(text, [])).not.toBeNull();
    }
  });
  it("notices repetition but accepts a new reason", () => {
    const history: DebateMessage[] = [{ id: "a", role: "learner", kind: "move", content: "AI도 틀려요", createdAt: "2026-09-06T00:00:00Z" }];
    expect(engagementGuidance("AI도 틀려요!", history)).not.toBeNull();
    expect(engagementGuidance("AI도 틀려요. 배운 자료가 잘못됐을 수 있어요.", history)).toBeNull();
  });
  it("lets a learner resend a message that was not accepted as a move", () => {
    const history: DebateMessage[] = [
      { id: "a", role: "learner", kind: "move", content: "AI가 빨라서 좋아요", createdAt: "2026-09-06T00:00:00Z" },
      { id: "b", role: "learner", kind: "guidance", content: "AI도 틀려요", createdAt: "2026-09-06T00:01:00Z" },
    ];
    expect(engagementGuidance("AI도 틀려요", history)).toBeNull();
  });
  it("accepts short relevant ideas, disagreement, questions and ordinary pauses", () => {
    for (const text of [
      "AI도 틀려요",
      "왜 틀려?",
      "반대야. 사생활이 중요해.",
      "음… 다른 친구도 생각해야 해",
      "AI는 틀릴 수도 있는데…",
      "음…한 가지 이유는 데이터가 틀릴 수 있어서야",
      "만약 이 기술이 틀린다면 친구가 잘못 배울 수 있어요",
      "No, AI can be wrong.",
    ]) {
      expect(engagementGuidance(text, [])).toBeNull();
    }
  });
});
