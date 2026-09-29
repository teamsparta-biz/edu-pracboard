"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_DOMAIN, getOrigin, requireAdmin } from "@/lib/auth";

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

export type InviteResult = { error?: string; inviteUrl?: string; existing?: boolean; selfSignup?: boolean };

// 고객사 담당자를 교육에 등록한다. 계정이 없으면 초대 링크를 만들어 돌려준다.
export async function addViewer(educationId: string, rawEmail: string): Promise<InviteResult> {
  await requireAdmin();
  const email = rawEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "이메일 형식을 확인해 주세요." };
  if (email.endsWith(`@${ADMIN_DOMAIN}`)) return { error: "관리자는 이미 모든 교육을 볼 수 있어요." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("education_viewers")
    .upsert({ education_id: educationId, email, source: "manual" }, { onConflict: "education_id,email", ignoreDuplicates: true });
  if (error) return { error: DENIED };

  refresh();
  return inviteLinkFor(email);
}

export async function removeViewer(educationId: string, email: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("education_viewers").delete().eq("education_id", educationId).eq("email", email);
  if (error) return { error: DENIED };
  refresh();
  return {};
}

// 초대 링크(계정 없음) 또는 비밀번호 재설정 링크(계정 있음)를 만든다.
// 메일 발송 없이 관리자가 링크를 복사해 직접 전달한다.
export async function createAccessLink(rawEmail: string): Promise<InviteResult> {
  await requireAdmin();
  return inviteLinkFor(rawEmail.trim().toLowerCase(), { forceRecovery: true });
}

async function inviteLinkFor(email: string, { forceRecovery = false } = {}): Promise<InviteResult> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();

  if (profile && !forceRecovery) {
    // 초대 없이 스스로 가입한 계정이면, 등록 전에 누군가 이메일을 선점했을 수 있다.
    const { data } = await admin.auth.admin.getUserById(profile.id);
    return { existing: true, selfSignup: !data.user?.invited_at };
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: profile ? "recovery" : "invite",
    email,
  });
  if (error || !data.properties?.hashed_token) return { error: "링크를 만들지 못했어요." };

  const type = profile ? "recovery" : "invite";
  const inviteUrl = `${await getOrigin()}/auth/confirm?token_hash=${data.properties.hashed_token}&type=${type}`;
  return { inviteUrl, existing: !!profile };
}
