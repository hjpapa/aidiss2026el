import { describe, expect, it } from "vitest";

import { PETS } from "@/data/pets";
import { TYPE_QUIZ, calculatePetResult } from "@/data/quiz";
import { TOPICS } from "@/data/topics";

describe("pet perspective quiz", () => {
  it("gives every pet the same number of appearances", () => {
    const appearances = TYPE_QUIZ.flatMap((question) => question.options).reduce<Record<string, number>>(
      (counts, option) => ({ ...counts, [option.petId]: (counts[option.petId] ?? 0) + 1 }),
      {},
    );

    expect(appearances).toEqual({ lumi: 3, toto: 3, pori: 3, momo: 3, hari: 3, duri: 3 });
  });

  it("returns one winner without pretending a tie is a diagnosis", () => {
    expect(calculatePetResult(["lumi", "lumi", "lumi", "toto", "pori", "momo"])).toEqual({
      winner: "lumi",
      tied: ["lumi"],
    });
    expect(calculatePetResult(["lumi", "lumi", "toto", "toto", "pori", "momo"])).toEqual({
      winner: undefined,
      tied: ["lumi", "toto"],
    });
  });

  it("grounds two pet roles in each of the three human-centered AI ethics principles", () => {
    const counts = PETS.reduce<Record<string, number>>(
      (result, pet) => ({ ...result, [pet.principleId]: (result[pet.principleId] ?? 0) + 1 }),
      {},
    );

    expect(counts).toEqual({ technical_purpose: 2, human_dignity: 2, social_good: 2 });
  });

  it("presents every topic as a two-value dilemma with a child-friendly scene", () => {
    for (const topic of TOPICS) {
      expect(topic.principlePair[0]).not.toBe(topic.principlePair[1]);
      expect(topic.scenario.g34.length).toBeGreaterThan(20);
      expect(topic.valueConflict.g34).toContain("↔");
    }
  });
});
