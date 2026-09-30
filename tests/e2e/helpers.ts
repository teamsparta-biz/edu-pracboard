import { expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";

// E2E 공용 도구. 테스트 데이터는 service role로 직접 만들고, 각 테스트가 끝나면 지운다.
// 모든 이메일·이름에 실행마다 다른 꼬리표를 붙여 테스트끼리 섞이지 않게 한다.

export const PRODUCTION_PROJECT_REF = "akmkalrrxcotdygsybpp";
// 테스트는 저장소 루트에서 실행한다 (npm run test:e2e)
export const ADMIN_STATE = path.join(process.cwd(), "tests", "e2e", ".auth", "admin.json");

export function service() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(),
    { auth: { persistSession: false } },
  );
}

async function must<T>(query: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("결과가 없어요");
  return data as NonNullable<T>;
}

// 돌려받을 행이 없는 쓰기
async function run(query: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export type Fixture = {
  tag: string;
  educationId: string;
  educationName: string;
  roundId: string;
  lessonId: string;
  boardId: string;
  sectionId: string;
  email: (who: string) => string;
  cleanup: () => Promise<void>;
};

// 교육 → 회차 → 차시 → 보드 → 섹션 하나씩. synced면 axhub에서 온 교육처럼 만든다.
export async function createFixture({ synced = false } = {}): Promise<Fixture> {
  const db = service();
  const tag = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const educationName = `[E2E] 실습 교육 ${tag}`;

  const company = await must(db.from("companies").insert({ name: `E2E 고객사 ${tag}` }).select("id").single());
  const education = await must(
    db
      .from("educations")
      .insert({ name: educationName, company_id: company.id, ...(synced ? { axhub_course_id: crypto.randomUUID(), status: "operation" } : {}) })
      .select("id")
      .single(),
  );
  const round = await must(
    db
      .from("rounds")
      .insert({ education_id: education.id, position: 1, title: synced ? "" : "첫 회차", ...(synced ? { axhub_round_id: crypto.randomUUID() } : {}) })
      .select("id")
      .single(),
  );
  const lesson = await must(
    db
      .from("lessons")
      .insert({ education_id: education.id, round_id: round.id, position: 1, description: "실습 차시", ...(synced ? { axhub_key: `${round.id}:${tag}` } : {}) })
      .select("id")
      .single(),
  );
  const board = await must(db.from("boards").insert({ education_id: education.id, lesson_id: lesson.id }).select("id").single());
  const section = await must(db.from("sections").insert({ board_id: board.id, position: 1, name: "수강생 게시판" }).select("id").single());

  const emails = new Set<string>();
  const email = (who: string) => {
    const e = `${who}.${tag}@e2e.test`;
    emails.add(e);
    return e;
  };

  return {
    tag,
    educationId: education.id,
    educationName,
    roundId: round.id,
    lessonId: lesson.id,
    boardId: board.id,
    sectionId: section.id,
    email,
    cleanup: async () => {
      // 첨부 파일 → 교육(보드·카드는 함께 지워짐) → 고객사 → 테스트 계정
      const storage = db.storage.from("card-images");
      const { data: folders } = await storage.list(board.id);
      for (const folder of folders ?? []) {
        const { data: files } = await storage.list(`${board.id}/${folder.name}`);
        if (files?.length) await storage.remove(files.map((f) => `${board.id}/${folder.name}/${f.name}`));
      }
      await db.from("educations").delete().eq("id", education.id);
      await db.from("companies").delete().eq("id", company.id);
      const { data: profiles } = await db.from("profiles").select("id").in("email", [...emails]);
      for (const p of profiles ?? []) await db.auth.admin.deleteUser(p.id);
    },
  };
}

export async function registerViewer(f: Fixture, email: string) {
  await run(service().from("education_viewers").insert({ education_id: f.educationId, email, source: "manual" }));
}

export async function registerInstructor(f: Fixture, email: string) {
  await run(service().from("board_members").insert({ board_id: f.boardId, email, role: "instructor" }));
}

// 교육생 카드를 DB에 바로 만든다 (다른 사람 카드가 필요한 테스트용)
export async function seedCard(f: Fixture, authorEmail: string, title: string) {
  const db = service();
  const profile = await must(db.from("profiles").select("id, name").eq("email", authorEmail).single());
  await run(
    db.from("cards").insert({ board_id: f.boardId, section_id: f.sectionId, author_id: profile.id, author_name: profile.name, title }),
  );
}

export const boardUrl = (f: Fixture) => `/b/${f.boardId}`;

// 보드 URL에서 이름과 이메일로 참여 (교육생)
export async function joinBoard(page: Page, f: Fixture, name: string, email: string) {
  await page.goto(boardUrl(f));
  await page.getByLabel("이름").fill(name);
  await page.getByLabel("이메일").fill(email);
  await page.getByRole("button", { name: "참여하기" }).click();
  await expect(page.getByRole("button", { name: "자료 올리기" })).toBeVisible();
}

// 로그인 화면에서 이메일만으로 로그인 (강사·고객사 담당자·교육생)
export async function signIn(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("이메일").fill(email);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/");
}

export async function signOut(page: Page) {
  await page.getByRole("banner").getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "로그아웃" }).click();
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
}

export async function newPage(browser: Browser, { admin = false } = {}) {
  const context = await browser.newContext(admin ? { storageState: ADMIN_STATE } : {});
  return context.newPage();
}
