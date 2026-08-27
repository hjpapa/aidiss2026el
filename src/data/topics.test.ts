import { describe, expect, it } from "vitest";

import { TOPIC_BY_ID, TOPICS } from "@/data/topics";
import type { GradeBand } from "@/types/debate";

const GRADE_BANDS: GradeBand[] = ["g34", "g56"];

describe("topic dilemmas", () => {
  it("presents two distinct choices and a visible value conflict at every grade level", () => {
    for (const topic of TOPICS) {
      for (const gradeBand of GRADE_BANDS) {
        expect(topic.title[gradeBand]).toMatch(/\?$/);
        expect(topic.scenario[gradeBand].length).toBeGreaterThan(20);
        expect(topic.valueConflict[gradeBand]).toContain("↔");
        expect(topic.stanceA[gradeBand]).not.toBe(topic.stanceB[gradeBand]);
      }
    }
  });

  it("keeps the limited school-account topic focused on allocation rather than personal paid plans", () => {
    const topic = TOPIC_BY_ID["paid-ai-fairness"];

    expect(topic.scenario.g34).toContain("10명");
    expect(topic.scenario.g56).toContain("계정 10개");
    expect(topic.technicalCore.g56).toContain("배정·순환 기준");
    expect(topic.opponentQuestions.counterargument_response.g34).toContain("먼저 신청한 사람");
    expect(topic.opponentQuestions.stance_with_reason.g56).toContain("배정·순환·지원 기준");
  });
});
