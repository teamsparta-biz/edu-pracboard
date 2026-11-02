import { expect, test } from "@playwright/test";
import { createFixture, newPage, service, signIn, type Fixture } from "./helpers";

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
  await admin.getByRole("button", { name: "교육 담당자 0명" }).click();
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

// 2026-11-02: 회차·차시 없이 교육에 바로 붙는 보드. axhub 교육에도 관리자가 직접 만들 수 있다.
test("관리자는 axhub 교육에 교육 보드를 만들고, 교육생은 그 URL로 참여하고, 교육 담당자는 읽기만 한다", async ({ browser }) => {
  const admin = await newPage(browser, { admin: true });
  await admin.goto(`/admin/educations/${synced.educationId}`);
  await admin.getByRole("button", { name: "보드 만들기" }).click();
  await expect(admin.getByRole("heading", { name: "교육 보드 만들기" })).toBeVisible();
  await admin.getByPlaceholder("보드 제목을 입력하세요").fill("공통 과제 보드");
  await admin.getByPlaceholder("보드에 대한 설명을 입력하세요").fill("회차와 상관없이 쓰는 보드");
  await admin.getByRole("button", { name: "만들기", exact: true }).click();
  const row = admin.getByRole("link", { name: /공통 과제 보드/ });
  await expect(row).toBeVisible();

  // 이름 바꾸기
  await row.getByRole("button", { name: "더 보기" }).click();
  await admin.getByRole("menuitem", { name: "수정" }).click();
  await admin.getByPlaceholder("보드 제목을 입력하세요").fill("공통 과제");
  await admin.getByRole("button", { name: "저장" }).click();
  await expect(admin.getByRole("link", { name: /공통 과제 회차와/ })).toBeVisible();

  // 보드 화면: 회차·차시 대신 보드 이름
  await admin.getByRole("link", { name: /공통 과제 회차와/ }).click();
  await expect(admin.getByRole("heading", { level: 1, name: "공통 과제" })).toBeVisible();
  await expect(admin.getByText("회차와 상관없이 쓰는 보드")).toBeVisible();
  const boardUrl = new URL(admin.url()).pathname;
  expect(boardUrl).toMatch(/^\/b\//);

  // 교육생: URL로 참여해 카드를 올린다
  const student = await newPage(browser);
  await student.goto(boardUrl);
  await expect(student.getByText("공통 과제", { exact: true })).toBeVisible();
  await student.getByLabel("이메일").fill(synced.email("student"));
  await student.getByRole("button", { name: "들어가기" }).click();
  await student.getByLabel("이름").fill("최교육");
  await student.getByRole("button", { name: "참여하기" }).click();
  await student.getByRole("button", { name: "자료 올리기" }).click();
  await student.getByPlaceholder("자료의 제목을 입력하세요").fill("과제 제출");
  await student.getByRole("button", { name: "등록하기" }).click();
  await expect(student.getByRole("heading", { name: "과제 제출" })).toBeVisible();

  // 교육 담당자: 교육 화면에서 교육 보드가 보이고, 고치는 메뉴는 없다
  const viewerEmail = synced.email("viewer");
  await service().from("education_viewers").insert({ education_id: synced.educationId, email: viewerEmail, source: "manual" });
  const viewer = await newPage(browser);
  await signIn(viewer, viewerEmail);
  await viewer.goto(`/client/educations/${synced.educationId}`);
  const viewerRow = viewer.getByRole("link", { name: /공통 과제/ });
  await expect(viewerRow).toContainText("자료 1");
  await expect(viewerRow.getByRole("button", { name: "더 보기" })).toHaveCount(0);

  // 삭제
  await admin.goto(`/admin/educations/${synced.educationId}`);
  await admin.getByRole("link", { name: /공통 과제/ }).getByRole("button", { name: "더 보기" }).click();
  await admin.getByRole("menuitem", { name: "삭제" }).click();
  await admin.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(admin.getByText("아직 교육 보드가 없어요.")).toBeVisible();
});
