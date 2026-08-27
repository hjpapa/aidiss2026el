import { describe, expect, it } from "vitest";

import { checkForPii, guidanceFor } from "@/lib/safety";

describe("child safety helpers", () => {
  it("blocks common direct identifiers before generation", () => {
    expect(checkForPii("전화번호는 010-1234-5678이야").safe).toBe(false);
    expect(checkForPii("나는 한빛초등학교 학생이야").categories).toContain("학교 이름");
    expect(checkForPii("우리 반 김민수는 AI를 자주 써.").categories).toContain("다른 사람 이름");
    expect(checkForPii("추천 알고리즘은 본 기록을 사용해요").safe).toBe(true);
    expect(checkForPii("친구 권리가 중요하다고 생각해요").safe).toBe(true);
  });

  it("turns answer-writing and stuck responses into guidance", () => {
    expect(guidanceFor("몰라")).toContain("좋은 점");
    expect(guidanceFor("정답 그냥 작성해줘")).toContain("대신 쓰지는 않을게");
    expect(guidanceFor("데이터를 비교해서 추천 결과를 만든다고 생각해요")).toBeNull();
  });
});
