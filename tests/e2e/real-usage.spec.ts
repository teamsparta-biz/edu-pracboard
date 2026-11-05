import { expect, test, type Page } from "@playwright/test";
import {
  boardUrl,
  createFixture,
  joinBoard,
  registerInstructor,
  service,
  signIn,
  signOut,
  type Fixture,
} from "./helpers";

// 실제 수업에서 생길 만한 상황 (2026-11-05). 기능별 테스트가 다루지 않는, 사람들이 실제로 하는 행동을 따라간다.

let f: Fixture;
test.beforeEach(async () => {
  f = await createFixture();
});
test.afterEach(async () => {
  await f.cleanup();
});

// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function postCard(page: Page, title: string, fields: { content?: string; link?: string; file?: Parameters<Page["setInputFiles"]>[1] } = {}) {
  await page.getByRole("button", { name: "자료 올리기" }).click();
  await page.getByPlaceholder("자료의 제목을 입력하세요").fill(title);
  if (fields.content) await page.getByPlaceholder("원하는 내용을 작성해 주세요.").fill(fields.content);
  if (fields.link) await page.getByPlaceholder("https://").fill(fields.link);
  if (fields.file) await page.locator('input[type="file"]').setInputFiles(fields.file);
  await page.getByRole("button", { name: "등록하기" }).click();
}

const cardCount = async () => {
  const { count } = await service().from("cards").select("id", { count: "exact", head: true }).eq("board_id", f.boardId);
  return count ?? 0;
};

test("회사 방화벽이 브라우저의 Supabase 로그인 요청을 막아도 서버가 대신 확인해 들어온다", async ({ page }) => {
  // 로그인 확인은 브라우저가 Supabase에 직접 한다(사람마다 IP를 나누려고). 막혀 있으면 서버가 대신한다.
  let blocked = 0;
  await page.route("**/auth/v1/verify**", (route) => {
    blocked++;
    return route.abort("connectionrefused");
  });
  await joinBoard(page, f, "방화벽", f.email("firewall"));
  expect(blocked).toBeGreaterThan(0);
});

test("휴대폰 자판이 이메일 첫 글자를 대문자로 바꾸고 공백을 붙여도 같은 계정으로 들어온다", async ({ page }) => {
  const email = f.email("student");
  // 휴대폰에서 흔한 입력: 첫 글자 대문자, 끝에 공백
  const typed = ` ${email.charAt(0).toUpperCase()}${email.slice(1)} `;
  await joinBoard(page, f, "김교육", typed);

  await signOut(page);
  await signIn(page, email);
  await expect(page).toHaveURL(boardUrl(f));
  await expect(page.getByRole("button", { name: "자료 올리기" })).toBeVisible();

  const { count } = await service().from("profiles").select("id", { count: "exact", head: true }).ilike("email", email);
  expect(count).toBe(1);
});

test("여러 차시에 참여한 교육생은 다음 차시 URL에서 참여를 확인하고, 로그인하면 내 보드 목록에서 고른다", async ({ page }) => {
  const db = service();
  const { data: lesson2 } = await db
    .from("lessons")
    .insert({ education_id: f.educationId, round_id: f.roundId, position: 2, description: "둘째 날" })
    .select("id")
    .single();
  const { data: board2 } = await db.from("boards").insert({ education_id: f.educationId, lesson_id: lesson2!.id }).select("id").single();
  await db.from("sections").insert({ board_id: board2!.id, position: 1, name: "수강생 게시판" });

  const email = f.email("student");
  await joinBoard(page, f, "김교육", email);

  // 로그인한 채로 둘째 날 보드 URL에 들어오면 참여를 묻는다
  await page.goto(`/b/${board2!.id}`);
  await expect(page.getByText("2차시 보드에 참여할까요?")).toBeVisible();
  await page.getByRole("button", { name: "참여하기" }).click();
  await expect(page.getByRole("heading", { name: "2차시" })).toBeVisible();
  await postCard(page, "둘째 날 결과물");
  await expect(page.getByRole("heading", { name: "둘째 날 결과물" })).toBeVisible();

  // 다른 날 로그인 화면으로 들어오면 두 보드 중에서 고른다
  await signOut(page);
  await page.goto("/");
  await page.getByLabel("이메일").fill(email);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("heading", { name: "내 보드" })).toBeVisible();
  await expect(page.getByRole("link", { name: /1차시/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /2차시/ })).toBeVisible();
  await page.getByRole("link", { name: /1차시/ }).click();
  await expect(page).toHaveURL(boardUrl(f));
});

test("메신저로 받은 보드 URL 끝에 괄호나 마침표가 붙어 와도 그 보드로 들어간다", async ({ page }) => {
  for (const tail of [")", ".", "%20"]) {
    await page.goto(`${boardUrl(f)}${tail}`);
    await expect(page).toHaveURL(boardUrl(f));
    await expect(page.getByRole("button", { name: "들어가기" })).toBeVisible();
  }
  // 아예 잘린 주소는 오류 화면이 아니라 안내가 나온다
  await page.goto(`/b/${f.boardId.slice(0, 20)}`);
  await expect(page.getByText("보드를 찾을 수 없어요")).toBeVisible();
});

test("https 없이 넣은 링크도 외부 사이트로 열리고, 웹 주소가 아닌 링크는 저장하지 않는다", async ({ page }) => {
  await joinBoard(page, f, "김교육", f.email("student"));

  await postCard(page, "내 깃허브", { link: "github.com/teamsparta" });
  await expect(page.getByRole("heading", { name: "내 깃허브" })).toBeVisible();
  await expect(page.getByRole("link", { name: /github\.com\/teamsparta/ })).toHaveAttribute("href", "https://github.com/teamsparta");

  await postCard(page, "이상한 링크", { link: "javascript:alert(document.cookie)" });
  await expect(page.getByRole("heading", { name: "이상한 링크" })).toBeVisible();
  const { data } = await service().from("cards").select("link").eq("board_id", f.boardId).eq("title", "이상한 링크").single();
  expect(data?.link).toBeNull();
});

test("휴대폰(390px)에서 사진을 올리고, 붙여 넣은 코드는 글자 그대로 보이며 화면이 옆으로 넘치지 않는다", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("dialog", (d) => {
    throw new Error(`붙여 넣은 코드가 실행됐어요: ${d.message()}`);
  });
  await joinBoard(page, f, "김교육", f.email("student"));

  // 자료 올리기 창의 등록 버튼이 화면 안에 있어야 누를 수 있다
  await page.getByRole("button", { name: "자료 올리기" }).click();
  await page.getByPlaceholder("자료의 제목을 입력하세요").fill("화이트보드 사진");
  await page.locator('input[type="file"]').setInputFiles({ name: "IMG_0001.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "등록하기" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "등록하기" })).toBeInViewport();
  await page.getByRole("button", { name: "등록하기" }).click();
  await expect(page.getByRole("img", { name: "화이트보드 사진" })).toBeVisible();

  // 실습 코드를 그대로 붙여 넣는 경우: 태그, 여러 줄, 띄어쓰기 없는 긴 문자열
  const code = [
    '<script>alert("xss")</script>',
    "<img src=x onerror=alert(1)>",
    "def solve():",
    "    return 42",
    "https://example.com/" + "a".repeat(300),
  ].join("\n");
  await postCard(page, "과제 코드 " + "가".repeat(80), { content: code });
  await expect(page.getByRole("heading", { name: /과제 코드/ })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("heading", { name: /과제 코드/ }).click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByText('<script>alert("xss")</script>')).toBeVisible();
  // 줄바꿈과 들여쓰기가 유지된다
  await expect(detail.getByText("def solve():\n    return 42", { exact: false })).toBeVisible();
  const dialogOverflow = await detail.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(dialogOverflow).toBeLessThanOrEqual(0);
  await context.close();
});

test("아이폰 사진(HEIC)과 한글 문서(.hwp)는 깨진 그림 대신 파일로 보이고 원래 이름으로 내려받아진다", async ({ page }) => {
  await joinBoard(page, f, "김교육", f.email("student"));

  // 크롬은 HEIC를 그리지 못한다
  await postCard(page, "현장 사진", { file: { name: "IMG_1234.HEIC", mimeType: "image/heic", buffer: Buffer.from("heic") } });
  await expect(page.getByRole("heading", { name: "현장 사진" })).toBeVisible();
  await expect(page.getByRole("img", { name: "현장 사진" })).toHaveCount(0);
  await expect(page.getByText("IMG_1234.HEIC")).toBeVisible();

  // 한글(.hwp)은 브라우저가 파일 형식을 모르는 경우가 많다
  await postCard(page, "결과 보고", { file: { name: "결과 보고서.hwp", mimeType: "", buffer: Buffer.from("hwp") } });
  await expect(page.getByRole("heading", { name: "결과 보고" })).toBeVisible();
  await expect(page.getByText("결과 보고서.hwp")).toBeVisible();
  await page.getByRole("heading", { name: "결과 보고" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "내려받기" }).click()]);
  expect(download.suggestedFilename()).toBe("결과 보고서.hwp");
});

test("큰 휴대폰 사진은 보드 목록에서 작은 미리보기로 보이고, 카드를 열면 원본을 보며, 지우면 둘 다 지워진다", async ({ page }) => {
  await joinBoard(page, f, "김교육", f.email("student"));
  // 휴대폰 사진처럼 크고 압축이 잘 안 되는 이미지 (3000×2000 무작위 점)
  const base64 = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement("canvas"), { width: 3000, height: 2000 });
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(3000, 2000);
    for (let i = 0; i < img.data.length; i++) img.data[i] = (i & 3) === 3 ? 255 : Math.random() * 256;
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const photo = Buffer.from(base64, "base64");
  expect(photo.length).toBeGreaterThan(1_000_000);

  await postCard(page, "실습 사진", { file: { name: "IMG_0001.jpg", mimeType: "image/jpeg", buffer: photo } });
  const thumb = page.getByRole("img", { name: "실습 사진" });
  await expect(thumb).toBeVisible();

  const { data: card } = await service().from("cards").select("attachment_path, attachment_thumb_path").eq("board_id", f.boardId).single();
  expect(card!.attachment_thumb_path).toBeTruthy();
  const folder = card!.attachment_path.split("/").slice(0, 2).join("/");
  const { data: files } = await service().storage.from("card-images").list(folder);
  const size = (path: string) => files!.find((x) => `${folder}/${x.name}` === path)!.metadata!.size as number;
  expect(size(card!.attachment_thumb_path)).toBeLessThan(size(card!.attachment_path) / 5);
  // 목록은 미리보기, 상세는 원본
  expect(await thumb.getAttribute("src")).toContain(card!.attachment_thumb_path.split("/").pop());
  await thumb.click();
  expect(await page.getByRole("dialog").getByRole("img", { name: "실습 사진" }).getAttribute("src")).toContain(
    card!.attachment_path.split("/").pop(),
  );
  await page.keyboard.press("Escape");

  // 카드를 지우면 원본과 미리보기가 모두 지워진다
  await page.getByRole("button", { name: "카드 메뉴" }).click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByRole("heading", { name: "실습 사진" })).toHaveCount(0);
  await expect.poll(async () => (await service().storage.from("card-images").list(folder)).data?.length ?? 0).toBe(0);
});

test("올리는 중에 인터넷이 끊기면 오류를 알려 주고, 빈 카드나 남는 파일이 생기지 않는다", async ({ page }) => {
  await joinBoard(page, f, "김교육", f.email("student"));
  await page.route("**/storage/v1/object/upload/sign/**", (route) => route.abort("internetdisconnected"));

  await postCard(page, "끊긴 업로드", { file: { name: "영상.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(1024) } });
  await expect(page.getByText("파일을 올리지 못했어요.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "끊긴 업로드" })).toHaveCount(0);
  expect(await cardCount()).toBe(0);
  const { data: folders } = await service().storage.from("card-images").list(f.boardId);
  expect(folders ?? []).toHaveLength(0);

  // 다시 연결되면 올릴 수 있다
  await page.unroute("**/storage/v1/object/upload/sign/**");
  await postCard(page, "다시 올림", { file: { name: "영상.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(1024) } });
  await expect(page.getByRole("heading", { name: "다시 올림" })).toBeVisible();
});

test("수업 중 교육생 여러 명이 동시에 올려도 모두 올라가고, 강사 화면에 새로고침 없이 모두 보인다", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const STUDENTS = 6;

  const tutorEmail = f.email("tutor");
  await registerInstructor(f, tutorEmail);
  await signIn(page, tutorEmail);
  await page.goto(boardUrl(f));
  await expect(page.getByRole("button", { name: "자료 올리기" })).toBeVisible();

  const students = await Promise.all(
    Array.from({ length: STUDENTS }, async (_, i) => {
      const context = await browser.newContext();
      const p = await context.newPage();
      await joinBoard(p, f, `교육생${i + 1}`, f.email(`student${i + 1}`), { timeout: 30_000 });
      return p;
    }),
  );

  // 같은 순간에 올린다
  await Promise.all(
    students.map((p, i) =>
      postCard(p, `동시 결과물 ${i + 1}`, { file: { name: `결과${i + 1}.png`, mimeType: "image/png", buffer: PNG } }),
    ),
  );
  await expect.poll(cardCount, { timeout: 30_000 }).toBe(STUDENTS);

  await expect(page.getByRole("heading", { name: /^동시 결과물/ })).toHaveCount(STUDENTS, { timeout: 30_000 });
  await expect(page.getByRole("tab", { name: /수강생 게시판/ })).toHaveText(`수강생 게시판${STUDENTS}`);
  // 교육생끼리도 서로의 결과물이 보인다
  await expect(students[0].getByRole("heading", { name: /^동시 결과물/ })).toHaveCount(STUDENTS, { timeout: 30_000 });

  await Promise.all(students.map((p) => p.context().close()));
});

test("수업 중 보드가 없어지면(차시 취소) 교육생에게 오류 화면 대신 안내가 나온다", async ({ page }) => {
  await joinBoard(page, f, "김교육", f.email("student"));

  // 창을 열어 쓰고 있는 사이에 보드가 지워진다
  await page.getByRole("button", { name: "자료 올리기" }).click();
  await page.getByPlaceholder("자료의 제목을 입력하세요").fill("늦게 올린 결과물");
  await service().from("boards").delete().eq("id", f.boardId);
  await page.getByRole("button", { name: "등록하기" }).click();
  await expect(page.getByText("권한이 없거나 요청을 처리하지 못했어요.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("보드를 찾을 수 없어요")).toBeVisible();
});
