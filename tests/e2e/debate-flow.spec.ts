import { expect, test } from "@playwright/test";

test("a learner can debate without a turn cap and complete evidence-based reflection", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("초등 3–4학년").check();
  await page.getByLabel(/안전 약속을 확인했어요/).check();
  await page.getByRole("button", { name: /내 생각 친구 찾기/ }).click();

  await page.getByRole("button", { name: /루미 · 쓸모 탐험가/ }).click();
  await page.getByRole("button", { name: /루미 · 쓸모 탐험가/ }).click();
  await page.getByRole("button", { name: /루미 · 쓸모 탐험가/ }).click();
  await page.locator(".quiz-option").first().click();
  await page.locator(".quiz-option").first().click();
  await page.locator(".quiz-option").first().click();
  await page.getByRole("button", { name: /하리 · 선택 길잡이/ }).click();
  await page.getByRole("button", { name: /두리 · 함께 약속 설계자/ }).click();
  await page.getByRole("button", { name: /하리 · 선택 길잡이/ }).click();

  await expect(page.getByRole("heading", { name: /루미와 한 팀이에요/ })).toBeVisible();
  await page.getByRole("radio", { name: /숙제 마감 10분 전/ }).check();
  await page.locator('.stance-options input[value="a"]').check();
  await page.getByRole("radio", { name: /토토/ }).click();
  await page.getByRole("button", { name: "펫 토론 시작하기" }).click();


  await page.getByRole("button", { name: "AI윤리 펫토론 처음 화면으로" }).click();
  await expect(page.getByRole("heading", { name: /귀여운 펫과 함께/ })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("내 생각 입력")).toBeVisible();
  const composer = page.getByLabel("내 생각 입력");
  const moves = [
    "AI는 많은 글의 규칙을 데이터에서 찾아 다음 낱말을 예상해 답을 만들어요.",
    "빨리 정보를 찾는 좋은 점이 있지만 틀린 답을 믿을 위험도 있어요.",
    "친구나 선생님은 AI 답 때문에 서로 다른 도움과 피해를 받을 수 있어요.",
    "빠르다는 반대 의견은 이해하지만 출처를 함께 확인해야 한다고 답할래요.",
    "나는 AI 답을 참고해도 된다고 생각하지만 다른 자료와 비교해야 해요.",
    "발자국을 다 채운 뒤에도 이 여섯 번째 말을 계속 보낼 수 있어요.",
  ];
  const transcript = page.getByRole("list", { name: "토론 대화" });
  for (const move of moves) {
    await composer.fill(move);
    await page.getByRole("button", { name: "말하기" }).click();
    await expect(transcript.getByText(move, { exact: true })).toBeVisible();
    await expect(page.getByText(/생각 중이에요/)).toBeHidden();
  }

  await expect(page.getByRole("heading", { name: "다섯 발자국을 모두 찾았어요!" })).toBeVisible();
  await page.getByRole("button", { name: "성찰하러 가기" }).click();
  await expect(page.getByRole("heading", { name: "먼저, 내가 나눈 대화를 돌아봐요" })).toBeVisible();
  await page.getByRole("button", { name: /내 생각 정리하기/ }).click();

  await page.getByLabel("내 생각과 까닭").fill("나는 AI 답을 참고할 수 있지만 다른 자료와 비교해야 한다고 생각한다.");
  await page.getByLabel("가장 고민된 반대 의견").fill("AI가 빠르게 답을 준다는 의견이 가장 고민되었다.");
  await page.getByLabel("기술이 작동하는 방식").fill("데이터의 규칙으로 다음 낱말을 예상해 결과를 만든다.");
  await page.getByRole("button", { name: /AI 검토 보기/ }).click();

  await expect(page.getByRole("heading", { name: /AI의 검토를 참고해/ })).toBeVisible();
  await page.getByRole("button", { name: "내 말로 최종 확정하기" }).click();
  await expect(page.getByRole("heading", { name: /나의 AI 윤리 관점/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "내가 실제로 한 말에서 찾았어요" })).toBeVisible();
  await expect(page.getByText("점수·승패 아님")).toBeVisible();
});
