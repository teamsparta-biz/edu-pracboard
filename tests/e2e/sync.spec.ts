import { expect, test, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";
import { ADMIN_STATE, PRODUCTION_PROJECT_REF, service } from "./helpers";

// axhub 동기화 (PLAN.md 3.1절). axhub 대신 E2E DB에 같은 모양의 가짜 pracboard 스키마를 만들어 두고
// 동기화 주소(/api/cron/axhub-sync)를 불러 결과를 본다 (playwright.config.ts가 AXHUB_DATABASE_URL을 E2E DB로 돌린다).
// 운영자 실수로 axhub에서 회차·차시·교육이 사라져도 카드가 있으면 보관했다가 30일 뒤에 지우는지 확인한다.

const dbUrl = (process.env.DATABASE_URL ?? "").trim();
if (dbUrl.includes(PRODUCTION_PROJECT_REF)) throw new Error("운영 DB에는 가짜 axhub를 만들지 않아요.");
const sql = postgres(dbUrl, { prepare: false, max: 1, onnotice: () => {} });

test.afterAll(async () => {
  await sql.end();
});

const FAKE_AXHUB = `
  create schema if not exists pracboard;
  create table if not exists pracboard.courses (id uuid primary key, title text, status text, client_name text, client_contact_email text);
  create table if not exists pracboard.course_rounds (id uuid primary key, course_id uuid, round_number int, status text);
  create table if not exists pracboard.course_sessions (
    id uuid primary key, round_id uuid, date date, start_time double precision, end_time double precision,
    name text, commitment text, window_end date);
  create table if not exists pracboard.instructors (id uuid primary key, email text, auth_email text);
  create table if not exists pracboard.assignments (course_session_id uuid, instructor_id uuid);
`;

async function runSync(request: APIRequestContext) {
  const res = await request.get("/api/cron/axhub-sync", { headers: { authorization: `Bearer ${process.env.CRON_SECRET?.trim()}` } });
  return { status: res.status(), body: await res.json() };
}

test("axhub에서 사라져도 카드가 있는 보드·교육은 보관했다가 돌아오면 제자리로, 30일이 지나면 지운다", async ({ request, browser }) => {
  test.setTimeout(180_000);
  await sql.unsafe(FAKE_AXHUB);
  const course = crypto.randomUUID();
  const other = crypto.randomUUID(); // 교육이 모두 사라진 것으로 보이지 않게 하나 더 둔다
  const round = crypto.randomUUID();
  const [s1, s2] = [crypto.randomUUID(), crypto.randomUUID()];
  const db = service();
  const email = `sync.${Date.now().toString(36)}@e2e.test`;
  const { data: user } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name: "보관" } });

  const boardOf = async (session: string) =>
    (await db.from("boards").select("id, lesson_id, name, axhub_missing_since").eq("axhub_session_id", session).maybeSingle()).data;
  const education = async () =>
    (await db.from("educations").select("id, axhub_missing_since").eq("axhub_course_id", course).maybeSingle()).data;

  try {
    await sql`insert into pracboard.courses values (${course}, ${"[E2E] 동기화 보관"}, 'operation', null, null), (${other}, ${"[E2E] 동기화 다른 교육"}, 'operation', null, null)`;
    await sql`insert into pracboard.course_rounds values (${round}, ${course}, 1, 'active')`;
    await sql`insert into pracboard.course_sessions values
      (${s1}, ${round}, '2026-12-01', 9, 12, null, null, null),
      (${s2}, ${round}, '2026-12-02', 9, 12, null, null, null)`;
    expect((await runSync(request)).status).toBe(200);

    // 1차시 보드에만 카드를 올린다
    const first = (await boardOf(s1))!;
    const { data: section } = await db.from("sections").select("id").eq("board_id", first.id).single();
    await db.from("cards").insert({ board_id: first.id, section_id: section!.id, author_id: user.user!.id, author_name: "보관", title: "지키고 싶은 결과물" });

    // 운영자가 회차의 차시 두 개를 지움 → 빈 보드는 지우고, 카드가 있는 보드는 교육 보드로 떼어 보관
    await sql`delete from pracboard.course_sessions where round_id = ${round}`;
    const removed = await runSync(request);
    expect(removed.status).toBe(200);
    expect(removed.body.held.boards).toBe(1);
    expect(await boardOf(s2)).toBeNull();
    const held = (await boardOf(s1))!;
    expect(held).toMatchObject({ id: first.id, lesson_id: null, name: "1회차 · 1차시" });
    expect(held.axhub_missing_since).not.toBeNull();

    // 관리자는 교육 화면에서 영구 삭제 예정을 본다
    const admin = await (await browser.newContext({ storageState: ADMIN_STATE })).newPage();
    await admin.goto(`/admin/educations/${(await education())!.id}`);
    await expect(admin.getByText(/axhub에서 삭제된 차시 · \d+\/\d+에 영구 삭제/)).toBeVisible();

    // 되돌리면 같은 보드(같은 URL, 같은 카드)가 차시로 돌아온다
    await sql`insert into pracboard.course_sessions values (${s1}, ${round}, '2026-12-01', 9, 12, null, null, null)`;
    expect((await runSync(request)).status).toBe(200);
    const back = (await boardOf(s1))!;
    expect(back).toMatchObject({ id: first.id, name: null, axhub_missing_since: null });
    expect(back.lesson_id).not.toBeNull();

    // 교육이 통째로 사라져도 카드가 있으면 보관하고, 화면에 삭제 예정이 보인다
    await sql`delete from pracboard.courses where id = ${course}`;
    expect((await runSync(request)).status).toBe(200);
    expect((await education())!.axhub_missing_since).not.toBeNull();
    await admin.goto("/admin");
    await expect(admin.getByText(/axhub에서 삭제됨 · \d+\/\d+ 영구 삭제/).first()).toBeVisible();

    // 보관 기간(30일)이 지나면 지운다
    const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    await db.from("educations").update({ axhub_missing_since: longAgo }).eq("axhub_course_id", course);
    expect((await runSync(request)).status).toBe(200);
    expect(await education()).toBeNull();
    expect((await db.from("cards").select("id").eq("board_id", first.id)).data).toEqual([]);

    // axhub에서 교육을 하나도 못 읽으면(뷰 변경·권한 문제) 아무것도 지우지 않고 멈춘다
    await sql`delete from pracboard.courses where id = ${other}`;
    const empty = await runSync(request);
    expect(empty.status).toBe(500);
    expect(empty.body.error).toContain("하나도 읽지 못해");
    expect((await db.from("educations").select("id").eq("axhub_course_id", other)).data).toHaveLength(1);
  } finally {
    await sql`delete from pracboard.course_sessions where round_id = ${round}`;
    await sql`delete from pracboard.course_rounds where id = ${round}`;
    await sql`delete from pracboard.courses where id in (${course}, ${other})`;
    await db.from("educations").delete().in("axhub_course_id", [course, other]);
    if (user.user) await db.auth.admin.deleteUser(user.user.id);
  }
});
