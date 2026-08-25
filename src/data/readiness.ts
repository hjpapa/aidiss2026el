import { byGrade } from "@/data/pets";
import type { ByGrade, ReadinessId } from "@/types/debate";

export interface ReadinessDefinition {
  id: ReadinessId;
  icon: string;
  shortLabel: string;
  label: ByGrade;
  help: ByGrade;
  starter: ByGrade;
  completionRule: string;
}

export const READINESS_CRITERIA: ReadinessDefinition[] = [
  {
    id: "technical_mechanism",
    icon: "⚙️",
    shortLabel: "기술 원리",
    label: byGrade("기술이 어떻게 움직이는지 말했어요", "기술의 작동 원리를 설명했어요"),
    help: byGrade(
      "기술에 무엇이 들어가고, 안에서 무엇을 한 뒤, 무엇이 나오는지 차례로 생각해 봐요.",
      "입력한 것, 기술이 처리하는 방법, 나온 결과를 원인과 결과로 이어 보세요.",
    ),
    starter: byGrade(
      "이 기술은 …을 받아서 …한 뒤 …을 만들어요.",
      "이 기술은 …을 입력받아 …하는 방식으로 …을 만들어요.",
    ),
    completionRule:
      "학생 발화가 입력, 데이터, 처리, 출력, 오류 원인 중 하나 이상의 인과 관계를 설명한다.",
  },
  {
    id: "benefit_and_risk",
    icon: "⚖️",
    shortLabel: "결과 내다보기",
    label: byGrade("좋은 결과와 걱정되는 결과를 말했어요", "선택 뒤의 이익과 위험을 함께 예상했어요"),
    help: byGrade(
      "도움이 되는 점 한 가지와 문제가 생길 수 있는 점 한 가지를 함께 찾아봐요.",
      "같은 기술이 주는 구체적인 이익과 위험을 한 번에 비교해 보세요.",
    ),
    starter: byGrade(
      "좋은 점은 …이지만, 걱정되는 점은 …이에요.",
      "…에는 도움이 되지만, …할 위험도 있어요.",
    ),
    completionRule:
      "구체적 이익 한 개 이상과 구체적 위험 한 개 이상이 학생 발화 근거로 존재한다.",
  },
  {
    id: "other_stakeholder",
    icon: "👥",
    shortLabel: "마음·처지",
    label: byGrade("다른 사람의 마음과 영향을 생각했어요", "영향받는 사람의 처지와 관점을 고려했어요"),
    help: byGrade(
      "나 말고 친구, 선생님, 가족처럼 영향을 받을 사람을 한 명 떠올려 봐요.",
      "학생, 교사, 가족, 회사처럼 서로 다르게 영향을 받을 사람이나 집단을 골라 보세요.",
    ),
    starter: byGrade(
      "이 기술 때문에 …은/는 …할 수 있어요.",
      "이 선택은 …에게 …라는 영향을 줄 수 있어요.",
    ),
    completionRule: "학생 자신 이외의 사람이나 집단과 그들에게 생길 결과를 설명한다.",
  },
  {
    id: "counterargument_response",
    icon: "💬",
    shortLabel: "다른 관점",
    label: byGrade("상대 펫의 다른 관점에 답했어요", "상대의 다른 관점을 이해하고 답했어요"),
    help: byGrade(
      "상대 펫의 말 중 한 부분을 골라 동의하거나, 다르게 생각하거나, 조건을 더해 봐요.",
      "상대 주장을 짧게 짚은 뒤 동의, 반박, 조건 추가 중 하나로 직접 답해 보세요.",
    ),
    starter: byGrade(
      "네가 말한 …에는 동의하지만, 나는 …라고 생각해요.",
      "…라는 말은 맞지만, …라는 조건도 필요해요.",
    ),
    completionRule: "상대 메시지의 주장에 동의, 반박 또는 조건 추가로 응답한다.",
  },
  {
    id: "stance_with_reason",
    icon: "🧭",
    shortLabel: "책임 있는 선택",
    label: byGrade("지금 선택과 내가 할 일을 말했어요", "현재 입장과 실천 조건·책임을 밝혔어요"),
    help: byGrade(
      "지금은 어느 쪽에 가까운지 말하고, 문제를 줄이기 위해 할 일을 붙여 봐요.",
      "현재 입장과 이유를 밝힌 뒤 실천 조건이나 책임질 사람을 연결해 보세요.",
    ),
    starter: byGrade(
      "지금 나는 …라고 생각해요. 그래서 나는 …할 거예요.",
      "지금 내 입장은 …이고, …가 …을 확인해야 해요.",
    ),
    completionRule: "현재 판단과 함께 실천할 행동, 사용 조건 또는 책임 주체 중 하나를 말한다.",
  },
];
