import { describe, expect, it } from "vitest";

import { OPPOSING_PET_PRIORITY, recommendedOpponentPet } from "@/data/opponent-recommendations";
import { PETS } from "@/data/pets";
import { TOPICS } from "@/data/topics";
import type { InitialStance } from "@/types/debate";

describe("opposing pet recommendation", () => {
  it("recommends a different pet for every topic, stance, and learner pet", () => {
    for (const topic of TOPICS) {
      for (const stance of ["a", "b"] as InitialStance[]) {
        for (const learnerPet of PETS) {
          const recommendation = recommendedOpponentPet(topic.id, stance, learnerPet.id);

          expect(recommendation).not.toBe(learnerPet.id);
          expect(OPPOSING_PET_PRIORITY[topic.id][stance]).toContain(recommendation);
        }
      }
    }
  });

  it("switches to the second opposing lens when the learner owns the first one", () => {
    expect(recommendedOpponentPet("ai-answer-trust", "a", "pori")).toBe("toto");
    expect(recommendedOpponentPet("face-attendance", "b", "duri")).toBe("lumi");
    expect(recommendedOpponentPet("paid-ai-fairness", "b", "lumi")).toBe("duri");
  });
});
