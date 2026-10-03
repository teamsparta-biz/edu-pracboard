import { expect, test } from "@playwright/test";
import { boardUrl, createFixture, joinBoard, newPage, registerInstructor, signIn, type Fixture } from "./helpers";

// 같은 보드를 보고 있는 다른 화면에 새로고침 없이 반영된다 (PLAN.md 5.1절)

let f: Fixture;
test.beforeEach(async () => {
  f = await createFixture();
});
test.afterEach(async () => {
  await f.cleanup();
});

test("교육생이 올린 카드가 강사 화면에 새로고침 없이 나타나고, 지우면 사라진다", async ({ browser }) => {
  const tutor = await newPage(browser);
  const tutorEmail = f.email("tutor");
  await registerInstructor(f, tutorEmail);
  await signIn(tutor, tutorEmail);
  await tutor.goto(boardUrl(f));
  await expect(tutor.getByText("· 0개")).toBeVisible();
  // 실시간 채널이 붙을 시간을 준다
  await tutor.waitForTimeout(1500);

  const student = await newPage(browser);
  await joinBoard(student, f, "정교육", f.email("student"));
  await student.getByRole("button", { name: "자료 올리기" }).click();
  await student.getByPlaceholder("자료의 제목을 입력하세요").fill("실시간 카드");
  await student.getByRole("button", { name: "등록하기" }).click();
  await expect(student.getByRole("heading", { name: "실시간 카드" })).toBeVisible();

  await expect(tutor.getByRole("heading", { name: "실시간 카드" })).toBeVisible();

  await student.getByRole("button", { name: "카드 메뉴" }).click();
  await student.getByRole("menuitem", { name: "삭제" }).click();
  await student.getByRole("button", { name: "삭제", exact: true }).click();

  await expect(tutor.getByRole("heading", { name: "실시간 카드" })).toHaveCount(0);
});
