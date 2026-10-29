// RLS 권한 시나리오 테스트. 인메모리 Postgres(PGlite)에 Supabase auth 스텁을 만들고
// supabase/migrations를 순서대로 적용한 뒤, 주체별로 볼 수 있는 것과 할 수 있는 것을 확인한다.
//
//   npm run test:rls

import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(import.meta.dirname, "..", "migrations");
const migrations = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => fs.readFileSync(path.join(dir, f), "utf8"));

const db = new PGlite();

// Supabase auth 스키마 최소 스텁
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text, invited_at timestamptz, encrypted_password text default '',
  raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}'
);
create function auth.jwt() returns jsonb language sql stable as
  $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select (auth.jwt() ->> 'sub')::uuid $$;
grant usage on schema auth to anon, authenticated;
`);
for (const m of migrations) await db.exec(m);
await db.exec(`
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to authenticated;
`);

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};
async function expectError(name, fn, match) {
  try {
    await fn();
    ok(name, false, "(no error)");
  } catch (e) {
    ok(name, !match || e.message.includes(match), `(${e.message})`);
  }
}

// 계정 생성. 앱은 관리자 API로 이메일 계정을 만든다 (GoTrue가 비밀번호 값을 채운다).
// Google로 들어온 관리자는 provider = google.
async function signup(email, { provider = "email" } = {}) {
  const r = await db.query(
    `insert into auth.users (email, encrypted_password, raw_app_meta_data)
     values ($1, $2, $3) returning id`,
    [email, "generated", JSON.stringify({ provider, providers: [provider] })],
  );
  return { id: r.rows[0].id, email, provider };
}

// 사용자 세션으로 쿼리 실행 (RLS 적용)
async function as(user, sql, params = []) {
  const claims = JSON.stringify({
    sub: user.id,
    email: user.email,
    app_metadata: { provider: user.provider, providers: [user.provider] },
  });
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    return tx.query(sql, params);
  });
}

const rows = async (user, sql, params) => (await as(user, sql, params)).rows;

// ── 관리자
const admin = await signup("hahyul.kim@teamsparta.co", { provider: "google" });
ok("가입하면 profiles 자동 생성", (await db.query(`select 1 from public.profiles where id = $1`, [admin.id])).rows.length === 1);

const [{ id: edu }] = await rows(admin, `insert into educations (name) values ('[삼성전자] - 온보딩') returning id`);
const [{ id: edu2 }] = await rows(admin, `insert into educations (name) values ('[LG] - 다른 교육') returning id`);
const [{ id: round }] = await rows(admin, `insert into rounds (education_id, position) values ($1, 1) returning id`, [edu]);
const [{ id: lesson }] = await rows(admin, `insert into lessons (education_id, round_id, position) values ($1, $2, 1) returning id`, [edu, round]);
const [{ id: board }] = await rows(admin, `insert into boards (education_id, lesson_id) values ($1, $2) returning id`, [edu, lesson]);
const [{ id: section }] = await rows(admin, `insert into sections (board_id, position, name) values ($1, 1, '실습') returning id`, [board]);
ok("관리자: 계층·섹션 생성", !!section);
await as(admin, `insert into education_viewers (education_id, email, source) values ($1, 'client@samsung.com', 'manual')`, [edu]);
await as(admin, `insert into board_members (board_id, email, role) values ($1, 'tutor@gmail.com', 'instructor')`, [board]);

// Google이 아닌 방식으로 teamsparta 이메일 세션이 생겨도 관리자가 아님
const fakeAdmin = { id: admin.id, email: "hahyul.kim@teamsparta.co", provider: "email" };
ok("email 로그인의 teamsparta 계정은 관리자 아님", (await rows(fakeAdmin, `select * from educations`)).length === 0);

// ── 고객사 담당자
const client = await signup("client@samsung.com");
const clientEdus = await rows(client, `select id from educations`);
ok("고객사: 본인 교육만 조회", clientEdus.length === 1 && clientEdus[0].id === edu);
ok("고객사: 보드 조회", (await rows(client, `select id from boards`)).length === 1);
await expectError("고객사: 섹션 생성 불가", () => as(client, `insert into sections (board_id, position, name) values ($1, 2, 'x')`, [board]), "row-level security");
await expectError("고객사: 카드 작성 불가", () => as(client, `insert into cards (board_id, section_id, author_id, author_name) values ($1, $2, $3, 'x')`, [board, section, client.id]), "row-level security");
ok("고객사: join_board는 viewer 유지", (await rows(client, `select join_board($1) r`, [board]))[0].r === "viewer");

// ── 강사
const tutor = await signup("tutor@gmail.com");
ok("강사: 섹션 생성", (await rows(tutor, `insert into sections (board_id, position, name) values ($1, 2, '강사 섹션') returning id`, [board])).length === 1);
ok("강사: 교육 계층 이름 조회", (await rows(tutor, `select id from lessons`)).length === 1);
ok("강사: 다른 교육 조회 불가", (await rows(tutor, `select id from educations where id = $1`, [edu2])).length === 0);
await expectError("강사: 강사 추가 불가", () => as(tutor, `insert into board_members (board_id, email, role) values ($1, 'x@gmail.com', 'instructor')`, [board]), "row-level security");

// ── 교육생
const student = await signup("kim@samsung.com");
ok("교육생: 참여 전 보드 안 보임", (await rows(student, `select id from boards`)).length === 0);
ok("교육생: join_board → student", (await rows(student, `select join_board($1) r`, [board]))[0].r === "student");
ok("교육생: 참여 후 보드 보임", (await rows(student, `select id from boards`)).length === 1);
const [{ id: myCard }] = await rows(student, `insert into cards (board_id, section_id, author_id, author_name, title) values ($1, $2, $3, '김', '과제') returning id`, [board, section, student.id]);
ok("교육생: 카드 작성", !!myCard);
await expectError("교육생: 남의 이름으로 카드 작성 불가", () => as(student, `insert into cards (board_id, section_id, author_id, author_name) values ($1, $2, $3, 'x')`, [board, section, tutor.id]), "row-level security");
await expectError("교육생: 섹션 생성 불가", () => as(student, `insert into sections (board_id, position, name) values ($1, 3, 'x')`, [board]), "row-level security");

const [{ id: tutorCard }] = await rows(tutor, `insert into cards (board_id, section_id, author_id, author_name) values ($1, $2, $3, '강사') returning id`, [board, section, tutor.id]);
ok("교육생: 남의 카드 삭제 불가", (await rows(student, `delete from cards where id = $1 returning id`, [tutorCard])).length === 0);
ok("교육생: 본인 카드 삭제", (await rows(student, `delete from cards where id = $1 returning id`, [myCard])).length === 1);
ok("강사: 남의 카드 삭제", (await rows(tutor, `delete from cards where id = $1 returning id`, [tutorCard])).length === 1);

// ── 하트·댓글: 카드를 올릴 수 있는 사람만 남기고, 교육 담당자는 보기만 한다
const [{ id: likeCard }] = await rows(student, `insert into cards (board_id, section_id, author_id, author_name, title) values ($1, $2, $3, '김', '하트용') returning id`, [board, section, student.id]);
const like = (user, as_ = user) => as(as_, `insert into card_likes (card_id, board_id, user_id) values ($1, $2, $3)`, [likeCard, board, user.id]);
await like(student);
await like(tutor);
ok("하트: 교육생·강사 누르기", (await rows(admin, `select 1 from card_likes where card_id = $1`, [likeCard])).length === 2);
await expectError("하트: 교육 담당자 누르기 불가", () => like(client), "row-level security");
await expectError("하트: 남의 이름으로 누르기 불가", () => like(admin, student), "row-level security");
ok("하트: 교육 담당자도 수는 봄", (await rows(client, `select 1 from card_likes where card_id = $1`, [likeCard])).length === 2);
ok("하트: 남의 하트 취소 불가", (await rows(student, `delete from card_likes where user_id = $1 returning card_id`, [tutor.id])).length === 0);
ok("하트: 본인 하트 취소", (await rows(student, `delete from card_likes where user_id = $1 returning card_id`, [student.id])).length === 1);

const student2 = await signup("lee@samsung.com");
await as(student2, `select join_board($1)`, [board]);
const comment = (user, text) =>
  rows(user, `insert into card_comments (card_id, board_id, author_id, author_name, content) values ($1, $2, $3, 'x', $4) returning id`, [likeCard, board, user.id, text]);
const [{ id: c1 }] = await comment(student, "질문 있어요");
const [{ id: c2 }] = await comment(student2, "좋아요");
const [{ id: c3 }] = await comment(student2, "하나 더");
ok("댓글: 교육생 작성", !!c1 && !!c2);
await expectError("댓글: 교육 담당자 작성 불가", () => comment(client, "x"), "row-level security");
await expectError("댓글: 빈 댓글 불가", () => comment(student, "   "), "check constraint");
ok("댓글: 교육 담당자도 읽기", (await rows(client, `select id from card_comments`)).length === 3);
ok("댓글: 남의 댓글 삭제 불가", (await rows(student, `delete from card_comments where id = $1 returning id`, [c2])).length === 0);
ok("댓글: 본인 댓글 삭제", (await rows(student, `delete from card_comments where id = $1 returning id`, [c1])).length === 1);
ok("댓글: 강사는 교육생 댓글 삭제", (await rows(tutor, `delete from card_comments where id = $1 returning id`, [c2])).length === 1);
ok("댓글 수정 불가 (수정 정책 없음)", (await rows(student2, `update card_comments set content = 'x' where id = $1 returning id`, [c3])).length === 0);
await as(tutor, `insert into card_likes (card_id, board_id, user_id) values ($1, $2, $3) on conflict do nothing`, [likeCard, board, tutor.id]);
await as(student, `delete from cards where id = $1`, [likeCard]);
ok("카드를 지우면 하트·댓글도 지워짐", (await db.query(`select 1 from card_likes union all select 1 from card_comments`)).rows.length === 0);

// ── 고정 카드: 관리자·강사가 올린 카드만 고정되고, 아무도 바꿀 수 없다
const pinnedOf = async (id) => (await db.query(`select pinned from cards where id = $1`, [id])).rows[0].pinned;
const [{ id: staffCard }] = await rows(tutor, `insert into cards (board_id, section_id, author_id, author_name) values ($1, $2, $3, '강사') returning id`, [board, section, tutor.id]);
const [{ id: adminCard }] = await rows(admin, `insert into cards (board_id, section_id, author_id, author_name) values ($1, $2, $3, '관리자') returning id`, [board, section, admin.id]);
const [{ id: fakePin }] = await rows(student, `insert into cards (board_id, section_id, author_id, author_name, pinned) values ($1, $2, $3, '김', true) returning id`, [board, section, student.id]);
ok("고정: 강사 카드", (await pinnedOf(staffCard)) === true);
ok("고정: 관리자 카드", (await pinnedOf(adminCard)) === true);
ok("고정: 교육생이 pinned=true로 넣어도 고정 안 됨", (await pinnedOf(fakePin)) === false);
await as(student, `update cards set pinned = true where id = $1`, [fakePin]);
await as(tutor, `update cards set pinned = false where id = $1`, [staffCard]);
ok("고정: 수정으로 바꿀 수 없음", (await pinnedOf(fakePin)) === false && (await pinnedOf(staffCard)) === true);
await db.query(`delete from cards where id = any($1)`, [[staffCard, adminCard, fakePin]]);

// ── 외부인
const outsider = await signup("who@naver.com");
ok("외부인: 교육 조회 불가", (await rows(outsider, `select id from educations`)).length === 0);
ok("외부인: 카드 조회 불가", (await rows(outsider, `select id from cards`)).length === 0);
await expectError("외부인: 권한 테이블 직접 추가 불가", () => as(outsider, `insert into board_members (board_id, email, role) values ($1, 'who@naver.com', 'instructor')`, [board]), "row-level security");

// ── 데이터 정합성
const [{ id: otherLesson }] = await rows(admin, `insert into lessons (education_id, round_id, position) values ($1, $2, 2) returning id`, [edu, round]);
const [{ id: otherBoard }] = await rows(admin, `insert into boards (education_id, lesson_id) values ($1, $2) returning id`, [edu, otherLesson]);
const [{ id: integrityCard }] = await rows(admin, `insert into cards (board_id, section_id, author_id, author_name) values ($1, $2, $3, 'x') returning id`, [board, section, admin.id]);
await expectError("다른 보드 이름으로 하트 넣기 불가", () => as(admin, `insert into card_likes (card_id, board_id, user_id) values ($1, $2, $3)`, [integrityCard, otherBoard, admin.id]), "foreign key");
await expectError("다른 보드 이름으로 댓글 넣기 불가", () => as(admin, `insert into card_comments (card_id, board_id, author_id, author_name, content) values ($1, $2, $3, 'x', 'x')`, [integrityCard, otherBoard, admin.id]), "foreign key");
await expectError("다른 보드의 섹션에 카드 넣기 불가", () => as(admin, `insert into cards (board_id, section_id, author_id, author_name) values ($1, $2, $3, 'x')`, [otherBoard, section, admin.id]), "foreign key");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
