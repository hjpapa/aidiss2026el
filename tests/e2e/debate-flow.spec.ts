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
  const recommendedOpponent = page.locator(".opponent-card.is-recommended");
  await expect(recommendedOpponent.getByText("추천", { exact: true })).toBeVisible();
  await expect(recommendedOpponent).toContainText("포리");
  await recommendedOpponent.getByRole("radio").check();
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

  const myThinking = "나는 AI 답을 참고할 수 있지만 다른 자료와 비교해야 한다고 생각한다.";
  const counterpoint = "AI가 빠르게 답을 준다는 의견이 가장 고민되었다.";
  const technical = "데이터의 규칙으로 다음 낱말을 예상해 결과를 만든다.";
  await page.getByLabel("내 생각과 까닭").fill(myThinking);
  await page.getByLabel("가장 고민된 반대 의견").fill(counterpoint);
  await page.getByLabel("기술이 작동하는 방식").fill(technical);
  await page.getByRole("button", { name: /1단계 · 대화 다시 보기/ }).click();
  const conversationHeading = page.getByRole("heading", { name: "먼저, 내가 나눈 대화를 돌아봐요" });
  await expect(conversationHeading).toBeVisible();
  await expect(conversationHeading).toBeFocused();
  await page.getByRole("button", { name: /내 생각 정리하기/ }).click();
  await expect(page.getByRole("heading", { name: "이제 내 생각을 내 말로 적어요" })).toBeFocused();
  await expect(page.getByLabel("내 생각과 까닭")).toHaveValue(myThinking);
  await expect(page.getByLabel("가장 고민된 반대 의견")).toHaveValue(counterpoint);
  await expect(page.getByLabel("기술이 작동하는 방식")).toHaveValue(technical);
  await page.getByRole("button", { name: /AI 검토 보기/ }).click();

  await expect(page.getByRole("heading", { name: /AI의 검토를 참고해/ })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("현재 토론은 이 기기에만 저장");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "내 말로 최종 확정하기" }).click();
  await expect(page.getByRole("heading", { name: /나의 AI 윤리 관점/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "내가 실제로 한 말에서 찾았어요" })).toBeVisible();
  await expect(page.getByText("점수·승패 아님")).toBeVisible();
  await page.route("**/api/sessions/**/insights", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        insights: {
          status: "ready",
          thoughtStatus: "ready",
          periodDays: 29,
          petRatios: [
            { petId: "lumi", percent: 30 },
            { petId: "toto", percent: 20 },
            { petId: "pori", percent: 15 },
            { petId: "momo", percent: 15 },
            { petId: "hari", percent: 10 },
            { petId: "duri", percent: 10 },
          ],
          thoughts: [
            {
              topicId: "ai-answer-trust",
              text: "AI가 빠르게 도와줘도 다른 자료와 비교하는 규칙이 필요하다고 생각해요.",
            },
          ],
        },
      }),
    });
  });
  await page.getByRole("button", { name: "친구들의 생각 보기" }).click();
  await expect(page.getByRole("heading", { name: "우리 토론 모음에는 어떤 관점이 있을까요?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "완료된 토론에는 어떤 관점 펫이 있었을까요?" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "루미 비율" })).toHaveAttribute("aria-valuenow", "30");
  const sharedThought = page.locator(".community-thought-list li").first();
  await expect(sharedThought).toContainText("다른 자료와 비교하는 규칙");
  await expect(sharedThought.locator("small")).toContainText("숙제 마감");
  await page.getByRole("button", { name: "내 토론 결과로 돌아가기" }).click();
  const resultHeading = page.getByRole("heading", { name: /나의 AI 윤리 관점/ });
  await expect(resultHeading).toBeVisible();
  await expect(resultHeading).toBeFocused();
});
