"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_DOMAIN, requireAdmin } from "@/lib/auth";

// 회차·차시 생성은 이후 axhub 연동으로 대체된다 (PLAN.md 5.1절).

export type ActionResult = { error?: string };

const DENIED = "권한이 없거나 요청을 처리하지 못했어요.";

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
    .upsert({ board_id: boardId, email, role: "instructor" }, { onConflict: "board_id,email" });
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
