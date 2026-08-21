import { byGrade } from "@/data/pets";
import type { ByGrade, ReadinessId } from "@/types/debate";

export interface ReadinessDefinition {
  id: ReadinessId;
  icon: string;
  shortLabel: string;
  label: ByGrade;
  completionRule: string;
}

export const READINESS_CRITERIA: ReadinessDefinition[] = [
  {
    id: "technical_mechanism",
    icon: "⚙️",
    shortLabel: "기술 원리",
    label: byGrade("기술이 어떻게 움직이는지 말했어요", "기술의 작동 원리를 설명했어요"),
    completionRule:
      "학생 발화가 입력, 데이터, 처리, 출력, 오류 원인 중 하나 이상의 인과 관계를 설명한다.",
  },
  {
    id: "benefit_and_risk",
    icon: "⚖️",
    shortLabel: "좋은 점·걱정",
    label: byGrade("좋은 점과 걱정되는 점을 모두 말했어요", "이익과 위험을 함께 비교했어요"),
    completionRule:
      "구체적 이익 한 개 이상과 구체적 위험 한 개 이상이 학생 발화 근거로 존재한다.",
  },
  {
    id: "other_stakeholder",
    icon: "👥",
    shortLabel: "다른 사람",
    label: byGrade("다른 사람에게 미칠 영향도 생각했어요", "다른 이해관계자의 영향을 고려했어요"),
    completionRule: "학생 자신 이외의 사람이나 집단과 그들에게 생길 결과를 설명한다.",
  },
  {
    id: "counterargument_response",
    icon: "💬",
    shortLabel: "반론 답하기",
    label: byGrade("상대 펫의 다른 생각에 답했어요", "상대의 반론에 자신의 말로 응답했어요"),
    completionRule: "상대 메시지의 주장에 동의, 반박 또는 조건 추가로 응답한다.",
  },
  {
    id: "stance_with_reason",
    icon: "🧭",
    shortLabel: "내 입장",
    label: byGrade("지금 생각과 까닭을 말했어요", "현재 입장과 판단 이유를 밝혔어요"),
    completionRule: "현재 판단과 최소 한 가지 이유 또는 조건을 함께 말한다.",
  },
];
