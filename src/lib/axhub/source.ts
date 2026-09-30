import "server-only";
import postgres from "postgres";
import type { AxhubSession } from "./plan";

// axhub 읽기. 읽기 전용 계정 pracboard_reader로 전용 스키마 pracboard의 뷰만 읽는다 (PLAN.md 3절).

export type AxhubCourse = {
  id: string;
  title: string;
  status: string;
  clientName: string | null;
  contactEmail: string | null;
};
export type AxhubRound = { id: string; courseId: string; roundNumber: number };
export type AxhubAssignment = { sessionId: string; emails: string[] };

export type AxhubSnapshot = {
  courses: AxhubCourse[];
  rounds: AxhubRound[];
  sessions: AxhubSession[];
  // 주강사만 (PLAN.md 2.2절)
  assignments: AxhubAssignment[];
};

// 새로 가져오는 교육의 상태. 한 번 가져온 교육은 상태가 바뀌어도 계속 동기화한다.
export const IMPORT_STATUSES = ["setup", "operation"];

const lower = (v: string | null) => v?.trim().toLowerCase() || null;

export async function readAxhub(knownCourseIds: string[]): Promise<AxhubSnapshot> {
  const url = process.env.AXHUB_DATABASE_URL;
  if (!url) throw new Error("AXHUB_DATABASE_URL이 설정되지 않았어요.");
  // 풀러(트랜잭션 모드)는 prepared statement를 지원하지 않는다
  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15, idle_timeout: 5 });

  try {
    const courses = await sql<{ id: string; title: string; status: string; client_name: string | null; client_contact_email: string | null }[]>`
      select id, title, status, client_name, client_contact_email
      from pracboard.courses
      where status = any(${IMPORT_STATUSES}) or id = any(${knownCourseIds}::uuid[])`;
    const courseIds = courses.map((c) => c.id);

    const rounds = await sql<{ id: string; course_id: string; round_number: number }[]>`
      select id, course_id, round_number
      from pracboard.course_rounds
      where course_id = any(${courseIds}::uuid[]) and status = 'active'`;
    const roundIds = rounds.map((r) => r.id);

    const sessions = await sql<{ id: string; round_id: string; date: string; start_time: number | null; end_time: number | null; name: string | null }[]>`
      select s.id, s.round_id, to_char(s.date, 'YYYY-MM-DD') as date, s.start_time, s.end_time, s.name
      from pracboard.course_sessions s
      where s.round_id = any(${roundIds}::uuid[]) and s.date is not null`;
    const sessionIds = sessions.map((s) => s.id);

    const assignments = await sql<{ course_session_id: string; email: string | null; auth_email: string | null }[]>`
      select a.course_session_id, i.email, i.auth_email
      from pracboard.assignments a
      join pracboard.instructors i on i.id = a.instructor_id
      where a.course_session_id = any(${sessionIds}::uuid[]) and a.role_category = 'main_instructor'`;

    const bySession = new Map<string, Set<string>>();
    for (const a of assignments) {
      const set = bySession.get(a.course_session_id) ?? new Set<string>();
      // 강사 이메일은 email과 auth_email 둘 다 등록한다 (PLAN.md 2.2절)
      for (const e of [lower(a.email), lower(a.auth_email)]) if (e) set.add(e);
      bySession.set(a.course_session_id, set);
    }

    return {
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        clientName: c.client_name?.trim() || null,
        contactEmail: lower(c.client_contact_email),
      })),
      rounds: rounds.map((r) => ({ id: r.id, courseId: r.course_id, roundNumber: r.round_number })),
      sessions: sessions.map((s) => ({
        id: s.id,
        roundId: s.round_id,
        date: s.date,
        startTime: s.start_time,
        endTime: s.end_time,
        name: s.name,
      })),
      assignments: [...bySession].map(([sessionId, emails]) => ({ sessionId, emails: [...emails] })),
    };
  } finally {
    await sql.end();
  }
}
