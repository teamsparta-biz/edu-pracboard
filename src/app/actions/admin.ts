"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_DOMAIN, requireAdmin } from "@/lib/auth";
import { notifyBoards, removeFiles } from "@/lib/board-events";

// 회차·차시 생성은 이후 axhub 연동으로 대체된다 (PLAN.md 5.1절).

export type ActionResult = { error?: string };

const DENIED = "권한이 없거나 요청을 처리하지 못했어요.";
const SYNCED = "axhub에서 가져온 항목은 axhub에서 수정해 주세요. 1시간마다 자동으로 반영돼요.";

// axhub에서 온 교육·회차·차시는 동기화가 관리한다 (PLAN.md 3절)
async function isSynced(table: "educations" | "rounds" | "lessons", id: string) {
  const column = { educations: "axhub_course_id", rounds: "axhub_round_id", lessons: "axhub_key" }[table];
  const supabase = await createClient();
  const { data } = await supabase.from(table).select(column).eq("id", id).maybeSingle();
  return !!(data as Record<string, unknown> | null)?.[column];
}

async function nextPosition(table: "rounds" | "lessons", column: string, id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from(table)
    .select("position")
    .eq(column, id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

export async function createRound(
  educationId: string,
  input: { title: string; description?: string },
): Promise<ActionResult> {
  await requireAdmin();
  if (await isSynced("educations", educationId)) return { error: SYNCED };
  const supabase = await createClient();
  const { error } = await supabase.from("rounds").insert({
    education_id: educationId,
    position: await nextPosition("rounds", "education_id", educationId),
    title: input.title,
    description: input.description ?? "",
  });
  if (error) return { error: DENIED };
  refresh();
  return {};
}

// 분반 없는 차시를 만들면 보드와 기본 섹션이 함께 생긴다.
export async function createLesson(
  educationId: string,
  roundId: string,
  input: { description?: string },
): Promise<ActionResult> {
  await requireAdmin();
  if (await isSynced("rounds", roundId)) return { error: SYNCED };
  const supabase = await createClient();
  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert({
      education_id: educationId,
      round_id: roundId,
      position: await nextPosition("lessons", "round_id", roundId),
      description: input.description ?? "",
    })
    .select("id")
    .single();
  if (error || !lesson) return { error: DENIED };

  const { data: board } = await supabase
    .from("boards")
    .insert({ education_id: educationId, lesson_id: lesson.id })
    .select("id")
    .single();
  if (board) await supabase.from("sections").insert({ board_id: board.id, position: 1, name: "수강생 게시판" });
  refresh();
  return {};
}

export async function updateRound(
  roundId: string,
  input: { title: string; description?: string },
): Promise<ActionResult> {
  await requireAdmin();
  if (await isSynced("rounds", roundId)) return { error: SYNCED };
  const supabase = await createClient();
  const { error } = await supabase
    .from("rounds")
    .update({ title: input.title, description: input.description ?? "" })
    .eq("id", roundId);
  if (error) return { error: DENIED };
  refresh();
  return {};
}

export async function updateLesson(lessonId: string, input: { description?: string }): Promise<ActionResult> {
  await requireAdmin();
  if (await isSynced("lessons", lessonId)) return { error: SYNCED };
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").update({ description: input.description ?? "" }).eq("id", lessonId);
  if (error) return { error: DENIED };
  refresh();
  return {};
}

// 회차·차시를 지우면 아래의 보드·섹션·카드가 함께 지워진다 (FK cascade). 첨부 파일도 정리한다.
export async function deleteRound(roundId: string): Promise<ActionResult> {
  return deleteWithBoards("rounds", roundId);
}

export async function deleteLesson(lessonId: string): Promise<ActionResult> {
  return deleteWithBoards("lessons", lessonId);
}

async function deleteWithBoards(table: "rounds" | "lessons", id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isSynced(table, id)) return { error: SYNCED };
  const supabase = await createClient();
  const lessonIds =
    table === "lessons"
      ? [id]
      : ((await supabase.from("lessons").select("id").eq("round_id", id)).data ?? []).map((l) => l.id);
  const boardIds = lessonIds.length
    ? ((await supabase.from("boards").select("id").in("lesson_id", lessonIds)).data ?? []).map((b) => b.id)
    : [];
  const files = boardIds.length
    ? ((await supabase.from("cards").select("attachment_path").in("board_id", boardIds)).data ?? []).map(
        (c) => c.attachment_path,
      )
    : [];

  const { data, error } = await supabase.from(table).delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: DENIED };
  await removeFiles(files);
  // 지워진 보드를 보고 있던 화면도 다시 읽어 "찾을 수 없음"으로 바뀌게 한다
  await notifyBoards(boardIds);
  refresh();
  return {};
}

// 교육 보드: 회차·차시 없이 교육에 바로 붙는 보드. axhub 교육에도 만들 수 있고 동기화가 건드리지 않는다.
// 기간형 보드(axhub_window_course_id)는 동기화가 관리하므로 고치거나 지울 수 없다.
const WINDOW_BOARD = "axhub 기간형 차시로 만든 보드는 axhub에서 관리해요. 1시간마다 자동으로 반영돼요.";

async function manualEducationBoard(boardId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("boards")
    .select("id, lesson_id, axhub_window_course_id")
    .eq("id", boardId)
    .maybeSingle();
  if (!data || data.lesson_id) return { error: DENIED };
  if (data.axhub_window_course_id) return { error: WINDOW_BOARD };
  return {};
}

export async function createEducationBoard(
  educationId: string,
  input: { name: string; description?: string },
): Promise<ActionResult> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { error: "보드 이름을 입력해 주세요." };
  const supabase = await createClient();
  const { data: board, error } = await supabase
    .from("boards")
    .insert({ education_id: educationId, name, description: input.description?.trim() ?? "" })
    .select("id")
    .single();
  if (error || !board) return { error: DENIED };
  await supabase.from("sections").insert({ board_id: board.id, position: 1, name: "수강생 게시판" });
  refresh();
  return {};
}

export async function updateEducationBoard(
  boardId: string,
  input: { name: string; description?: string },
): Promise<ActionResult> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { error: "보드 이름을 입력해 주세요." };
  const blocked = await manualEducationBoard(boardId);
  if (blocked.error) return blocked;
  const supabase = await createClient();
  const { error } = await supabase
    .from("boards")
    .update({ name, description: input.description?.trim() ?? "" })
    .eq("id", boardId);
  if (error) return { error: DENIED };
  await notifyBoards([boardId]);
  refresh();
  return {};
}

export async function deleteEducationBoard(boardId: string): Promise<ActionResult> {
  await requireAdmin();
  const blocked = await manualEducationBoard(boardId);
  if (blocked.error) return blocked;
  const supabase = await createClient();
  const { data: files } = await supabase.from("cards").select("attachment_path").eq("board_id", boardId);
  const { data, error } = await supabase.from("boards").delete().eq("id", boardId).select("id");
  if (error || !data?.length) return { error: DENIED };
  await removeFiles((files ?? []).map((c) => c.attachment_path));
  await notifyBoards([boardId]);
  refresh();
  return {};
}

// 이메일만으로 로그인하므로 등록만 하면 된다. 초대 링크·비밀번호 없음 (PLAN.md 2.1절).
function parseEmail(raw: string) {
  const email = raw.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "이메일 형식을 확인해 주세요." };
  if (email.endsWith(`@${ADMIN_DOMAIN}`)) return { error: "관리자는 이미 모든 교육을 볼 수 있어요." };
  return { email };
}

// 고객사 담당자를 교육에 등록한다 (읽기 전용).
export async function addViewer(educationId: string, rawEmail: string): Promise<ActionResult> {
  await requireAdmin();
  const { email, error: invalid } = parseEmail(rawEmail);
  if (!email) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("education_viewers")
    .upsert({ education_id: educationId, email, source: "manual" }, { onConflict: "education_id,email", ignoreDuplicates: true });
  if (error) return { error: DENIED };
  refresh();
  return {};
}

export async function removeViewer(educationId: string, email: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("education_viewers").delete().eq("education_id", educationId).eq("email", email);
  if (error) return { error: DENIED };
  refresh();
  return {};
}

// 보드에 강사를 등록한다. 이후 axhub 배정 동기화가 같은 테이블에 추가한다.
// 이미 교육생으로 참여한 사람이면 강사로 바꾼다.
export async function addInstructor(boardId: string, rawEmail: string): Promise<ActionResult> {
  await requireAdmin();
  const { email, error: invalid } = parseEmail(rawEmail);
  if (!email) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("board_members")
    // 직접 등록한 강사는 axhub 동기화가 회수하지 않는다
    .upsert({ board_id: boardId, email, role: "instructor", source: "manual" }, { onConflict: "board_id,email" });
  if (error) return { error: DENIED };
  refresh();
  return {};
}

export async function removeInstructor(boardId: string, email: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("board_members")
    .delete()
    .eq("board_id", boardId)
    .eq("email", email)
    .eq("role", "instructor");
  if (error) return { error: DENIED };
  refresh();
  return {};
}
