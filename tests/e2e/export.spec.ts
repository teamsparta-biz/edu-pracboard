import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { createFixture, joinBoard, newPage, registerInstructor, registerViewer, service, signIn, boardUrl, type Fixture } from "./helpers";

// 게시물 내려받기(zip): 관리자·교육 담당자만, 엑셀 목록 + 보기용 HTML + 섹션별 첨부 파일

let f: Fixture;
test.beforeEach(async () => {
  f = await createFixture();
});
test.afterEach(async () => {
  await f.cleanup();
});

// 첨부가 있는 교육생 카드를 DB와 Storage에 바로 만든다
async function seedAttachmentCard(boardId: string, sectionId: string, authorEmail: string, title: string, file: { name: string; type: string; body: string }) {
  const db = service();
  const profile = (await db.from("profiles").select("id, name").eq("email", authorEmail).single()).data!;
  const path = `${boardId}/${profile.id}/${crypto.randomUUID()}`;
  const { error } = await db.storage.from("card-images").upload(path, Buffer.from(file.body), { contentType: file.type });
  if (error) throw error;
  const { error: e2 } = await db.from("cards").insert({
    board_id: boardId,
    section_id: sectionId,
    author_id: profile.id,
    author_name: profile.name,
    title,
    content: "본문 내용",
    attachment_path: path,
    attachment_name: file.name,
    attachment_type: file.type,
    attachment_size: Buffer.byteLength(file.body),
  });
  if (e2) throw e2;
}

// Playwright의 Chromium에서는 저장 위치 창을 띄울 수 없어, 메모리에 모아 내려받는 방식으로 확인한다
async function download(page: Page, button: string) {
  await page.getByRole("button", { name: button }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/게시물 \d+개 · 첨부 파일/)).toBeVisible();
  const [file] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "내려받기" }).click()]);
  await expect(dialog.getByText("내려받기 완료")).toBeVisible();
  return { name: file.suggestedFilename(), entries: unzipSync(new Uint8Array(await readFile((await file.path())!))) };
}

const noPicker = (page: Page) => page.addInitScript(() => delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker);

test("교육 담당자는 보드 게시물을 zip으로 받는다 (엑셀 목록·보기 화면·첨부 파일)", async ({ page, browser }) => {
  const student = f.email("student");
  await joinBoard(page, f, "최교육", student);
  await seedAttachmentCard(f.boardId, f.sectionId, student, "결과 보고서", { name: "보고서 최종.html", type: "text/html", body: "<h1>결과</h1>" });

  const viewerEmail = f.email("viewer");
  await registerViewer(f, viewerEmail);
  const viewer = await (await browser.newContext()).newPage();
  await noPicker(viewer);
  await signIn(viewer, viewerEmail);
  await viewer.goto(boardUrl(f));
  const { name, entries } = await download(viewer, "게시물 내려받기");

  expect(name).toBe(`[E2E 고객사 ${f.tag}] 실습 교육 ${f.tag} 1회차 · 첫 회차 1차시.zip`);
  const root = name.replace(/\.zip$/, "");
  const file = `01_수강생 게시판/001_최교육_결과 보고서.html`;
  expect(Object.keys(entries).sort()).toEqual([`${root}/${file}`, `${root}/게시물 목록.xlsx`, `${root}/게시물 보기.html`].sort());
  expect(strFromU8(entries[`${root}/${file}`])).toBe("<h1>결과</h1>");

  // 엑셀: 게시물 행과 첨부 파일 링크
  const xlsx = unzipSync(entries[`${root}/게시물 목록.xlsx`]);
  const sheet = strFromU8(xlsx["xl/worksheets/sheet1.xml"]);
  expect(sheet).toContain("결과 보고서");
  expect(sheet).toContain("최교육");
  expect(sheet).toContain(`HYPERLINK(&quot;${file}&quot;,&quot;보고서 최종.html&quot;)`);

  // 보기 화면: 카드와 첨부 링크(상대 주소)
  const html = strFromU8(entries[`${root}/게시물 보기.html`]);
  expect(html).toContain("결과 보고서");
  expect(html).toContain(file.split("/").map(encodeURIComponent).join("/"));
  await viewer.context().close();
});

test("관리자는 교육 전체를 회차·차시·교육 보드 폴더로 나눠 받는다", async ({ browser }) => {
  const db = service();
  const studentPage = await (await browser.newContext()).newPage();
  const student = f.email("student");
  await joinBoard(studentPage, f, "최교육", student);
  await seedAttachmentCard(f.boardId, f.sectionId, student, "실습", { name: "결과.txt", type: "text/plain", body: "차시 결과" });
  await studentPage.context().close();

  // 교육 보드 하나 (첨부 없는 카드)
  const eduBoard = (await db.from("boards").insert({ education_id: f.educationId, name: "공지 보드" }).select("id").single()).data!;
  const sec = (await db.from("sections").insert({ board_id: eduBoard.id, position: 1, name: "공지" }).select("id").single()).data!;
  const profile = (await db.from("profiles").select("id").eq("email", student).single()).data!;
  await db.from("cards").insert({ board_id: eduBoard.id, section_id: sec.id, author_id: profile.id, author_name: "최교육", title: "링크만", link: "https://example.com" });

  const admin = await newPage(browser, { admin: true });
  await noPicker(admin);
  await admin.goto(`/admin/educations/${f.educationId}`);
  const { name, entries } = await download(admin, "전체 내려받기");
  const root = name.replace(/\.zip$/, "");
  expect(Object.keys(entries)).toContain(`${root}/1회차 · 첫 회차/1차시/01_수강생 게시판/001_최교육_실습.txt`);
  const sheet = strFromU8(unzipSync(entries[`${root}/게시물 목록.xlsx`])["xl/worksheets/sheet1.xml"]);
  // 여러 보드면 위치 칸이 생기고, 교육 보드가 먼저 온다
  expect(sheet.indexOf("교육 보드 · 공지 보드")).toBeGreaterThan(0);
  expect(sheet.indexOf("교육 보드 · 공지 보드")).toBeLessThan(sheet.indexOf("1회차 · 첫 회차 · 1차시"));
  expect(sheet).toContain("https://example.com");
  await admin.context().close();
});

test("강사와 교육생에게는 내려받기 버튼이 없다", async ({ page, browser }) => {
  await joinBoard(page, f, "최교육", f.email("student"));
  await expect(page.getByRole("button", { name: "게시물 내려받기" })).toHaveCount(0);

  const instructorEmail = f.email("instructor");
  await registerInstructor(f, instructorEmail);
  const instructor = await (await browser.newContext()).newPage();
  await signIn(instructor, instructorEmail);
  await instructor.goto(boardUrl(f));
  await expect(instructor.getByRole("button", { name: "자료 올리기" })).toBeVisible();
  await expect(instructor.getByRole("button", { name: "게시물 내려받기" })).toHaveCount(0);
  await instructor.goto(`/instructor/educations/${f.educationId}`);
  await expect(instructor.getByRole("button", { name: "전체 내려받기" })).toHaveCount(0);
  await instructor.context().close();
});
