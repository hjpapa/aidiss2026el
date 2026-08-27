import type { InitialStance, PetId, TopicId } from "@/types/debate";

export const OPPOSING_PET_PRIORITY = {
  "ai-answer-trust": {
    a: ["pori", "toto"],
    b: ["lumi", "duri"],
  },
  "ai-opinion": {
    a: ["hari", "pori"],
    b: ["lumi", "duri"],
  },
  "ai-grading": {
    a: ["momo", "hari"],
    b: ["lumi", "duri"],
  },
  "face-synthesis": {
    a: ["toto", "hari"],
    b: ["lumi", "duri"],
  },
  recommendation: {
    a: ["hari", "toto"],
    b: ["lumi", "duri"],
  },
  "face-attendance": {
    a: ["toto", "hari"],
    b: ["duri", "lumi"],
  },
  "location-tracking": {
    a: ["hari", "toto"],
    b: ["duri", "momo"],
  },
  "paid-ai-fairness": {
    a: ["momo", "duri"],
    b: ["lumi", "duri"],
  },
} satisfies Record<TopicId, Record<InitialStance, readonly PetId[]>>;

export function recommendedOpponentPet(
  topicId: TopicId,
  stance: InitialStance,
  learnerPetId: PetId,
): PetId {
  return OPPOSING_PET_PRIORITY[topicId][stance].find((petId) => petId !== learnerPetId)!;
}
