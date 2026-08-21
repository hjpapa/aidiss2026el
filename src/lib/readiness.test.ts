import { describe, expect, it } from "vitest";

import { isReflectionReady, isValidEvidence, sanitizeDebateState } from "@/lib/readiness";
import { createEmptyDebateState, type DebateMessage } from "@/types/debate";

const learnerMessage: DebateMessage = {
  id: "learner-1",
  role: "learner",
  kind: "move",
  content: "얼굴 사진을 숫자로 바꾼 뒤 저장된 특징과 비교해서 출석 결과를 만들어요.",
  createdAt: "2026-08-22T00:00:00.000Z",
};

describe("readiness evidence", () => {
  it("accepts only an exact excerpt from a learner debate move", () => {
    expect(isValidEvidence({ messageId: learnerMessage.id, quote: "숫자로 바꾼 뒤" }, [learnerMessage])).toBe(true);
    expect(isValidEvidence({ messageId: learnerMessage.id, quote: "AI가 알아서 판단해요" }, [learnerMessage])).toBe(false);
    expect(
      isValidEvidence(
        { messageId: "pet-1", quote: "숫자로 바꾼 뒤" },
        [{ ...learnerMessage, id: "pet-1", role: "opponent_pet" }],
      ),
    ).toBe(false);
  });

  it("keeps completed criteria monotonic and rejects unsupported new criteria", () => {
    const previous = createEmptyDebateState();
    previous.readiness[0] = {
      id: "technical_mechanism",
      completed: true,
      evidence: [{ messageId: learnerMessage.id, quote: "숫자로 바꾼 뒤" }],
    };
    const proposed = createEmptyDebateState();
    proposed.readiness[1] = {
      id: "benefit_and_risk",
      completed: true,
      evidence: [{ messageId: learnerMessage.id, quote: "없는 문장" }],
    };

    const result = sanitizeDebateState(previous, proposed, [learnerMessage], learnerMessage.id);

    expect(result.readiness[0].completed).toBe(true);
    expect(result.readiness[1]).toMatchObject({ completed: false, evidence: [] });
    expect(isReflectionReady(result)).toBe(false);
  });

  it("only awards a new criterion from the learner message being committed", () => {
    const currentMessage = { ...learnerMessage, id: "learner-2", content: "이번에는 내 입장만 말해요." };
    const proposed = createEmptyDebateState();
    proposed.readiness[0] = {
      id: "technical_mechanism",
      completed: true,
      evidence: [{ messageId: learnerMessage.id, quote: "숫자로 바꾼 뒤" }],
    };

    const result = sanitizeDebateState(
      createEmptyDebateState(),
      proposed,
      [learnerMessage, currentMessage],
      currentMessage.id,
    );

    expect(result.readiness[0]).toMatchObject({ completed: false, evidence: [] });
  });
});
