import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_IMAGE_BUCKET } from "@/lib/storage";
import { notifyBoards } from "@/lib/board-events";
import { AXHUB_HOLD_DAYS } from "@/lib/education";
import { planLessons, planWindowBoard, type PlannedLesson } from "./plan";
import { readAxhub } from "./source";

// axhub → PracBoard 동기화 (PLAN.md 3절). axhub가 원본이다.
//   - 새 교육은 준비 중·진행 중만 가져오고, 한 번 가져온 교육은 상태가 바뀌어도 계속 맞춘다.
//   - axhub에서 사라진(또는 취소된) 교육·회차·차시는 PracBoard에서도 지운다. 보드·카드·첨부까지 지워진다.
//     단, 카드가 있는 교육·보드는 AXHUB_HOLD_DAYS 동안 보관했다가 지운다. 그 사이 axhub에 다시 나타나면 원래대로 돌아간다.
//     차시가 사라진 보드는 차시에서 떼어 교육 보드로 둔다. axhub에서 교육을 하나도 못 읽으면 아무것도 지우지 않고 멈춘다.
//   - 강사(주강사·기술튜터·멘토) 권한은 axhub 배정과 맞춘다. 빠지면 회수하되, 직접 등록한 강사는 두고 간다.
//   - 고객사 담당자 권한은 추가만 하고 회수하지 않는다.
//   - 기간형 차시(commitment = 'window')는 차시를 만들지 않고 교육마다 기간형 보드 하나로 모은다.
//     기간형 차시만 있는 회차는 만들지 않는다.
//   - 관리자가 직접 만든 교육 보드(차시·axhub 연결 없음)는 건드리지 않는다.
// service role로 쓴다. 호출하는 쪽(크론 라우트, 관리자 액션)이 권한을 확인한다.

type Admin = ReturnType<typeof createAdminClient>;

export type SyncSummary = {
  skipped?: string;
  courses: number;
  rounds: number;
  lessons: number;
  boards: number;
  windowBoards: number;
  created: { boards: number };
  deleted: { educations: number; rounds: number; lessons: number; boards: number; files: number };
  held: { educations: number; boards: number };
  granted: { viewers: number; instructors: number };
  revoked: { instructors: number };
};

// 동시에 두 번 돌지 않게 한다. 이 시간이 지나도 안 끝난 실행은 실패로 본다.
const STALE_RUN_MS = 10 * 60 * 1000;
const HOLD_MS = AXHUB_HOLD_DAYS * 24 * 60 * 60 * 1000;

export async function runAxhubSync(trigger: "cron" | "manual"): Promise<SyncSummary> {
  const db = createAdminClient();
  const { data: running } = await db
    .from("axhub_sync_runs")
    .select("id")
    .is("finished_at", null)
    .gt("started_at", new Date(Date.now() - STALE_RUN_MS).toISOString())
    .limit(1);
  if (running?.length) return { ...emptySummary(), skipped: "이미 동기화가 진행 중이에요." };

  const { data: run } = await db.from("axhub_sync_runs").insert({ trigger }).select("id").single();
  try {
    const summary = await sync(db);
    await db.from("axhub_sync_runs").update({ finished_at: new Date().toISOString(), ok: true, summary }).eq("id", run!.id);
    return summary;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.from("axhub_sync_runs").update({ finished_at: new Date().toISOString(), ok: false, error }).eq("id", run!.id);
    throw e;
  }
}

async function sync(db: Admin): Promise<SyncSummary> {
  const summary = emptySummary();

  const known = await selectAll<{ id: string; axhub_course_id: string; axhub_missing_since: string | null }>(
    db.from("educations").select("id, axhub_course_id, axhub_missing_since").not("axhub_course_id", "is", null),
  );
  const ax = await readAxhub(known.map((e) => e.axhub_course_id));
  summary.courses = ax.courses.length;
  // 뷰가 바뀌었거나 권한 문제로 빈 결과가 오면 모든 교육이 사라진 것으로 보게 된다
  if (known.length && !ax.courses.length) throw new Error("axhub에서 교육을 하나도 읽지 못해 아무것도 바꾸지 않고 멈췄어요.");

  // ── axhub에서 사라진 교육. 카드가 없으면 지우고, 있으면 보관한다.
  const fetched = new Set(ax.courses.map((c) => c.id));
  const goneEducations = known.filter((e) => !fetched.has(e.axhub_course_id));
  const goneEducationBoards = await selectIn<{ education_id: string; cards: { count: number }[] }>(
    db,
    "boards",
    "education_id, cards(count)",
    "education_id",
    goneEducations.map((e) => e.id),
  );
  const educationsWithCards = new Set(goneEducationBoards.filter((b) => countOf(b.cards) > 0).map((b) => b.education_id));
  const educationHold = await holdOrDelete(
    db,
    "educations",
    goneEducations.map((e) => ({ id: e.id, since: e.axhub_missing_since, hasCards: educationsWithCards.has(e.id) })),
  );
  summary.deleted.educations = educationHold.deleted;
  summary.held.educations = educationHold.kept.size;

  // ── 고객사 (이름으로 찾는다)
  const companyNames = [...new Set(ax.courses.map((c) => c.clientName).filter((n): n is string => !!n))];
  if (companyNames.length) {
    await must(db.from("companies").upsert(companyNames.map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: true }));
  }
  const companies = await selectIn<{ id: string; name: string }>(db, "companies", "id, name", "name", companyNames);
  const companyId = new Map(companies.map((c) => [c.name, c.id]));

  // ── 교육
  const educations = await upsertReturning<{ id: string; axhub_course_id: string }>(
    db,
    "educations",
    ax.courses.map((c) => ({
      axhub_course_id: c.id,
      name: c.title,
      status: c.status,
      company_id: c.clientName ? (companyId.get(c.clientName) ?? null) : null,
      axhub_missing_since: null,
    })),
    "axhub_course_id",
    "id, axhub_course_id",
  );
  const educationId = new Map(educations.map((e) => [e.axhub_course_id, e.id]));
  const educationIds = [...educationId.values()];

  // ── 회차 (active만. 취소·삭제된 회차는 아래에서 지운다)
  // 기간형 차시만 있는 회차는 만들지 않는다 (그 차시들은 교육의 기간형 보드로 간다). 차시가 아직 없는 회차는 만든다.
  const attendance = ax.sessions.filter((s) => !s.window);
  const windowSessions = ax.sessions.filter((s) => s.window);
  const roundsWithAttendance = new Set(attendance.map((s) => s.roundId));
  const windowOnlyRounds = new Set(windowSessions.map((s) => s.roundId).filter((id) => !roundsWithAttendance.has(id)));
  const rounds = await upsertReturning<{ id: string; axhub_round_id: string; education_id: string }>(
    db,
    "rounds",
    ax.rounds
      .filter((r) => educationId.has(r.courseId) && !windowOnlyRounds.has(r.id))
      .map((r) => ({
        axhub_round_id: r.id,
        education_id: educationId.get(r.courseId)!,
        position: r.roundNumber,
        title: "",
        description: "",
      })),
    "axhub_round_id",
    "id, axhub_round_id, education_id",
  );
  summary.rounds = rounds.length;
  const round = new Map(rounds.map((r) => [r.axhub_round_id, r]));

  // ── 차시·분반 묶기
  const planned: (PlannedLesson & { educationId: string; roundDbId: string })[] = [];
  for (const [axRoundId, r] of round) {
    const sessions = attendance.filter((s) => s.roundId === axRoundId);
    for (const lesson of planLessons(axRoundId, sessions)) {
      planned.push({ ...lesson, educationId: r.education_id, roundDbId: r.id });
    }
  }
  summary.lessons = planned.length;

  // ── 기간형 보드 (교육마다 하나. 키 = axhub 교육 id)
  const courseOfRound = new Map(ax.rounds.map((r) => [r.id, r.courseId]));
  const windowByCourse = new Map<string, typeof windowSessions>();
  for (const s of windowSessions) {
    const courseId = courseOfRound.get(s.roundId);
    if (!courseId || !educationId.has(courseId)) continue;
    windowByCourse.set(courseId, [...(windowByCourse.get(courseId) ?? []), s]);
  }
  type ExistingBoard = {
    id: string;
    axhub_session_id: string | null;
    axhub_window_course_id: string | null;
    lesson_id: string | null;
    axhub_missing_since: string | null;
    cards: { count: number }[];
  };
  const before = await selectIn<ExistingBoard>(
    db,
    "boards",
    "id, axhub_session_id, axhub_window_course_id, lesson_id, axhub_missing_since, cards(count)",
    "education_id",
    educationIds,
  );
  // 기간형 차시에 이미 차시 보드가 있으면(기간형 구분 전에 만들어진 보드) 지우지 않고 기간형 보드로 바꿔 카드를 지킨다
  const hadWindowBoard = new Set(before.map((b) => b.axhub_window_course_id).filter(Boolean));
  for (const [courseId, sessions] of windowByCourse) {
    if (hadWindowBoard.has(courseId)) continue;
    const ids = new Set(sessions.map((s) => s.id));
    const old = before.find((b) => b.axhub_session_id && ids.has(b.axhub_session_id));
    if (!old) continue;
    await must(
      db
        .from("boards")
        .update({ lesson_id: null, division_id: null, axhub_session_id: null, axhub_window_course_id: courseId, ...planWindowBoard(sessions) })
        .eq("id", old.id),
    );
    old.axhub_session_id = null;
    old.axhub_window_course_id = courseId;
  }
  const windowBoards = await upsertReturning<{ id: string; axhub_window_course_id: string }>(
    db,
    "boards",
    [...windowByCourse].map(([courseId, sessions]) => ({
      axhub_window_course_id: courseId,
      education_id: educationId.get(courseId)!,
      lesson_id: null,
      division_id: null,
      ...planWindowBoard(sessions),
      axhub_missing_since: null,
    })),
    "axhub_window_course_id",
    "id, axhub_window_course_id",
  );
  summary.windowBoards = windowBoards.length;
  summary.created.boards += windowBoards.filter((b) => !before.some((e) => e.axhub_window_course_id === b.axhub_window_course_id)).length;

  // 차시가 사라진 보드를 먼저 정리한다. 남은 보드를 옮길 때 "차시당 보드 하나" 제약과 부딪히지 않게 하기 위함.
  // 직접 만든 교육 보드(axhub 연결 없음)는 남긴다. 기간형 차시가 모두 없어진 교육의 기간형 보드도 정리한다.
  // 카드가 있으면 보관한다. 차시 보드는 아래에서 차시가 지워질 때 함께 지워지지 않게 떼어 교육 보드로 둔다.
  // axhub 차시 id(axhub_session_id)는 남겨 두어, 차시가 다시 나타나면 아래 보드 upsert가 제자리로 돌려놓는다.
  const sessionIds = new Set(planned.flatMap((l) => l.sessions.map((s) => s.session.id)));
  const gone = before.filter((b) =>
    b.axhub_session_id
      ? !sessionIds.has(b.axhub_session_id)
      : !!b.axhub_window_course_id && !windowByCourse.has(b.axhub_window_course_id),
  );
  const boardHold = await holdOrDelete(
    db,
    "boards",
    gone.map((b) => ({ id: b.id, since: b.axhub_missing_since, hasCards: countOf(b.cards) > 0 })),
  );
  await detachFromLessons(db, gone.filter((b) => b.lesson_id && boardHold.kept.has(b.id)).map((b) => b.id));
  summary.deleted.boards = boardHold.deleted;
  summary.held.boards = boardHold.kept.size;
  const goneBoards = gone.map((b) => b.id);

  const lessons = await upsertReturning<{ id: string; axhub_key: string }>(
    db,
    "lessons",
    planned.map((l) => ({
      axhub_key: l.key,
      education_id: l.educationId,
      round_id: l.roundDbId,
      position: l.position,
      description: l.description,
    })),
    "axhub_key",
    "id, axhub_key",
  );
  const lessonId = new Map(lessons.map((l) => [l.axhub_key, l.id]));

  const divisions = await upsertReturning<{ id: string; axhub_session_id: string }>(
    db,
    "divisions",
    planned
      .filter((l) => l.sessions.length > 1)
      .flatMap((l) =>
        l.sessions.map((s, i) => ({
          axhub_session_id: s.session.id,
          education_id: l.educationId,
          lesson_id: lessonId.get(l.key)!,
          position: i + 1,
          name: s.divisionName,
        })),
      ),
    "axhub_session_id",
    "id, axhub_session_id",
  );
  const divisionId = new Map(divisions.map((d) => [d.axhub_session_id, d.id]));

  // ── 보드 (axhub 차시 하나 = 보드 하나. 분반이 생기거나 없어져도 같은 보드가 옮겨진다)
  const existingSessionBoards = new Set(before.map((b) => b.axhub_session_id));
  const boards = await upsertReturning<{ id: string; axhub_session_id: string }>(
    db,
    "boards",
    planned.flatMap((l) =>
      l.sessions.map((s) => ({
        axhub_session_id: s.session.id,
        education_id: l.educationId,
        lesson_id: lessonId.get(l.key)!,
        division_id: l.sessions.length > 1 ? divisionId.get(s.session.id)! : null,
        // 보관 중이던(교육 보드로 떼어 둔) 보드가 돌아오면 차시 보드로 되돌린다
        name: null,
        description: "",
        axhub_missing_since: null,
      })),
    ),
    "axhub_session_id",
    "id, axhub_session_id",
  );
  summary.boards = boards.length;
  summary.created.boards += boards.filter((b) => !existingSessionBoards.has(b.axhub_session_id)).length;
  // axhub 차시 id → 보드 id. 기간형 차시는 그 교육의 기간형 보드로 간다 (주강사 권한도 그 보드에).
  const boardId = new Map(boards.map((b) => [b.axhub_session_id, b.id]));
  const windowBoardId = new Map(windowBoards.map((b) => [b.axhub_window_course_id, b.id]));
  for (const [courseId, sessions] of windowByCourse) {
    for (const s of sessions) boardId.set(s.id, windowBoardId.get(courseId)!);
  }

  // 보드를 옮긴 뒤에 남은 분반·차시·회차를 지운다
  const keptDivisions = new Set(divisions.map((d) => d.id));
  const allDivisions = await selectIn<{ id: string }>(db, "divisions", "id", "education_id", educationIds);
  await deleteIn(db, "divisions", "id", allDivisions.map((d) => d.id).filter((id) => !keptDivisions.has(id)));

  const keptLessons = new Set(lessons.map((l) => l.id));
  const allLessons = await selectIn<{ id: string }>(db, "lessons", "id", "education_id", educationIds);
  summary.deleted.lessons = await deleteIn(db, "lessons", "id", allLessons.map((l) => l.id).filter((id) => !keptLessons.has(id)));

  const keptRounds = new Set(rounds.map((r) => r.id));
  const allRounds = await selectIn<{ id: string }>(db, "rounds", "id", "education_id", educationIds);
  summary.deleted.rounds = await deleteIn(db, "rounds", "id", allRounds.map((r) => r.id).filter((id) => !keptRounds.has(id)));

  // ── 새 보드에 기본 섹션
  const withSections = new Set(
    (await selectIn<{ board_id: string }>(db, "sections", "board_id", "board_id", [...boardId.values()])).map((s) => s.board_id),
  );
  const needSection = [...boardId.values()].filter((id) => !withSections.has(id));
  for (const part of chunks(needSection, 200)) {
    await must(db.from("sections").insert(part.map((board_id) => ({ board_id, position: 1, name: "수강생 게시판" }))));
  }

  // ── 권한 (추가만)
  const viewerRows = ax.courses
    .filter((c) => c.contactEmail && educationId.has(c.id))
    .map((c) => ({ education_id: educationId.get(c.id)!, email: c.contactEmail!, source: "axhub" }));
  for (const part of chunks(viewerRows, 200)) {
    await must(db.from("education_viewers").upsert(part, { onConflict: "education_id,email", ignoreDuplicates: true }));
  }
  summary.granted.viewers = viewerRows.length;

  // ── 강사 권한: axhub 배정(주강사·기술튜터·멘토)과 맞춘다 (PLAN.md 2.2절)
  //   배정된 사람은 강사로(교육생으로 참여 중이었으면 강사로 바꾼다), 배정에서 빠진 사람은 회수한다.
  //   관리자가 직접 등록한 강사(source = manual)는 건드리지 않는다.
  //   출처가 없는 예전 강사 권한(source = null)은 지금 배정에 있으면 axhub, 없으면 manual로 정해 남긴다.
  const key = (board: string, email: string) => `${board}|${email}`;
  const assigned = new Map<string, { board_id: string; email: string }>();
  for (const a of ax.assignments) {
    const board = boardId.get(a.sessionId);
    if (board) for (const email of a.emails) assigned.set(key(board, email), { board_id: board, email });
  }
  const members = await selectIn<{ board_id: string; email: string; role: string; source: string | null }>(
    db,
    "board_members",
    "board_id, email, role, source",
    "board_id",
    [...new Set(boardId.values())],
  );
  const existing = new Map(members.map((m) => [key(m.board_id, m.email), m]));
  const grants = [...assigned]
    .filter(([k]) => {
      const m = existing.get(k);
      return !m || m.role !== "instructor" || m.source === null;
    })
    .map(([, m]) => ({ ...m, role: "instructor", source: "axhub" }));
  const legacy = members
    .filter((m) => m.role === "instructor" && m.source === null && !assigned.has(key(m.board_id, m.email)))
    .map((m) => ({ board_id: m.board_id, email: m.email, role: "instructor", source: "manual" }));
  for (const part of chunks([...grants, ...legacy], 200)) {
    await must(db.from("board_members").upsert(part, { onConflict: "board_id,email" }));
  }
  summary.granted.instructors = grants.length;

  // 배정을 하나도 못 읽었으면(axhub 쪽 문제일 수 있음) 한꺼번에 회수하지 않는다
  const revoke = ax.assignments.length
    ? members.filter((m) => m.role === "instructor" && m.source === "axhub" && !assigned.has(key(m.board_id, m.email)))
    : [];
  const revokeByBoard = new Map<string, string[]>();
  for (const m of revoke) revokeByBoard.set(m.board_id, [...(revokeByBoard.get(m.board_id) ?? []), m.email]);
  for (const [board, emails] of revokeByBoard) {
    await must(db.from("board_members").delete().eq("board_id", board).eq("source", "axhub").in("email", emails));
  }
  summary.revoked.instructors = revoke.length;
  // 회수된 강사가 보고 있던 화면이 다시 읽어 권한을 확인하게 한다
  goneBoards.push(...revokeByBoard.keys());

  // ── 지워진 보드의 첨부 파일 정리, 열려 있던 화면에 알림
  const orphaned = await removeOrphanFiles(db);
  summary.deleted.files = orphaned.files;
  await notifyBoards([...goneBoards, ...orphaned.boards]);

  return summary;
}

// axhub에서 사라진 교육·보드를 정리한다. 카드가 없거나 보관 기간이 지났으면 지우고,
// 카드가 있으면 남겨 두고 처음 사라진 시각을 적는다. kept: 보관 중인 id
async function holdOrDelete(db: Admin, table: "educations" | "boards", items: { id: string; since: string | null; hasCards: boolean }[]) {
  const now = Date.now();
  const kept = new Set(
    items.filter((i) => i.hasCards && (i.since === null || now - Date.parse(i.since) <= HOLD_MS)).map((i) => i.id),
  );
  const mark = items.filter((i) => kept.has(i.id) && i.since === null).map((i) => i.id);
  for (const part of chunks(mark, 100)) {
    await must(db.from(table).update({ axhub_missing_since: new Date(now).toISOString() }).in("id", part));
  }
  const deleted = await deleteIn(db, table, "id", items.filter((i) => !kept.has(i.id)).map((i) => i.id));
  return { deleted, kept };
}

// 보관하는 차시 보드를 차시에서 떼어 교육 보드로 둔다. 이름은 원래 위치("1회차 · 2차시 · A반").
async function detachFromLessons(db: Admin, boardIds: string[]) {
  type Row = {
    id: string;
    lesson: { position: number; round: { position: number } | null } | null;
    division: { name: string } | null;
  };
  const rows = await selectIn<Row>(db, "boards", "id, lesson:lessons(position, round:rounds(position)), division:divisions(name)", "id", boardIds);
  for (const b of rows) {
    const place = [b.lesson?.round ? `${b.lesson.round.position}회차` : "", b.lesson ? `${b.lesson.position}차시` : "", b.division?.name ?? ""];
    await must(
      db
        .from("boards")
        .update({ lesson_id: null, division_id: null, name: place.filter(Boolean).join(" · ") || "삭제된 차시" })
        .eq("id", b.id),
    );
  }
}

const countOf = (rel?: { count: number }[]) => rel?.[0]?.count ?? 0;

// 보드가 없어진 첨부 파일을 지운다. 파일 경로는 "<board_id>/<user_id>/<파일>" (예전 파일은 "<board_id>/<파일>").
async function removeOrphanFiles(db: Admin) {
  const storage = db.storage.from(CARD_IMAGE_BUCKET);
  const folders: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await storage.list("", { limit: 1000, offset });
    if (!data?.length) break;
    folders.push(...data.filter((f) => f.id === null).map((f) => f.name));
    if (data.length < 1000) break;
  }
  const existing = new Set((await selectIn<{ id: string }>(db, "boards", "id", "id", folders)).map((b) => b.id));
  const orphanBoards = folders.filter((f) => !existing.has(f));

  let files = 0;
  for (const board of orphanBoards) {
    const paths = await listFiles(storage, board);
    for (const part of chunks(paths, 500)) {
      await storage.remove(part);
      files += part.length;
    }
  }
  return { boards: orphanBoards, files };
}

async function listFiles(storage: ReturnType<Admin["storage"]["from"]>, prefix: string): Promise<string[]> {
  const { data } = await storage.list(prefix, { limit: 1000 });
  const out: string[] = [];
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id === null) out.push(...(await listFiles(storage, path)));
    else out.push(path);
  }
  return out;
}

// ── Supabase 도우미. id 목록이 길면 URL 길이 제한에 걸리므로 나눠서 보낸다.

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function must<T extends { error: { message: string } | null }>(query: PromiseLike<T>): Promise<T> {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- 생성된 DB 타입 없이 테이블 이름으로 호출한다 */
async function selectAll<T>(query: PromiseLike<{ data: any; error: { message: string } | null }>): Promise<T[]> {
  return ((await must(query)).data ?? []) as T[];
}

async function selectIn<T>(db: Admin, table: string, columns: string, column: string, values: string[]): Promise<T[]> {
  const out: T[] = [];
  for (const part of chunks(values, 100)) out.push(...(await selectAll<T>(db.from(table).select(columns).in(column, part))));
  return out;
}

async function upsertReturning<T>(db: Admin, table: string, rows: Record<string, unknown>[], onConflict: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (const part of chunks(rows, 200)) {
    out.push(...(await selectAll<T>(db.from(table).upsert(part, { onConflict }).select(columns))));
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function deleteIn(db: Admin, table: string, column: string, values: string[]) {
  let count = 0;
  for (const part of chunks(values, 100)) {
    const { data } = await must(db.from(table).delete().in(column, part).select("id"));
    count += data?.length ?? 0;
  }
  return count;
}

function emptySummary(): SyncSummary {
  return {
    courses: 0,
    rounds: 0,
    lessons: 0,
    boards: 0,
    windowBoards: 0,
    created: { boards: 0 },
    deleted: { educations: 0, rounds: 0, lessons: 0, boards: 0, files: 0 },
    held: { educations: 0, boards: 0 },
    granted: { viewers: 0, instructors: 0 },
    revoked: { instructors: 0 },
  };
}
