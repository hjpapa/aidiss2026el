import type { DebateMessage } from "@/types/debate";

const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}\u200B-\u200D\uFEFF]/gu, "");

export function engagementGuidance(content: string, history: DebateMessage[]): string | null {
  const text = normalize(content);
  if (!text || /^[ㄱ-ㅎㅏ-ㅣ]+$/.test(text) || /^(.)\1{3,}$/u.test(text)) {
    return "잠깐, 펫이 네 생각을 아직 찾지 못했어! 지금 상황에서 좋은 점이나 걱정되는 점을 하나만 말해 줄래?";
  }
  if (/…(?:을|한|해서|예요|지만|으로|$)|_{2,}|\(빈칸\)/u.test(content.trim())) {
    return "시작말을 골랐구나! 빈칸에 네 생각을 넣어 보자. 왜 그렇게 생각하는지 한 가지 이유를 붙여 줄래?";
  }
  const previous = [...history].reverse().find((item) => item.role === "learner");
  if (previous && normalize(previous.content) === text) {
    return "같은 생각을 다시 말해 줬구나. 이번에는 한 칸 더 탐험해 보자! 그 생각이 통하지 않을 때나 새로운 예를 하나 들려줄래?";
  }
  if (/^(응|네|아니|아니요|맞아|맞아요|그래|그냥|좋아|좋아요|싫어요|찬성|반대)[요!?.~]*$/.test(content.trim())) {
    return "입장을 골랐구나! 이제 이유 조각을 찾아보자. 누구에게 어떤 좋은 일이나 걱정되는 일이 생길까?";
  }
  return null;
}

export const DEBATE_CHALLENGES = [
  { title: "🎭 역할 바꾸기", question: "이 선택으로 불편해지는 친구가 있다면, 그 친구는 뭐라고 말할까?", starter: "다른 친구의 입장에서는 " },
  { title: "🔀 만약에 카드", question: "이 기술이 틀린 결과를 내면, 네가 정한 선택은 어떻게 달라질까?", starter: "만약 이 기술이 틀린다면 " },
  { title: "🛠️ 규칙 만들기", question: "좋은 점을 살리면서 걱정을 줄일 규칙을 하나 만든다면?", starter: "내가 만들 규칙은 " },
] as const;
