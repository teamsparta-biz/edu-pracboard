import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_IMAGE_BUCKET } from "@/lib/storage";
import { notifyBoards } from "@/lib/board-events";
import { planLessons, type PlannedLesson } from "./plan";
import { readAxhub } from "./source";

// axhub → PracBoard 동기화 (PLAN.md 3절). axhub가 원본이다.
//   - 새 교육은 준비 중·진행 중만 가져오고, 한 번 가져온 교육은 상태가 바뀌어도 계속 맞춘다.
//   - axhub에서 사라진(또는 취소된) 교육·회차·차시는 PracBoard에서도 지운다. 보드·카드·첨부까지 지워진다.
//   - 강사(주강사)와 고객사 담당자 권한은 추가만 하고 회수하지 않는다.
// service role로 쓴다. 호출하는 쪽(크론 라우트, 관리자 액션)이 권한을 확인한다.

type Admin = ReturnType<typeof createAdminClient>;

export type SyncSummary = {
  skipped?: string;
  courses: number;
  rounds: number;
  lessons: number;
  boards: number;
  created: { boards: number };
  deleted: { educations: number; rounds: number; lessons: number; boards: number; files: number };
  granted: { viewers: number; instructors: number };
};

// 동시에 두 번 돌지 않게 한다. 이 시간이 지나도 안 끝난 실행은 실패로 본다.
const STALE_RUN_MS = 10 * 60 * 1000;

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

  const known = await selectAll<{ id: string; axhub_course_id: string }>(
    db.from("educations").select("id, axhub_course_id").not("axhub_course_id", "is", null),
  );
  const ax = await readAxhub(known.map((e) => e.axhub_course_id));
  summary.courses = ax.courses.length;

  // ── axhub에서 사라진 교육
  const fetched = new Set(ax.courses.map((c) => c.id));
  const goneEducations = known.filter((e) => !fetched.has(e.axhub_course_id)).map((e) => e.id);
  summary.deleted.educations = await deleteIn(db, "educations", "id", goneEducations);

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
    })),
    "axhub_course_id",
    "id, axhub_course_id",
  );
  const educationId = new Map(educations.map((e) => [e.axhub_course_id, e.id]));
  const educationIds = [...educationId.values()];

  // ── 회차 (active만. 취소·삭제된 회차는 아래에서 지운다)
  const rounds = await upsertReturning<{ id: string; axhub_round_id: string; education_id: string }>(
    db,
    "rounds",
    ax.rounds
      .filter((r) => educationId.has(r.courseId))
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
    const sessions = ax.sessions.filter((s) => s.roundId === axRoundId);
    for (const lesson of planLessons(axRoundId, sessions)) {
      planned.push({ ...lesson, educationId: r.education_id, roundDbId: r.id });
    }
  }
  summary.lessons = planned.length;

  // 차시가 사라진 보드를 먼저 지운다. 남은 보드를 옮길 때 "차시당 보드 하나" 제약과 부딪히지 않게 하기 위함.
  const sessionIds = new Set(planned.flatMap((l) => l.sessions.map((s) => s.session.id)));
  const existingBoards = await selectIn<{ id: string; axhub_session_id: string | null }>(
    db, "boards", "id, axhub_session_id", "education_id", educationIds,
  );
  const goneBoards = existingBoards.filter((b) => !b.axhub_session_id || !sessionIds.has(b.axhub_session_id)).map((b) => b.id);
  summary.deleted.boards = await deleteIn(db, "boards", "id", goneBoards);

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
  const existingSessionBoards = new Set(existingBoards.map((b) => b.axhub_session_id));
  const boards = await upsertReturning<{ id: string; axhub_session_id: string }>(
    db,
    "boards",
    planned.flatMap((l) =>
      l.sessions.map((s) => ({
        axhub_session_id: s.session.id,
        education_id: l.educationId,
        lesson_id: lessonId.get(l.key)!,
        division_id: l.sessions.length > 1 ? divisionId.get(s.session.id)! : null,
      })),
    ),
    "axhub_session_id",
    "id, axhub_session_id",
  );
  summary.boards = boards.length;
  summary.created.boards = boards.filter((b) => !existingSessionBoards.has(b.axhub_session_id)).length;
  const boardId = new Map(boards.map((b) => [b.axhub_session_id, b.id]));

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

  // 이미 교육생으로 참여한 사람이 주강사로 배정되면 강사로 바꾼다
  const instructorRows = ax.assignments
    .filter((a) => boardId.has(a.sessionId))
    .flatMap((a) => a.emails.map((email) => ({ board_id: boardId.get(a.sessionId)!, email, role: "instructor" })));
  for (const part of chunks(instructorRows, 200)) {
    await must(db.from("board_members").upsert(part, { onConflict: "board_id,email" }));
  }
  summary.granted.instructors = instructorRows.length;

  // ── 지워진 보드의 첨부 파일 정리, 열려 있던 화면에 알림
  const orphaned = await removeOrphanFiles(db);
  summary.deleted.files = orphaned.files;
  await notifyBoards([...goneBoards, ...orphaned.boards]);

  return summary;
}

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
    created: { boards: 0 },
    deleted: { educations: 0, rounds: 0, lessons: 0, boards: 0, files: 0 },
    granted: { viewers: 0, instructors: 0 },
  };
}
