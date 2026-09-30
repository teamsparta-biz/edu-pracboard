import { expect, test } from "@playwright/test";
import {
  boardUrl,
  createFixture,
  joinBoard,
  newPage,
  registerInstructor,
  registerViewer,
  seedCard,
  signIn,
  type Fixture,
} from "./helpers";

// 주체별로 보이는 것과 할 수 있는 것 (PLAN.md 2절, 5.1절)

let f: Fixture;
let other: Fixture;
test.beforeEach(async () => {
  f = await createFixture();
  other = await createFixture();
});
test.afterEach(async () => {
  await f.cleanup();
  await other.cleanup();
});

test("고객사 담당자는 등록된 교육만 읽기 전용으로 보고, 관리자 화면에는 못 들어간다", async ({ page }) => {
  const viewer = f.email("viewer");
  await registerViewer(f, viewer);
  await signIn(page, viewer);

  await expect(page).toHaveURL("/client");
  await expect(page.getByRole("heading", { name: `실습 교육 ${f.tag}` })).toBeVisible();
  await expect(page.getByText(`실습 교육 ${other.tag}`)).toHaveCount(0);

  await page.goto(boardUrl(f));
  await expect(page.getByText("읽기 전용").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "자료 올리기" })).toHaveCount(0);

  await page.goto("/admin");
  await expect(page).toHaveURL("/client");
});

test("강사는 섹션을 관리하고 교육생 카드도 지울 수 있다", async ({ browser }) => {
  const student = await newPage(browser);
  const studentEmail = f.email("student");
  await joinBoard(student, f, "박교육", studentEmail);
  await seedCard(f, studentEmail, "교육생 과제");

  const tutor = await newPage(browser);
  const tutorEmail = f.email("tutor");
  await registerInstructor(f, tutorEmail);
  await signIn(tutor, tutorEmail);
  await expect(tutor).toHaveURL(boardUrl(f));
  await expect(tutor.getByText("강사", { exact: true })).toBeVisible();
  await expect(tutor.getByRole("button", { name: "섹션 추가" })).toBeVisible();

  await tutor.getByRole("button", { name: "카드 메뉴" }).click();
  await expect(tutor.getByRole("menuitem", { name: "삭제" })).toBeVisible();
});

test("교육생은 다른 사람 카드를 고칠 수 없고 섹션도 관리할 수 없다", async ({ browser }) => {
  const author = await newPage(browser);
  const authorEmail = f.email("author");
  await joinBoard(author, f, "작성자", authorEmail);
  await seedCard(f, authorEmail, "남의 카드");

  const student = await newPage(browser);
  await joinBoard(student, f, "다른교육생", f.email("student"));
  await expect(student.getByText("남의 카드")).toBeVisible();
  await expect(student.getByRole("button", { name: "카드 메뉴" })).toHaveCount(0);
  await expect(student.getByRole("button", { name: "섹션 추가" })).toHaveCount(0);
});

test("다른 보드의 교육생은 이 보드 내용을 볼 수 없고 참여 여부를 묻는다", async ({ browser }) => {
  const author = await newPage(browser);
  const authorEmail = f.email("author");
  await joinBoard(author, f, "작성자", authorEmail);
  await seedCard(f, authorEmail, "비공개 카드");

  const outsider = await newPage(browser);
  await joinBoard(outsider, other, "외부인", other.email("outsider"));
  await outsider.goto(boardUrl(f));
  await expect(outsider.getByRole("button", { name: "참여하기" })).toBeVisible();
  await expect(outsider.getByText("비공개 카드")).toHaveCount(0);
});
