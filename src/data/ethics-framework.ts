import { byGrade } from "@/data/pets";
import type {
  AnalysisLevel,
  ByGrade,
  EthicsPrincipleId,
  EthicsSensitivityId,
} from "@/types/debate";

export interface EthicsPrincipleDefinition {
  id: EthicsPrincipleId;
  icon: string;
  name: ByGrade;
  shortName: ByGrade;
  explanation: ByGrade;
  question: ByGrade;
}

export interface EthicsSensitivityDefinition {
  id: EthicsSensitivityId;
  icon: string;
  name: ByGrade;
  explanation: ByGrade;
}

export const ETHICS_PRINCIPLES: EthicsPrincipleDefinition[] = [
  {
    id: "human_dignity",
    icon: "🫶",
    name: byGrade("한 사람을 소중하게", "인간 존엄성"),
    shortName: byGrade("사람", "인간 존엄"),
    explanation: byGrade(
      "사람의 안전, 마음, 사생활, 선택할 권리를 먼저 살펴봐요.",
      "사람은 기술로 대신할 수 없는 가치가 있으며 안전·권리·선택을 존중해야 해요.",
    ),
    question: byGrade(
      "한 사람의 안전과 권리는 지켜질까?",
      "사람의 존엄성·권리·선택권은 충분히 보호되는가?",
    ),
  },
  {
    id: "social_good",
    icon: "🌏",
    name: byGrade("우리 모두에게 이롭게", "사회 공공선"),
    shortName: byGrade("우리", "사회 공공선"),
    explanation: byGrade(
      "혜택과 어려움이 여러 사람에게 공평하게 돌아가는지 살펴봐요.",
      "기술이 공동의 이익을 늘리고 약한 사람을 소외시키지 않는지 살펴봐요.",
    ),
    question: byGrade(
      "우리 모두에게 공평하고 도움이 될까?",
      "공동의 이익과 공정한 참여에 도움이 되는가?",
    ),
  },
  {
    id: "technical_purpose",
    icon: "🛠️",
    name: byGrade("기술이 제 일을 잘하게", "기술 합목적성"),
    shortName: byGrade("기술", "기술 합목적"),
    explanation: byGrade(
      "기술이 만들려는 도움을 제대로, 알맞게 이루는지 살펴봐요.",
      "기술이 정한 목적을 효과적으로 이루며 정확성과 한계를 설명할 수 있는지 살펴봐요.",
    ),
    question: byGrade(
      "이 기술은 맡은 일을 제대로 해낼까?",
      "기술은 목적을 효과적으로 이루고 한계를 드러내는가?",
    ),
  },
];

export const ETHICS_PRINCIPLE_BY_ID = Object.fromEntries(
  ETHICS_PRINCIPLES.map((item) => [item.id, item]),
) as Record<EthicsPrincipleId, EthicsPrincipleDefinition>;

export const ETHICS_SENSITIVITY: EthicsSensitivityDefinition[] = [
  {
    id: "situation",
    icon: "🔍",
    name: byGrade("문제 알아보기", "상황지각"),
    explanation: byGrade(
      "무엇이 윤리 문제인지 알아차렸는지 봐요.",
      "상황 속 AI 윤리 문제와 충돌하는 가치를 알아차렸는지 봐요.",
    ),
  },
  {
    id: "consequence",
    icon: "🔮",
    name: byGrade("결과 내다보기", "결과지각"),
    explanation: byGrade(
      "선택 뒤에 누구에게 어떤 일이 생길지 생각했는지 봐요.",
      "각 선택이 사람들에게 가져올 결과를 구체적으로 예상했는지 봐요.",
    ),
  },
  {
    id: "empathy",
    icon: "💞",
    name: byGrade("마음 헤아리기", "공감지각"),
    explanation: byGrade(
      "영향을 받는 사람의 마음과 처지를 생각했는지 봐요.",
      "영향을 받는 사람의 감정과 관점을 이해하려 했는지 봐요.",
    ),
  },
  {
    id: "responsibility",
    icon: "🙋",
    name: byGrade("내 할 일 정하기", "책임지각"),
    explanation: byGrade(
      "문제를 줄이기 위해 내가 할 일을 말했는지 봐요.",
      "문제를 자신의 일로 보고 실천 방법이나 책임자를 제안했는지 봐요.",
    ),
  },
];

export const ETHICS_SENSITIVITY_BY_ID = Object.fromEntries(
  ETHICS_SENSITIVITY.map((item) => [item.id, item]),
) as Record<EthicsSensitivityId, EthicsSensitivityDefinition>;

export const ANALYSIS_LEVEL_LABEL: Record<AnalysisLevel, string> = {
  clear: "분명히 보였어요",
  some: "조금 보였어요",
  next: "다음에 찾아봐요",
};

export const THEORY_NOTE = {
  short:
    "펫은 성격을 진단하지 않아요. 사람 중심 AI 윤리의 세 가치에서 오늘 먼저 살펴본 관점을 보여 줘요.",
  detail:
    "가치 관점은 인간 존엄성·사회 공공선·기술 합목적성, 생각 과정은 상황·결과·공감·책임 지각을 바탕으로 구성했어요.",
};

export const THEORY_SOURCES = [
  {
    title: "인공지능 윤리 역량 신장을 위한 인공지능 윤리 딜레마 개발 (2023)",
    use: "세 가지 가치 렌즈와 가치가 부딪히는 딜레마 구조",
  },
  {
    title: "인공지능 윤리감수성 검사 도구 개발 연구 (2024)",
    use: "상황·결과·공감·책임을 살피는 네 걸음 생각 과정",
  },
] as const;
