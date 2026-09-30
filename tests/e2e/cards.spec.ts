import { expect, test } from "@playwright/test";
import { createFixture, joinBoard, service, type Fixture } from "./helpers";

// 카드 작성·수정·삭제와 첨부 파일 (PLAN.md 5.1절)

let f: Fixture;
test.beforeEach(async () => {
  f = await createFixture();
});
test.afterEach(async () => {
  await f.cleanup();
});

const storedFiles = async () => {
  const storage = service().storage.from("card-images");
  const { data: folders } = await storage.list(f.boardId);
  let count = 0;
  for (const folder of folders ?? []) count += ((await storage.list(`${f.boardId}/${folder.name}`)).data ?? []).length;
  return count;
};

test("교육생이 파일을 붙여 카드를 올리고, 첨부를 바꿔 수정하고, 확인 후 지운다", async ({ page }) => {
  await joinBoard(page, f, "최교육", f.email("student"));

  // 올리기 (한글 이름 문서)
  await page.getByRole("button", { name: "자료 올리기" }).click();
  await page.getByPlaceholder("자료의 제목을 입력하세요").fill("실습 결과");
  await page.locator('input[type="file"]').setInputFiles({ name: "실습-보고서.txt", mimeType: "text/plain", buffer: Buffer.from("결과물") });
  await expect(page.getByText("실습-보고서.txt")).toBeVisible();
  await page.getByRole("button", { name: "등록하기" }).click();
  await expect(page.getByRole("heading", { name: "실습 결과" })).toBeVisible();
  await expect(page.getByText("실습-보고서.txt")).toBeVisible();
  expect(await storedFiles()).toBe(1);

  // 수정: 제목과 첨부 교체 (이전 파일은 지워진다)
  await page.getByRole("button", { name: "카드 메뉴" }).click();
  await page.getByRole("menuitem", { name: "수정" }).click();
  await expect(page.getByPlaceholder("자료의 제목을 입력하세요")).toHaveValue("실습 결과");
  await page.getByPlaceholder("자료의 제목을 입력하세요").fill("실습 결과 (수정)");
  await page.locator('input[type="file"]').setInputFiles({ name: "최종본.txt", mimeType: "text/plain", buffer: Buffer.from("최종") });
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(page.getByRole("heading", { name: "실습 결과 (수정)" })).toBeVisible();
  await expect(page.getByText("최종본.txt")).toBeVisible();
  await expect.poll(storedFiles).toBe(1);

  // 삭제: 확인 창을 거친다
  await page.getByRole("button", { name: "카드 메뉴" }).click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await expect(page.getByText("카드를 삭제할까요?")).toBeVisible();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByRole("heading", { name: "실습 결과 (수정)" })).toHaveCount(0);
  await expect.poll(storedFiles).toBe(0);
});
