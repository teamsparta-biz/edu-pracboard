import { expect, test } from "@playwright/test";
import { createFixture, newPage, signIn, type Fixture } from "./helpers";

// 관리자 (테스트 전용 로그인으로 만든 Google 관리자 세션을 쓴다)

let manual: Fixture;
let synced: Fixture;
test.beforeEach(async () => {
  manual = await createFixture();
  synced = await createFixture({ synced: true });
});
test.afterEach(async () => {
  await manual.cleanup();
  await synced.cleanup();
});

test("관리자는 전체 교육과 axhub 동기화 칸을 본다", async ({ browser }) => {
  const admin = await newPage(browser, { admin: true });
  await admin.goto("/admin");
  await expect(admin.getByText("관리자", { exact: true })).toBeVisible();
  await expect(admin.getByText("axhub 동기화")).toBeVisible();
  await expect(admin.getByRole("button", { name: "지금 동기화" })).toBeVisible();
  await admin.getByPlaceholder("기업명 또는 교육명으로 검색").fill(manual.tag);
  await expect(admin.getByRole("heading", { name: `실습 교육 ${manual.tag}` })).toBeVisible();
});

test("관리자가 등록한 고객사 담당자는 이메일만으로 그 교육을 본다", async ({ browser }) => {
  const admin = await newPage(browser, { admin: true });
  await admin.goto(`/admin/educations/${manual.educationId}`);
  const viewer = manual.email("viewer");
  await admin.getByRole("button", { name: "고객사 담당자 0명" }).click();
  await admin.getByPlaceholder("담당자 이메일 (예: hr@company.com)").fill(viewer);
  await admin.getByRole("button", { name: "등록" }).click();
  await expect(admin.getByText(viewer)).toBeVisible();

  const page = await newPage(browser);
  await signIn(page, viewer);
  await expect(page).toHaveURL("/client");
  await expect(page.getByRole("heading", { name: `실습 교육 ${manual.tag}` })).toBeVisible();
});

test("axhub에서 온 교육은 회차를 만들거나 고칠 수 없고, 직접 만든 교육은 할 수 있다", async ({ browser }) => {
  const admin = await newPage(browser, { admin: true });

  await admin.goto(`/admin/educations/${synced.educationId}`);
  await expect(admin.getByText("진행 중")).toBeVisible();
  await expect(admin.getByRole("button", { name: "회차 만들기" })).toHaveCount(0);
  await expect(admin.getByRole("button", { name: "더 보기" })).toHaveCount(0);

  await admin.goto(`/admin/educations/${manual.educationId}`);
  await expect(admin.getByRole("button", { name: "회차 만들기" })).toBeVisible();
  await admin.getByRole("button", { name: "회차 만들기" }).click();
  await admin.getByPlaceholder("회차 제목을 입력하세요").fill("추가 회차");
  await admin.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(admin.getByRole("heading", { name: "2회차 · 추가 회차" })).toBeVisible();
});
