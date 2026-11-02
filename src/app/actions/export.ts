"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_IMAGE_BUCKET } from "@/lib/storage";
import { getSessionUser } from "@/lib/auth";
import { educationTitle, roundLabel } from "@/lib/education";
import { isUuid } from "@/lib/data";
import type { ExportManifest, ExportScope } from "@/lib/board-export";

// 게시물 내려받기(zip)에 필요한 목록. zip은 브라우저가 만든다 — 첨부가 수 GB일 수 있어
// 서버 함수(응답 4.5MB 제한)를 거치지 않고, 여기서 준 서명 URL로 Storage에서 직접 받는다.
// 관리자와 그 교육의 교육 담당자만 받을 수 있다. 내용은 사용자 세션(RLS)으로 읽는다.

const DENIED = "내려받을 권한이 없거나 찾을 수 없어요.";
// 큰 교육은 다 받는 데 오래 걸릴 수 있어 넉넉히 둔다
const SIGNED_URL_SECONDS = 12 * 60 * 60;
const PAGE = 1000;
const IN_CHUNK = 100;

/* eslint-disable @typescript-eslint/no-explicit-any -- 생성된 DB 타입 없이 행을 매핑한다 */
type Query = (from: number, to: number) => PromiseLike<{ data: any[] | null; error: unknown }>;

// PostgREST는 한 번에 최대 1000행을 돌려주므로 끝까지 나눠 읽는다
async function readAll(query: Query) {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

// 보드가 많으면 id 목록이 주소에 다 들어가지 않으므로 나눠 읽는다
async function readByBoards(ids: string[], query: (chunk: string[]) => Query) {
  const rows: any[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) rows.push(...(await readAll(query(ids.slice(i, i + IN_CHUNK)))));
  return rows;
}

const BOARD_COLUMNS = `
  id, education_id, name, created_at,
  lesson:lessons(id, position, round:rounds(id, position, title)),
  division:divisions(id, position, name)
`;

export async function getExportManifest(scope: ExportScope): Promise<ExportManifest | { error: string }> {
  const user = await getSessionUser();
  if (!user || !isUuid(scope.id)) return { error: DENIED };
  const supabase = await createClient();

  // 범위 안의 보드
  let boards: any[];
  if (scope.type === "board") {
    boards = await readAll((a, b) => supabase.from("boards").select(BOARD_COLUMNS).eq("id", scope.id).range(a, b));
  } else if (scope.type === "lesson") {
    boards = await readAll((a, b) => supabase.from("boards").select(BOARD_COLUMNS).eq("lesson_id", scope.id).range(a, b));
  } else if (scope.type === "round") {
    const lessons = await readAll((a, b) => supabase.from("lessons").select("id").eq("round_id", scope.id).range(a, b));
    boards = lessons.length
      ? await readByBoards(
          lessons.map((l) => l.id),
          (ids) => (a, b) => supabase.from("boards").select(BOARD_COLUMNS).in("lesson_id", ids).range(a, b),
        )
      : [];
  } else {
    boards = await readAll((a, b) => supabase.from("boards").select(BOARD_COLUMNS).eq("education_id", scope.id).range(a, b));
  }

  // 교육 확인: 범위가 교육이면 그 교육, 아니면 보드가 속한 교육 (보드가 없으면 상위 단위로 찾는다)
  const educationId =
    scope.type === "education"
      ? scope.id
      : (boards[0]?.education_id ??
        (scope.type === "round"
          ? (await supabase.from("rounds").select("education_id").eq("id", scope.id).maybeSingle()).data?.education_id
          : scope.type === "lesson"
            ? ((await supabase.from("lessons").select("round:rounds(education_id)").eq("id", scope.id).maybeSingle()).data as any)
                ?.round?.education_id
            : undefined));
  if (!educationId) return { error: DENIED };

  // 관리자 또는 이 교육의 교육 담당자만. 강사·교육생은 보드를 볼 수 있어도 내려받지 못한다.
  if (!user.isAdmin) {
    const { count } = await createAdminClient()
      .from("education_viewers")
      .select("education_id", { count: "exact", head: true })
      .eq("education_id", educationId)
      .eq("email", user.email);
    if (!count) return { error: DENIED };
  }

  const { data: education } = await supabase
    .from("educations")
    .select("name, company:companies(name)")
    .eq("id", educationId)
    .maybeSingle();
  if (!education) return { error: DENIED };

  const ids = boards.map((b) => b.id);
  const [sections, cards, likes, comments] = await Promise.all([
    readByBoards(ids, (c) => (a, b) => supabase.from("sections").select("id, board_id, position, name").in("board_id", c).order("position").order("id").range(a, b)),
    // 보드 화면과 같은 순서: 관리자·강사 카드(고정) 먼저 정해 둔 순서로, 그다음 교육생 카드를 올린 순서로
    readByBoards(ids, (c) => (a, b) =>
      supabase
        .from("cards")
        .select("id, board_id, section_id, title, content, link, author_name, created_at, pinned, attachment_path, attachment_name, attachment_type, attachment_size")
        .in("board_id", c)
        .order("pinned", { ascending: false })
        .order("pin_position", { ascending: true, nullsFirst: false })
        .order("created_at")
        .order("id")
        .range(a, b),
    ),
    readByBoards(ids, (c) => (a, b) => supabase.from("card_likes").select("card_id").in("board_id", c).order("card_id").order("user_id").range(a, b)),
    readByBoards(ids, (c) => (a, b) =>
      supabase.from("card_comments").select("card_id, author_name, content, created_at").in("board_id", c).order("created_at").order("id").range(a, b),
    ),
  ]);

  // 첨부 서명 URL. 카드를 RLS로 읽었으므로 읽을 수 있는 파일만 서명한다.
  const paths = [...new Set(cards.map((c) => c.attachment_path).filter(Boolean) as string[])];
  const urls = new Map<string, string>();
  const storage = createAdminClient().storage.from(CARD_IMAGE_BUCKET);
  for (let i = 0; i < paths.length; i += PAGE) {
    const { data } = await storage.createSignedUrls(paths.slice(i, i + PAGE), SIGNED_URL_SECONDS);
    data?.forEach((d) => d.path && d.signedUrl && urls.set(d.path, d.signedUrl));
  }

  const likeCount = new Map<string, number>();
  for (const l of likes) likeCount.set(l.card_id, (likeCount.get(l.card_id) ?? 0) + 1);
  const commentsOf = new Map<string, any[]>();
  for (const c of comments) commentsOf.set(c.card_id, [...(commentsOf.get(c.card_id) ?? []), c]);

  // 교육 보드 먼저(만든 순서), 그다음 회차·차시·분반 순서
  const sortKey = (b: any) =>
    b.lesson
      ? [1, b.lesson.round?.position ?? 0, b.lesson.position ?? 0, b.division?.position ?? 0, ""]
      : [0, 0, 0, 0, b.created_at];
  boards.sort((x, y) => {
    const a = sortKey(x), b = sortKey(y);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    return 0;
  });

  return {
    education: educationTitle(education.name),
    company: (education.company as any)?.name ?? undefined,
    scope: scope.type,
    boards: boards.map((b) => ({
      // 교육 안에서의 위치: ["1회차", "2차시", "A반"] 또는 ["교육 보드", 이름]
      place: b.lesson
        ? [
            b.lesson.round ? roundLabel({ order: b.lesson.round.position, title: b.lesson.round.title ?? "" }) : "회차",
            `${b.lesson.position}차시`,
            ...(b.division ? [b.division.name as string] : []),
          ]
        : ["교육 보드", b.name ?? "보드"],
      sections: sections
        .filter((s) => s.board_id === b.id)
        .map((s) => ({
          name: s.name,
          cards: cards
            .filter((c) => c.section_id === s.id)
            .map((c) => ({
              title: c.title ?? "",
              content: c.content ?? "",
              link: c.link ?? undefined,
              author: c.author_name ?? "",
              createdAt: c.created_at,
              likes: likeCount.get(c.id) ?? 0,
              comments: (commentsOf.get(c.id) ?? []).map((m) => ({ author: m.author_name ?? "", content: m.content, createdAt: m.created_at })),
              attachment:
                c.attachment_path && urls.has(c.attachment_path)
                  ? {
                      url: urls.get(c.attachment_path)!,
                      name: (c.attachment_name ?? "첨부 파일").normalize("NFC"),
                      type: c.attachment_type ?? "application/octet-stream",
                      size: c.attachment_size ?? 0,
                    }
                  : undefined,
            })),
        })),
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
