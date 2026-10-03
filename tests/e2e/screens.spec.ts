import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { boardUrl, createFixture, joinBoard, newPage, registerInstructor, registerViewer, service, signIn, type Fixture } from "./helpers";

// 화면 QA용 캡처. 평소 테스트에는 포함되지 않는다.
//   QA_SCREENS=1 npx playwright test screens
// test-results/screens/<화면>-<desktop|mobile>.png 로 저장한다.

test.skip(!process.env.QA_SCREENS, "QA_SCREENS=1 일 때만 실행");
test.setTimeout(300_000);

const OUT = path.join(process.cwd(), "test-results", "screens");
const SIZES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;

let f: Fixture;
let second: Fixture;
let divisionLessonId: string;
let divisionBoardId: string;

// 실제와 비슷한 데이터: 긴 파일 이름, 긴 내용, 이미지 카드, 분반 있는 차시, 섹션 여러 개
test.beforeAll(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  f = await createFixture();
  second = await createFixture();
  const db = service();

  const { data: lesson } = await db
    .from("lessons")
    .insert({ education_id: f.educationId, round_id: f.roundId, position: 2, description: "11/9(월) 09:00–17:00" })
    .select("id")
    .single();
  divisionLessonId = lesson!.id;
  for (const [i, name] of ["A반", "B반", "C반"].entries()) {
    const { data: d } = await db.from("divisions").insert({ education_id: f.educationId, lesson_id: lesson!.id, position: i + 1, name }).select("id").single();
    const { data: b } = await db.from("boards").insert({ education_id: f.educationId, lesson_id: lesson!.id, division_id: d!.id }).select("id").single();
    await db.from("sections").insert({ board_id: b!.id, position: 1, name: "수강생 게시판" });
    if (i === 0) divisionBoardId = b!.id;
  }
  await db.from("sections").insert({ board_id: f.boardId, position: 2, name: "교안 자료" });
});

test.afterAll(async () => {
  await f?.cleanup();
  await second?.cleanup();
});

async function shoot(page: Page, name: string) {
  for (const [label, size] of Object.entries(SIZES)) {
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${name}-${label}.png`), fullPage: true });
  }
  await page.setViewportSize(SIZES.desktop);
}

const svg = (label: string, color: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" font-size="48" text-anchor="middle" fill="white" font-family="sans-serif">${label}</text></svg>`,
  );

test("화면 캡처", async ({ browser }) => {
  // ── 로그인 전
  const anon = await newPage(browser);
  await anon.goto("/");
  await shoot(anon, "01-login");
  await anon.goto(boardUrl(f));
  await shoot(anon, "02-join");
  await anon.getByLabel("이메일").fill(f.email("newcomer"));
  await anon.getByRole("button", { name: "들어가기" }).click();
  await expect(anon.getByLabel("이름")).toBeVisible();
  await shoot(anon, "03-join-name-step");
  await anon.goto("/b/00000000-0000-0000-0000-000000000000");
  await shoot(anon, "04-board-not-found");

  // ── 교육생: 카드 여러 장 올리기
  const student = await newPage(browser);
  const studentEmail = f.email("student");
  await joinBoard(student, f, "최신입", studentEmail);
  const post = async (title: string, content: string, file?: { name: string; mimeType: string; buffer: Buffer }, link?: string) => {
    await student.getByRole("button", { name: "자료 올리기" }).click();
    await student.getByPlaceholder("자료의 제목을 입력하세요").fill(title);
    if (file) await student.locator('input[type="file"]').setInputFiles(file);
    await student.getByPlaceholder("아름다운 내용을 적어보세요...").fill(content);
    if (link) await student.getByPlaceholder("https://").fill(link);
    if (title.startsWith("사업자")) await shoot(student, "10-card-form-long-filename");
    await student.getByRole("button", { name: "등록하기" }).click();
    await expect(student.getByRole("heading", { name: title })).toBeVisible();
  };
  await post("조직 문화 인포그래픽", "부서별 협업 구조와 커뮤니케이션 채널을 한눈에 볼 수 있게 정리했습니다.", { name: "infographic.svg", mimeType: "image/svg+xml", buffer: svg("인포그래픽", "#1c2b8f") });
  await post(
    "사업자등록증 제출",
    "매우 긴 내용이 들어간 카드입니다. ".repeat(12),
    { name: "(주)화승네트웍스 사업자등록증(부산본사)_20251117_최종본_검토완료_v3.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
    "https://example.com/very/long/path/that/keeps/going/and/going/for/a/while/to/test/wrapping",
  );
  await post("링크만 있는 카드", "", undefined, "https://www.notion.so/teamsparta/실습-결과물-정리");
  await post("두 번째 이미지", "짧은 설명", { name: "photo.svg", mimeType: "image/svg+xml", buffer: svg("실습 사진", "#2f7d32") });
  await shoot(student, "11-board-student");

  await student.getByRole("heading", { name: "사업자등록증 제출" }).click();
  await shoot(student, "12-card-detail-file");
  await student.keyboard.press("Escape");
  await student.getByRole("heading", { name: "조직 문화 인포그래픽" }).click();
  await shoot(student, "13-card-detail-image");
  await student.keyboard.press("Escape");

  await student.getByRole("button", { name: "카드 메뉴" }).first().click();
  await shoot(student, "14-card-menu");
  await student.getByRole("menuitem", { name: "삭제" }).click();
  await shoot(student, "15-confirm-delete");
  await student.getByRole("button", { name: "취소" }).click();

  // 두 번째 보드에도 참여 → "내 보드" 목록
  await student.goto(boardUrl(second));
  await shoot(student, "16-join-prompt-logged-in");
  await student.getByRole("button", { name: "참여하기" }).click();
  await expect(student.getByRole("button", { name: "자료 올리기" })).toBeVisible();
  await student.goto("/");
  await shoot(student, "17-my-boards");

  // ── 강사
  const tutor = await newPage(browser);
  const tutorEmail = f.email("tutor");
  await registerInstructor(f, tutorEmail);
  await signIn(tutor, tutorEmail);
  await shoot(tutor, "19-instructor-home");
  await tutor.goto(boardUrl(f));
  await shoot(tutor, "20-board-instructor");
  await tutor.getByRole("button", { name: "섹션 관리" }).click();
  await shoot(tutor, "21-section-menu");
  await tutor.getByRole("menuitem", { name: "섹션 추가" }).click();
  await shoot(tutor, "22-section-form");
  await tutor.keyboard.press("Escape");

  // ── 고객사 담당자
  const viewer = await newPage(browser);
  const viewerEmail = f.email("viewer");
  await registerViewer(f, viewerEmail);
  await signIn(viewer, viewerEmail);
  await shoot(viewer, "30-client-home");
  await viewer.goto(`/client/educations/${f.educationId}`);
  await shoot(viewer, "31-client-education");
  await viewer.goto(boardUrl(f));
  await shoot(viewer, "32-board-viewer");

  // ── 관리자
  const admin = await newPage(browser, { admin: true });
  await admin.goto("/admin");
  await shoot(admin, "40-admin-home");
  await admin.goto(`/admin/educations/${f.educationId}`);
  await shoot(admin, "41-admin-education");
  await admin.getByRole("button", { name: /고객사 담당자 \d+명/ }).click();
  await shoot(admin, "42-viewer-roster");
  await admin.keyboard.press("Escape");
  await admin.getByRole("button", { name: "회차 만들기" }).click();
  await shoot(admin, "43-round-form");
  await admin.keyboard.press("Escape");
  await admin.goto(`/admin/educations/${f.educationId}/rounds/${f.roundId}`);
  await shoot(admin, "44-admin-round");
  await admin.goto(`/admin/educations/${f.educationId}/rounds/${f.roundId}/lessons/${divisionLessonId}`);
  await shoot(admin, "45-admin-divisions");
  await admin.goto(boardUrl(f));
  await shoot(admin, "46-board-admin");
  await admin.getByRole("button", { name: /강사 \d+명/ }).click();
  await shoot(admin, "47-instructor-roster");
  await admin.keyboard.press("Escape");
  await admin.goto(`/b/${divisionBoardId}`);
  await shoot(admin, "48-board-division-empty");
});
