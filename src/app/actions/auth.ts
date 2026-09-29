"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_DOMAIN, getOrigin } from "@/lib/auth";

// values: 에러 후 폼을 다시 채우기 위한 입력값 (비밀번호 제외)
export type FormResult = { error?: string; values?: { name?: string; email?: string } };

const normalizeEmail = (v: FormDataEntryValue | null) => String(v ?? "").trim().toLowerCase();

// Supabase·DB 트리거(guard_signup) 에러를 화면 문구로 바꾼다.
function authErrorMessage(message: string) {
  if (message.includes("PRACBOARD_ADMIN_USE_GOOGLE")) {
    return "팀스파르타 계정은 Google 로그인을 이용해 주세요.";
  }
  if (message.includes("PRACBOARD_USE_INVITE")) {
    return "강사·고객사 담당자로 등록된 이메일이에요. 전달받은 초대 링크로 비밀번호를 설정해 주세요.";
  }
  if (message.includes("already registered")) return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (message.includes("Invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않아요.";
  if (message.includes("Password should be")) return "비밀번호는 6자 이상이어야 해요.";
  return "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

function isAdminEmail(email: string) {
  return email.endsWith(`@${ADMIN_DOMAIN}`);
}

export async function signInWithPassword(_: FormResult, formData: FormData): Promise<FormResult> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const values = { email };
  if (isAdminEmail(email)) return { error: authErrorMessage("PRACBOARD_ADMIN_USE_GOOGLE"), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error.message), values };

  // 보드 URL에서 로그인했으면 그 보드로 돌아가 참여시킨다.
  if (next.startsWith("/b/")) await joinBoardById(next.slice(3));
  redirect(next);
}

// 교육생 가입. 이메일 인증 없이 바로 로그인되고, 들어온 보드에 교육생으로 등록된다.
export async function signUpStudent(_: FormResult, formData: FormData): Promise<FormResult> {
  const boardId = String(formData.get("boardId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const values = { name, email };
  if (!name) return { error: "이름을 입력해 주세요.", values };
  if (isAdminEmail(email)) return { error: authErrorMessage("PRACBOARD_ADMIN_USE_GOOGLE"), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  if (error) return { error: authErrorMessage(error.message), values };

  await joinBoardById(boardId);
  redirect(`/b/${boardId}`);
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await getOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      // Google 계정 선택 화면에서 회사 계정을 먼저 보여준다
      queryParams: { hd: ADMIN_DOMAIN, prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/?error=google");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// 초대·비밀번호 재설정 링크로 들어온 사용자가 비밀번호를 정한다.
export async function setPassword(_: FormResult, formData: FormData): Promise<FormResult> {
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "비밀번호가 서로 달라요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error.message) };
  redirect("/");
}

export async function joinBoard(boardId: string) {
  await joinBoardById(boardId);
  redirect(`/b/${boardId}`);
}

async function joinBoardById(boardId: string) {
  const supabase = await createClient();
  await supabase.rpc("join_board", { bid: boardId });
}

// 외부 주소로 보내는 오픈 리디렉트를 막는다.
function safeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? "/");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
