import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_IMAGE_BUCKET } from "@/lib/storage";
import type { Board, BoardRole, Card, Company, Division, Education, Lesson, Round, Section, Viewer } from "@/lib/types";

// 모든 조회는 로그인한 사용자의 세션(RLS)으로 한다. 권한 밖의 행은 DB가 걸러낸다.

/* eslint-disable @typescript-eslint/no-explicit-any -- 생성된 DB 타입 없이 행을 매핑한다 */
const countOf = (rel: any): number => rel?.[0]?.count ?? 0;

const toCompany = (row: any): Company | undefined => (row ? { id: row.id, name: row.name } : undefined);

const toEducation = (row: any): Education => ({
  id: row.id,
  name: row.name,
  company: toCompany(row.company),
  status: row.status ?? undefined,
  synced: !!row.axhub_course_id,
});

const toRound = (row: any): Round => ({
  id: row.id,
  educationId: row.education_id,
  order: row.position,
  title: row.title,
  description: row.description,
  synced: !!row.axhub_round_id,
});

const toLesson = (row: any): Lesson => ({
  id: row.id,
  roundId: row.round_id,
  order: row.position,
  description: row.description,
  synced: !!row.axhub_key,
});

const toDivision = (row: any): Division => ({
  id: row.id,
  lessonId: row.lesson_id,
  order: row.position,
  name: row.name,
});

const toBoard = (row: any): Board => ({
  id: row.id,
  lessonId: row.lesson_id,
  divisionId: row.division_id ?? undefined,
  cardCount: countOf(row.cards),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const EDUCATION_COLUMNS = "id, name, status, axhub_course_id, company:companies(id, name)";

export async function listEducations() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("educations")
    .select(`${EDUCATION_COLUMNS}, rounds(count), boards(count)`)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({
    ...toEducation(row),
    roundCount: countOf(row.rounds),
    boardCount: countOf(row.boards),
  }));
}

export async function getEducationWithRounds(educationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("educations")
    .select(`${EDUCATION_COLUMNS}, rounds(*, lessons(count))`)
    .eq("id", educationId)
    .maybeSingle();
  if (!data) return null;
  const rounds = (data.rounds ?? [])
    .map((r: { lessons: unknown }) => ({ ...toRound(r), lessonCount: countOf(r.lessons) }))
    .sort((a: Round, b: Round) => a.order - b.order);
  return { education: toEducation(data), rounds };
}

export async function getRoundWithLessons(educationId: string, roundId: string) {
  const supabase = await createClient();
  const [{ data: education }, { data: round }] = await Promise.all([
    supabase.from("educations").select(EDUCATION_COLUMNS).eq("id", educationId).maybeSingle(),
    supabase
      .from("rounds")
      .select("*, lessons(*, divisions(count), boards(*, cards(count)))")
      .eq("id", roundId)
      .eq("education_id", educationId)
      .maybeSingle(),
  ]);
  if (!education || !round) return null;
  const lessons = (round.lessons ?? [])
    .map((l: { divisions: unknown; boards: unknown[] }) => ({
      ...toLesson(l),
      divisionCount: countOf(l.divisions),
      // 분반이 없는 차시의 보드
      board: l.boards.map(toBoard).find((b) => !b.divisionId),
    }))
    .sort((a: Lesson, b: Lesson) => a.order - b.order);
  return { education: toEducation(education), round: toRound(round), lessons };
}

export async function getLessonWithDivisions(educationId: string, roundId: string, lessonId: string) {
  const supabase = await createClient();
  const [{ data: education }, { data: round }, { data: lesson }] = await Promise.all([
    supabase.from("educations").select(EDUCATION_COLUMNS).eq("id", educationId).maybeSingle(),
    supabase.from("rounds").select("*").eq("id", roundId).eq("education_id", educationId).maybeSingle(),
    supabase
      .from("lessons")
      .select("*, divisions(*), boards(*, cards(count))")
      .eq("id", lessonId)
      .eq("round_id", roundId)
      .maybeSingle(),
  ]);
  if (!education || !round || !lesson) return null;
  const boards: Board[] = (lesson.boards ?? []).map(toBoard);
  const divisions = (lesson.divisions ?? [])
    .map(toDivision)
    .sort((a: Division, b: Division) => a.order - b.order)
    .map((d: Division) => ({ ...d, board: boards.find((b) => b.divisionId === d.id) }));
  return { education: toEducation(education), round: toRound(round), lesson: toLesson(lesson), divisions };
}

// 마지막 axhub 동기화 (관리자 화면)
export async function getLastSync() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("axhub_sync_runs")
    .select("trigger, started_at, finished_at, ok, summary, error")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function listViewers(educationId: string): Promise<Viewer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("education_viewers")
    .select("email, source")
    .eq("education_id", educationId)
    .order("created_at");
  return data ?? [];
}

// 보드에 등록된 강사 (관리자 화면용)
export async function listInstructors(boardId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("board_members")
    .select("email")
    .eq("board_id", boardId)
    .eq("role", "instructor")
    .order("created_at");
  return data ?? [];
}

const BOARD_CONTEXT_COLUMNS = `
  id, lesson_id, division_id,
  lesson:lessons(id, round_id, position, description, axhub_key, round:rounds(*)),
  division:divisions(id, lesson_id, position, name),
  education:educations(${EDUCATION_COLUMNS})
`;

// 보드 제목에 필요한 상위 계층 정보
export type BoardContext = {
  board: Omit<Board, "cardCount">;
  lesson: Lesson;
  round: Round;
  education: Education;
  division?: Division;
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function toBoardContext(row: any): BoardContext {
  return {
    board: { id: row.id, lessonId: row.lesson_id, divisionId: row.division_id ?? undefined },
    lesson: toLesson(row.lesson),
    round: toRound(row.lesson.round),
    education: toEducation(row.education),
    division: row.division ? toDivision(row.division) : undefined,
  };
}

// 가입 전(또는 아직 참여하지 않은) 사용자에게 보여줄 보드 정보.
// RLS상 아직 볼 수 없으므로 service role로 이름만 꺼낸다.
export async function getBoardPreview(boardId: string): Promise<BoardContext | null> {
  if (!isUuid(boardId)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("boards").select(BOARD_CONTEXT_COLUMNS).eq("id", boardId).maybeSingle();
  return data ? toBoardContext(data) : null;
}

export async function getBoardRole(boardId: string): Promise<BoardRole | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("board_role", { bid: boardId });
  return (data as BoardRole | null) ?? null;
}

export async function getBoardContents(boardId: string) {
  const supabase = await createClient();
  const [{ data: board }, { data: sections }, { data: cards }] = await Promise.all([
    supabase.from("boards").select(BOARD_CONTEXT_COLUMNS).eq("id", boardId).maybeSingle(),
    supabase.from("sections").select("*").eq("board_id", boardId).order("position"),
    supabase.from("cards").select("*").eq("board_id", boardId).order("created_at"),
  ]);
  if (!board) return null;

  // 첨부 파일은 비공개 버킷에 있다. 이미 RLS로 카드 열람 권한을 확인했으므로 서명 URL을 발급한다.
  const signed = await signedUrls((cards ?? []).map((c) => c.attachment_path).filter(Boolean) as string[]);

  return {
    ...toBoardContext(board),
    sections: (sections ?? []).map(
      (s): Section => ({ id: s.id, boardId: s.board_id, order: s.position, name: s.name }),
    ),
    cards: (cards ?? []).map(
      (c): Card => ({
        id: c.id,
        sectionId: c.section_id,
        title: c.title,
        content: c.content,
        attachment:
          c.attachment_path && signed.has(c.attachment_path)
            ? {
                url: signed.get(c.attachment_path)!,
                name: c.attachment_name ?? "첨부 파일",
                type: c.attachment_type ?? "application/octet-stream",
                size: c.attachment_size ?? undefined,
              }
            : undefined,
        link: c.link ?? undefined,
        authorId: c.author_id,
        author: c.author_name,
        createdAt: kstDate(c.created_at),
      }),
    ),
  };
}

// 강사·교육생이 참여한 보드 목록 (로그인 후 첫 화면)
export async function listMyBoards(email: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("board_members")
    .select(`role, board:boards(${BOARD_CONTEXT_COLUMNS})`)
    .eq("email", email)
    .order("created_at", { ascending: false });
  return (data ?? [])
    .filter((row) => row.board)
    .map((row) => ({ ...toBoardContext(row.board), role: row.role as BoardRole }));
}

// 서명 URL은 발급할 때마다 달라져서, 그대로 쓰면 실시간 반영으로 다시 읽을 때마다 브라우저가
// 이미지·동영상을 전부 새로 받는다. 같은 파일에는 남은 시간이 넉넉한 동안 같은 URL을 다시 쓴다.
// 서버 인스턴스별 메모리 캐시다. 접근 권한은 이 함수를 부르기 전에 RLS로 카드를 읽으며 이미 확인했다.
const SIGNED_URL_SECONDS = 6 * 60 * 60;
const REUSE_UNTIL_SECONDS_LEFT = 2 * 60 * 60;
const signedCache = new Map<string, { url: string; expiresAt: number }>();

async function signedUrls(paths: string[]) {
  const now = Date.now();
  const result = new Map<string, string>();
  const missing: string[] = [];
  for (const path of new Set(paths)) {
    const hit = signedCache.get(path);
    if (hit && hit.expiresAt - now > REUSE_UNTIL_SECONDS_LEFT * 1000) result.set(path, hit.url);
    else missing.push(path);
  }
  if (missing.length) {
    const { data } = await createAdminClient().storage.from(CARD_IMAGE_BUCKET).createSignedUrls(missing, SIGNED_URL_SECONDS);
    const expiresAt = now + SIGNED_URL_SECONDS * 1000;
    data?.forEach((d) => {
      if (!d.path || !d.signedUrl) return;
      result.set(d.path, d.signedUrl);
      signedCache.set(d.path, { url: d.signedUrl, expiresAt });
    });
    // 지워진 파일의 항목이 쌓이지 않게 만료된 것을 정리한다
    if (signedCache.size > 5000) for (const [p, v] of signedCache) if (v.expiresAt <= now) signedCache.delete(p);
  }
  return result;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function kstDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}
