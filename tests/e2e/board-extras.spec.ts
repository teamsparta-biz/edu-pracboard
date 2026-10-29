import { expect, test } from "@playwright/test";
import { createFixture, joinBoard, registerViewer, seedCard, service, signIn, boardUrl, type Fixture } from "./helpers";

// 2026-10-29 QA 요구사항: 하트·댓글, 섹션 바로 이동, 드래그 앤 드롭 업로드

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

  // 교육 담당자: 수와 댓글은 보이지만 누르거나 쓸 수 없다
  const viewerEmail = f.email("viewer");
  await registerViewer(f, viewerEmail);
  const viewer = await (await browser.newContext()).newPage();
  await signIn(viewer, viewerEmail);
  await viewer.goto(boardUrl(f));
  await expect(viewer.getByLabel("하트 1개")).toBeVisible();
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

  await page.getByRole("button", { name: "수강생 게시판" }).click();
  await page.getByRole("menuitem", { name: /세 번째/ }).click();
  await expect(page.getByText("3/3")).toBeVisible();

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
  await expect(page.getByText("1개 · 3/3")).toBeVisible();
});
