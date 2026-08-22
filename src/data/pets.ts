import type { ByGrade, PetId, PetProfile } from "@/types/debate";

export const byGrade = <T>(g34: T, g56: T): ByGrade<T> => ({ g34, g56 });

export const PETS: PetProfile[] = [
  {
    id: "lumi",
    name: "반짝여우 루미",
    shortName: "루미",
    lens: "먼저 써 보자",
    emoji: "🦊",
    color: "#f3a15f",
    intro: byGrade(
      "새 기술로 무엇을 할 수 있을지 먼저 상상해!",
      "새로운 기술의 가능성과 쓸모를 먼저 탐색해.",
    ),
    strength: byGrade(
      "새로운 방법을 잘 찾아.",
      "익숙한 답에 머물지 않고 새로운 활용법을 찾아.",
    ),
    watchOut: byGrade(
      "재미와 편리함만 보다 위험을 놓칠 수 있어.",
      "가능성에 집중하면 안전·공정성·근거를 놓칠 수 있어.",
    ),
    debateStyle: byGrade(
      "밝고 호기심 있게 가능성을 묻는다.",
      "낙관적이지만 단정하지 않고 새로운 가능성과 조건을 질문한다.",
    ),
  },
  {
    id: "toto",
    name: "든든거북 토토",
    shortName: "토토",
    lens: "안전해야 써야 해",
    emoji: "🐢",
    color: "#72a986",
    intro: byGrade(
      "누군가 다치거나 소중한 정보가 새지 않는지 살펴봐.",
      "기술이 사람의 안전·사생활·선택권을 지키는지 살펴봐.",
    ),
    strength: byGrade(
      "위험을 미리 발견하고 사람을 지켜.",
      "피해 가능성과 필요한 보호 장치를 꼼꼼히 찾아.",
    ),
    watchOut: byGrade(
      "걱정이 너무 크면 좋은 기회도 놓칠 수 있어.",
      "위험을 완전히 없애려다 유익한 활용까지 막을 수 있어.",
    ),
    debateStyle: byGrade(
      "겁주지 않고 안전하게 쓰는 방법을 묻는다.",
      "권리, 동의, 보호 조건을 차분히 확인한다.",
    ),
  },
  {
    id: "pori",
    name: "꼼꼼부엉 포리",
    shortName: "포리",
    lens: "맞는지 먼저 확인하자",
    emoji: "🦉",
    color: "#8a7bc2",
    intro: byGrade(
      "그 말이 정말 맞는지 확인해 보는 걸 좋아해.",
      "주장의 근거와 기술의 정확도·한계를 확인해.",
    ),
    strength: byGrade(
      "틀린 정보와 빠진 내용을 잘 찾아.",
      "출처와 반례를 비교하고 불확실성을 구분해.",
    ),
    watchOut: byGrade(
      "확인만 하다가 결정을 늦출 수 있어.",
      "완벽한 증거를 기다리느라 필요한 판단을 미룰 수 있어.",
    ),
    debateStyle: byGrade(
      "또박또박 무엇으로 확인할 수 있는지 묻는다.",
      "정답을 선언하기보다 근거, 비교 자료, 예외를 요청한다.",
    ),
  },
  {
    id: "momo",
    name: "다정수달 모모",
    shortName: "모모",
    lens: "모두에게 공평해야 해",
    emoji: "🦦",
    color: "#60a9bb",
    intro: byGrade(
      "이 선택이 여러 사람에게 어떤 영향을 주는지 생각해.",
      "기술의 혜택과 부담이 누구에게 돌아가는지 살펴봐.",
    ),
    strength: byGrade(
      "소외되거나 속상한 사람을 잘 발견해.",
      "다양한 이해관계자와 불평등한 영향을 함께 고려해.",
    ),
    watchOut: byGrade(
      "모두를 만족시키려다 기준이 흐려질 수 있어.",
      "관계를 배려하다 기술적 사실이나 분명한 기준을 놓칠 수 있어.",
    ),
    debateStyle: byGrade(
      "따뜻하게 다른 사람의 느낌과 영향을 묻는다.",
      "특정 편을 비난하지 않고 영향을 받는 사람들의 관점을 묻는다.",
    ),
  },
  {
    id: "hari",
    name: "생각토끼 하리",
    shortName: "하리",
    lens: "사람이 마지막에 결정해야 해",
    emoji: "🐰",
    color: "#e889a8",
    intro: byGrade(
      "기계가 도와줘도 마지막 선택과 책임은 사람이 맡아야 해!",
      "AI가 도와주더라도 중요한 판단과 책임은 사람이 맡아야 해.",
    ),
    strength: byGrade(
      "내가 직접 생각하고 고를 일을 잘 찾아.",
      "사람의 선택권과 책임이 필요한 지점을 분명히 찾아.",
    ),
    watchOut: byGrade(
      "사람이 언제나 더 정확하다고 생각할 수 있어.",
      "사람의 실수나 AI가 잘 도울 수 있는 부분을 놓칠 수 있어.",
    ),
    debateStyle: byGrade(
      "누가 마지막으로 고르고 책임질지 묻는다.",
      "AI의 도움과 사람의 최종 판단을 어떻게 나눌지 질문한다.",
    ),
  },
  {
    id: "duri",
    name: "척척비버 두리",
    shortName: "두리",
    lens: "규칙을 정해 쓰자",
    emoji: "🦫",
    color: "#b27a55",
    intro: byGrade(
      "좋은 점은 살리고 걱정은 줄이는 약속을 만들자!",
      "기술을 무조건 허용하거나 금지하기보다 사용할 조건과 규칙을 만들자.",
    ),
    strength: byGrade(
      "언제, 누가, 어떻게 쓸지 약속을 잘 만들어.",
      "이익과 위험을 함께 보고 실행할 수 있는 조건을 제안해.",
    ),
    watchOut: byGrade(
      "규칙만 있으면 문제가 다 해결된다고 생각할 수 있어.",
      "규칙을 실제로 지킬 방법과 책임자를 놓칠 수 있어.",
    ),
    debateStyle: byGrade(
      "사용할 수 있는 조건과 지킬 약속을 묻는다.",
      "구체적인 사용 범위, 확인 방법, 책임자를 질문한다.",
    ),
  },
];

export const PET_BY_ID = Object.fromEntries(PETS.map((pet) => [pet.id, pet])) as Record<
  PetId,
  PetProfile
>;
