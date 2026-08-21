import { describe, expect, it } from "vitest";

import { TYPE_QUIZ, calculatePetResult } from "@/data/quiz";

describe("pet perspective quiz", () => {
  it("gives every pet the same number of appearances", () => {
    const appearances = TYPE_QUIZ.flatMap((question) => question.options).reduce<Record<string, number>>(
      (counts, option) => ({ ...counts, [option.petId]: (counts[option.petId] ?? 0) + 1 }),
      {},
    );

    expect(appearances).toEqual({ lumi: 3, toto: 3, pori: 3, momo: 3 });
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
});
