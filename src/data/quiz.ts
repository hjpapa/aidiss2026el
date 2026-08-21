import { byGrade } from "@/data/pets";
import type { PetId, QuizQuestion } from "@/types/debate";

export const TYPE_QUIZ: QuizQuestion[] = [
  {
    id: "lumi-toto",
    situation: byGrade(
      "우리 반에서 새로운 AI 그림 도구를 써 보려고 해. 무엇을 먼저 생각할까?",
      "수업에 새 AI 그림 도구를 도입하려 한다. 무엇부터 살펴볼까?",
    ),
    options: [
      { petId: "lumi", text: byGrade("어떤 재미있는 작품을 만들 수 있을까?", "수업과 창작에 어떤 가능성이 생길까?") },
      { petId: "toto", text: byGrade("사진이나 이름이 새지 않게 하려면?", "개인정보와 저작권을 지킬 조건은 무엇일까?") },
    ],
  },
  {
    id: "pori-lumi",
    situation: byGrade(
      "AI가 처음 듣는 설명을 해 줬어. 무엇이 더 궁금할까?",
      "AI가 낯선 방식으로 개념을 설명했다. 무엇을 더 살펴볼까?",
    ),
    options: [
      { petId: "pori", text: byGrade("어떤 자료를 바탕으로 한 설명인지 알아봐.", "설명의 출처와 근거가 어떻게 이어지는지 살펴본다.") },
      { petId: "lumi", text: byGrade("질문을 바꾸면 어떤 설명이 더 나올지 알아봐.", "질문 방식을 바꾸며 설명의 가능성을 탐색한다.") },
    ],
  },
  {
    id: "lumi-momo",
    situation: byGrade(
      "AI가 모둠 발표를 도와주는 새 기능이 생겼어. 무엇이 더 궁금할까?",
      "AI 발표 도우미가 생겼다. 가장 먼저 확인하고 싶은 것은?",
    ),
    options: [
      { petId: "lumi", text: byGrade("발표를 더 재미있게 만들 방법은?", "아이디어와 표현의 폭을 얼마나 넓힐까?") },
      { petId: "momo", text: byGrade("기능을 못 쓰는 친구도 참여할 수 있을까?", "유료 기능이 없는 학생도 공평하게 참여할까?") },
    ],
  },
  {
    id: "toto-pori",
    situation: byGrade(
      "AI가 어떤 인터넷 주소를 위험하다고 막았어. 무엇을 먼저 생각할까?",
      "보안 AI가 학습 사이트 접속을 차단했다. 무엇부터 확인할까?",
    ),
    options: [
      { petId: "toto", text: byGrade("먼저 멈추고 어른에게 알려.", "피해를 막기 위해 보호 절차를 따른다.") },
      { petId: "pori", text: byGrade("접속은 멈춘 채 선생님과 차단 이유를 확인해.", "접속을 멈춘 채 담당자와 차단 근거·오탐 여부를 검증한다.") },
    ],
  },
  {
    id: "momo-toto",
    situation: byGrade(
      "AI가 친구들을 모둠으로 자동으로 나눴어. 무엇을 살펴볼까?",
      "AI가 학생 기록을 보고 모둠을 구성했다. 무엇이 더 중요할까?",
    ),
    options: [
      { petId: "momo", text: byGrade("같은 친구만 불리해지지 않을까?", "특정 학생에게 불리한 결과가 반복되는지 본다.") },
      { petId: "toto", text: byGrade("어떤 내 정보를 사용했을까?", "어떤 정보가 수집됐고 누가 보는지 확인한다.") },
    ],
  },
  {
    id: "pori-momo",
    situation: byGrade(
      "친구에 관한 놀라운 AI 영상을 보았어. 무엇을 먼저 생각할까?",
      "친구가 등장하는 의심스러운 합성 영상이 퍼지고 있다. 무엇부터 볼까?",
    ),
    options: [
      { petId: "pori", text: byGrade("영상이 진짜인지 확인해.", "원본·출처·편집 흔적을 확인한다.") },
      { petId: "momo", text: byGrade("영상 속 친구가 받을 피해를 생각해.", "당사자와 주변 사람이 받을 영향을 고려한다.") },
    ],
  },
];

export function calculatePetResult(answers: PetId[]): { winner?: PetId; tied: PetId[] } {
  const scores = answers.reduce<Record<PetId, number>>(
    (acc, petId) => ({ ...acc, [petId]: acc[petId] + 1 }),
    { lumi: 0, toto: 0, pori: 0, momo: 0 },
  );
  const high = Math.max(...Object.values(scores));
  const tied = (Object.keys(scores) as PetId[]).filter((id) => scores[id] === high);
  return { winner: tied.length === 1 ? tied[0] : undefined, tied };
}
