import { describe, expect, it } from "vitest";

import {
  buildCommunityInsights,
  COMMUNITY_PET_IDS,
  MIN_RATIO_SESSIONS,
  type CommunityThoughtCandidate,
} from "@/lib/community-insights";
import type { PetId, TopicId } from "@/types/debate";

const READY_COUNTS: Record<PetId, number> = {
  lumi: 3,
  toto: 2,
  pori: 2,
  momo: 1,
  hari: 1,
  duri: 1,
};

const TOPIC_IDS: TopicId[] = [
  "ai-answer-trust",
  "ai-opinion",
  "ai-grading",
  "face-synthesis",
  "recommendation",
];

function thought(index: number, text?: string): CommunityThoughtCandidate {
  return {
    petId: COMMUNITY_PET_IDS[index % COMMUNITY_PET_IDS.length],
    topicId: TOPIC_IDS[index % TOPIC_IDS.length],
    myThinking:
      text ??
      `나는 ${index + 1}번째 의견으로 AI를 쓰되 결과를 확인하는 규칙이 필요하다고 생각해. 왜냐하면 빠른 도움과 안전을 함께 지킬 수 있기 때문이야.`,
  };
}

describe("community insight aggregation", () => {
  it("waits for enough completed debates before revealing ratios", () => {
    const result = buildCommunityInsights(
      { lumi: MIN_RATIO_SESSIONS - 1, toto: 0, pori: 0, momo: 0, hari: 0, duri: 0 },
      [],
    );

    expect(result.status).toBe("collecting");
    expect(result.petRatios).toEqual([]);
  });

  it("returns whole-number percentages that add up to 100", () => {
    const result = buildCommunityInsights(READY_COUNTS, []);

    expect(result.status).toBe("ready");
    expect(result.petRatios).toHaveLength(6);
    expect(result.petRatios.reduce((sum, item) => sum + item.percent, 0)).toBe(100);
  });

  it("shows only separately consented candidates that pass privacy filtering", () => {
    const candidates = [
      thought(0),
      thought(1),
      thought(2),
      thought(3),
      thought(4),
      thought(5, "내 이름은 김하늘이고 전화번호는 010-1234-5678이야. AI 사용은 괜찮아."),
      thought(6, "우리 반 친구 김민수는 AI 사용 때문에 피해를 받았다고 말했어."),
      thought(
        7,
        "AI 결과를 확인하는 규칙을 함께 정해야 한다고 생각해. ".repeat(12) + "내 이름은 김하늘이야.",
      ),
    ];
    const result = buildCommunityInsights(READY_COUNTS, candidates);

    expect(result.thoughtStatus).toBe("ready");
    expect(result.thoughts).toHaveLength(5);
    expect(result.thoughts.some((item) => item.text.includes("010-1234-5678"))).toBe(false);
    expect(result.thoughts.some((item) => item.text.includes("김민수"))).toBe(false);
    expect(Object.keys(result.thoughts[0]).sort()).toEqual(["text", "topicId"]);
  });
});
