import { expect, test } from "@playwright/test";
import { boardUrl, createFixture, joinBoard, signIn, signOut, type Fixture } from "./helpers";

// 로그인 방식 (PLAN.md 2.1절): 관리자는 Google, 나머지는 이메일만. 비밀번호 없음.

let f: Fixture;
test.beforeEach(async () => {
  f = await createFixture();
});
test.afterEach(async () => {
  await f.cleanup();
});

test("교육생은 보드 URL에서 이름과 이메일만으로 참여하고, 다음에는 이메일만으로 들어온다", async ({ page }) => {
  const email = f.email("student");
  await joinBoard(page, f, "김교육", email);
  await expect(page.getByText("교육생", { exact: true })).toBeVisible();

  // 보드에서 로그아웃하면 그 보드의 입장 화면에 남고, 이메일만 넣으면 (이름을 다시 묻지 않고) 들어간다
  await signOut(page);
  await expect(page).toHaveURL(boardUrl(f));
  await page.getByLabel("이메일").fill(email);
  await page.getByRole("button", { name: "들어가기" }).click();
  await expect(page.getByRole("button", { name: "자료 올리기" })).toBeVisible();

  // 로그인 화면에서 들어와도 된다
  await signOut(page);
  await signIn(page, email);
  // 참여한 보드가 하나면 바로 그 보드로 간다
  await expect(page).toHaveURL(boardUrl(f));
  await expect(page.getByRole("button", { name: "자료 올리기" })).toBeVisible();
});

test("등록되지 않은 이메일은 로그인 화면에서 거부된다", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("이메일").fill(f.email("nobody"));
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByText("등록되지 않은 이메일이에요")).toBeVisible();
});

test("teamsparta 이메일은 이메일로 들어올 수 없고 Google 로그인을 안내한다", async ({ page }) => {
  const email = `fake.${f.tag}@teamsparta.co`;
  await page.goto(boardUrl(f));
  await page.getByLabel("이메일").fill(email);
  await page.getByRole("button", { name: "들어가기" }).click();
  await expect(page.getByText("팀스파르타 계정은 Google 로그인을 이용해 주세요.")).toBeVisible();
  // 입력한 값이 지워지지 않는다
  await expect(page.getByLabel("이메일")).toHaveValue(email);
});
