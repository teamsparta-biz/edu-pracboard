import { expect, test } from "@playwright/test";
import { createFixture, joinBoard, registerInstructor, registerViewer, seedCard, service, signIn, boardUrl, type Fixture } from "./helpers";

// 2026-10-29 QA 요구사항: 하트·댓글, 섹션 바로 이동, 드래그 앤 드롭 업로드, 관리자·강사 카드 상단 고정

let f: Fixture;
test.beforeEach(async () => {
  f = await createFixture();
});
test.afterEach(async () => {
  await f.cleanup();
});

test("교육생은 하트를 누르고 댓글을 달고, 교육 담당자는 보기만 한다", async ({ page, browser }) => {
  const studentEmail = f.email("student");
  await joinBoard(page, f, "최교육", studentEmail);
  await seedCard(f, studentEmail, "하트 받을 카드");
  await page.reload();

  // 하트: 누르면 바로 채워지고, 다시 누르면 취소된다
  await page.getByRole("button", { name: "하트 누르기 (0개)" }).click();
  await expect(page.getByRole("button", { name: "하트 취소 (1개)" })).toBeVisible();

  // 댓글: 카드를 열어 Enter로 등록
  await page.getByRole("heading", { name: "하트 받을 카드" }).click();
  await page.getByLabel("댓글", { exact: true }).fill("잘 봤어요");
  await page.getByLabel("댓글", { exact: true }).press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("잘 봤어요")).toBeVisible();
  await expect(dialog.getByText("최교육", { exact: true }).last()).toBeVisible();
  // 카드를 닫아도 보드에서 최근 댓글이 보인다
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("최근 댓글").getByText("잘 봤어요")).toBeVisible();

  // 교육 담당자: 수와 댓글은 보이지만 누르거나 쓸 수 없다
  const viewerEmail = f.email("viewer");
  await registerViewer(f, viewerEmail);
  const viewer = await (await browser.newContext()).newPage();
  await signIn(viewer, viewerEmail);
  await viewer.goto(boardUrl(f));
  await expect(viewer.getByLabel("하트 1개")).toBeVisible();
  await expect(viewer.getByLabel("최근 댓글").getByText("잘 봤어요")).toBeVisible();
  await expect(viewer.getByRole("button", { name: /하트 (누르기|취소)/ })).toHaveCount(0);
  await viewer.getByRole("heading", { name: "하트 받을 카드" }).click();
  await expect(viewer.getByRole("dialog").getByText("잘 봤어요")).toBeVisible();
  await expect(viewer.getByLabel("댓글", { exact: true })).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "댓글 삭제" })).toHaveCount(0);
  await viewer.context().close();
});

test("섹션 목록에서 원하는 섹션으로 바로 가고, 보드에 파일을 끌어다 놓으면 파일이 붙은 창이 열린다", async ({ page }) => {
  const db = service();
  await db.from("sections").insert([
    { board_id: f.boardId, position: 2, name: "두 번째" },
    { board_id: f.boardId, position: 3, name: "세 번째" },
  ]);
  await joinBoard(page, f, "최교육", f.email("student"));

  // 섹션 탭: 한 번에 원하는 섹션으로 간다
  await expect(page.getByRole("tab")).toHaveText(["수강생 게시판0", "두 번째0", "세 번째0"]);
  await page.getByRole("tab", { name: /세 번째/ }).click();
  await expect(page.getByRole("tab", { name: /세 번째/ })).toHaveAttribute("aria-selected", "true");
  // 키보드 화살표로도 옮겨 다닌다
  await page.getByRole("tab", { name: /세 번째/ }).press("ArrowLeft");
  await expect(page.getByRole("tab", { name: /두 번째/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /두 번째/ }).press("End");

  const file = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["결과물"], "드롭-결과.txt", { type: "text/plain" }));
    return dt;
  });
  const board = page.getByRole("heading", { name: "1차시" });
  await board.dispatchEvent("dragenter", { dataTransfer: file });
  await expect(page.getByText('여기에 놓으면 "세 번째" 섹션에 올릴 수 있어요')).toBeVisible();
  await board.dispatchEvent("drop", { dataTransfer: file });

  await expect(page.getByPlaceholder("자료의 제목을 입력하세요")).toHaveValue("드롭-결과");
  await expect(page.getByText("드롭-결과.txt")).toBeVisible();
  await page.getByRole("button", { name: "등록하기" }).click();
  await expect(page.getByRole("heading", { name: "드롭-결과" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /세 번째/ })).toHaveText("세 번째1");
});

test("강사가 올린 카드는 교육생 카드보다 나중에 올려도 섹션 맨 앞에 고정된다", async ({ page }) => {
  const studentEmail = f.email("student");
  await joinBoard(page, f, "최교육", studentEmail);
  await seedCard(f, studentEmail, "교육생 결과물");

  const tutorEmail = f.email("tutor");
  await registerInstructor(f, tutorEmail);
  await page.context().clearCookies();
  await signIn(page, tutorEmail);
  await page.goto(boardUrl(f));
  for (const title of ["1. 교안", "2. 실습 안내"]) {
    await page.getByRole("button", { name: "자료 올리기" }).click();
    await page.getByPlaceholder("자료의 제목을 입력하세요").fill(title);
    await page.getByRole("button", { name: "등록하기" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }

  await expect(page.getByRole("heading", { level: 3 })).toHaveText(["1. 교안", "2. 실습 안내", "교육생 결과물"]);
  await expect(page.getByText("고정", { exact: true })).toHaveCount(2);
});

// 2026-11-02: 고정 카드 순서 바꾸기, HTML 미리보기

test("강사는 고정 카드끼리 끌어다 놓아 순서를 바꾸고, 교육생은 끌 수 없다", async ({ page, browser }) => {
  const tutorEmail = f.email("tutor");
  await registerInstructor(f, tutorEmail);
  await signIn(page, tutorEmail);
  await page.goto(boardUrl(f));
  for (const title of ["1. 교안", "2. 실습 안내", "3. 과제"]) {
    await page.getByRole("button", { name: "자료 올리기" }).click();
    await page.getByPlaceholder("자료의 제목을 입력하세요").fill(title);
    await page.getByRole("button", { name: "등록하기" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  const titles = page.getByRole("heading", { level: 3 });
  await expect(titles).toHaveText(["1. 교안", "2. 실습 안내", "3. 과제"]);

  await page.getByRole("heading", { name: "3. 과제" }).dragTo(page.getByRole("heading", { name: "1. 교안" }));
  await expect(titles).toHaveText(["3. 과제", "1. 교안", "2. 실습 안내"]);
  // 저장됐는지: 새로 읽어도 같은 순서
  await page.reload();
  await expect(titles).toHaveText(["3. 과제", "1. 교안", "2. 실습 안내"]);

  const student = await (await browser.newContext()).newPage();
  await joinBoard(student, f, "최교육", f.email("student"));
  await expect(student.getByRole("heading", { level: 3 })).toHaveText(["3. 과제", "1. 교안", "2. 실습 안내"]);
  await expect(student.locator("[draggable=true]")).toHaveCount(0);
  await student.context().close();
});

test("HTML 결과물은 격리된 창에 미리보기로 보인다", async ({ page }) => {
  await joinBoard(page, f, "최교육", f.email("student"));
  await page.getByRole("button", { name: "자료 올리기" }).click();
  await page.getByPlaceholder("자료의 제목을 입력하세요").fill("내 웹페이지");
  const html = `<!doctype html><meta charset="utf-8"><h1 id="t">안녕 PracBoard</h1>
<script>let r; try { r = parent.document.title ? "탈출" : "?"; } catch { r = "격리됨"; } document.getElementById("t").textContent += " " + r;</script>`;
  await page.locator('input[type="file"]').setInputFiles({ name: "index.html", mimeType: "text/html", buffer: Buffer.from(html) });
  await page.getByRole("button", { name: "등록하기" }).click();
  await expect(page.getByRole("heading", { name: "내 웹페이지" })).toBeVisible();

  // 카드 썸네일: 화면만 그리고 스크립트는 돌리지 않는다 (2026-11-05)
  const thumb = page.frameLocator('iframe[title="내 웹페이지"]').first();
  await expect(thumb.getByRole("heading")).toHaveText("안녕 PracBoard");

  // 상세: 스크립트가 돌지만 보드 화면에는 접근하지 못한다
  await page.getByRole("heading", { name: "내 웹페이지" }).click();
  await expect(page.getByRole("dialog").frameLocator("iframe").getByRole("heading")).toHaveText("안녕 PracBoard 격리됨");
});

test("무한 반복하는 HTML을 올려도 보드 목록은 멈추지 않는다", async ({ page }) => {
  await joinBoard(page, f, "최교육", f.email("student"));
  await page.getByRole("button", { name: "자료 올리기" }).click();
  await page.getByPlaceholder("자료의 제목을 입력하세요").fill("멈추는 페이지");
  const html = `<!doctype html><meta charset="utf-8"><h1>반복</h1><script>for (;;) {}</script>`;
  await page.locator('input[type="file"]').setInputFiles({ name: "loop.html", mimeType: "text/html", buffer: Buffer.from(html) });
  await page.getByRole("button", { name: "등록하기" }).click();
  await expect(page.frameLocator('iframe[title="멈추는 페이지"]').first().getByRole("heading")).toHaveText("반복");

  // 보드 화면이 계속 반응한다
  const responsive = await Promise.race([
    page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(true)))),
    new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
  ]);
  expect(responsive).toBe(true);
  await page.getByRole("button", { name: "자료 올리기" }).click();
  await expect(page.getByPlaceholder("자료의 제목을 입력하세요")).toBeVisible();
});

test("한글·공백·괄호가 든 파일 이름이 그대로 내려받아진다", async ({ page }) => {
  await joinBoard(page, f, "최교육", f.email("student"));
  await page.getByRole("button", { name: "자료 올리기" }).click();
  await page.getByPlaceholder("자료의 제목을 입력하세요").fill("보고서");
  // 맥에서 올린 파일처럼 자모가 분리된(NFD) 이름
  const name = "실습 보고서 (최종) #1.txt";
  await page.locator('input[type="file"]').setInputFiles({ name: name.normalize("NFD"), mimeType: "text/plain", buffer: Buffer.from("결과") });
  await page.getByRole("button", { name: "등록하기" }).click();
  await page.getByRole("heading", { name: "보고서" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "내려받기" }).click()]);
  expect(download.suggestedFilename()).toBe(name);
});

// 2026-11-03: 고정 켜고 끄기, 다중 선택

test("강사는 카드 메뉴로 교육생 카드를 고정·해제하고, 여러 장을 골라 한꺼번에 고정하고 지운다", async ({ page, browser }) => {
  const studentEmail = f.email("student");
  const student = await (await browser.newContext()).newPage();
  await joinBoard(student, f, "최교육", studentEmail);
  for (const title of ["가 결과물", "나 결과물", "다 결과물", "라 결과물"]) await seedCard(f, studentEmail, title);

  const tutorEmail = f.email("tutor");
  await registerInstructor(f, tutorEmail);
  await signIn(page, tutorEmail);
  await page.goto(boardUrl(f));
  const titles = page.getByRole("heading", { level: 3 });
  await expect(titles).toHaveText(["가 결과물", "나 결과물", "다 결과물", "라 결과물"]);

  // 카드 메뉴: 교육생 카드를 고정하면 맨 앞으로, 풀면 올린 순서 자리로
  const menuOf = (title: string) => page.getByRole("heading", { name: title }).locator("xpath=ancestor::div[contains(@class,'group')][1]").getByRole("button", { name: "카드 메뉴" });
  await page.getByRole("heading", { name: "다 결과물" }).hover();
  await menuOf("다 결과물").click();
  await page.getByRole("menuitem", { name: "상단 고정" }).click();
  await expect(titles).toHaveText(["다 결과물", "가 결과물", "나 결과물", "라 결과물"]);
  await expect(page.getByText("고정", { exact: true })).toHaveCount(1);
  await page.getByRole("heading", { name: "다 결과물" }).hover();
  await menuOf("다 결과물").click();
  await page.getByRole("menuitem", { name: "고정 해제" }).click();
  await expect(titles).toHaveText(["가 결과물", "나 결과물", "다 결과물", "라 결과물"]);

  // 다중 선택: 두 장 고정 → 고정된 순서는 보이던 순서 그대로
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await page.getByRole("checkbox", { name: "나 결과물 선택" }).click();
  await page.getByRole("checkbox", { name: "라 결과물 선택" }).click();
  const bar = page.getByRole("toolbar", { name: "선택한 카드" });
  await expect(bar.getByText("2개 선택")).toBeVisible();
  await bar.getByRole("button", { name: "고정", exact: true }).click();
  await expect(titles).toHaveText(["나 결과물", "라 결과물", "가 결과물", "다 결과물"]);

  // 다중 선택: 세 장 지우기 (카드를 눌러도 열리지 않고 선택만 바뀐다)
  for (const t of ["나 결과물", "가 결과물", "다 결과물"]) await page.getByRole("checkbox", { name: `${t} 선택` }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await bar.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(titles).toHaveText(["라 결과물"]);
  await expect(bar).toHaveCount(0);
  await expect(student.getByRole("heading", { level: 3 })).toHaveText(["라 결과물"]);

  // 교육생: 선택 버튼도, 고정 메뉴도 없다
  await expect(student.getByRole("button", { name: "선택", exact: true })).toHaveCount(0);
  await seedCard(f, studentEmail, "내 카드");
  await student.reload();
  await student.getByRole("heading", { name: "내 카드" }).hover();
  await student.getByRole("heading", { name: "내 카드" }).locator("xpath=ancestor::div[contains(@class,'group')][1]").getByRole("button", { name: "카드 메뉴" }).click();
  await expect(student.getByRole("menuitem", { name: "수정" })).toBeVisible();
  await expect(student.getByRole("menuitem", { name: /고정/ })).toHaveCount(0);
  await student.context().close();
});
