"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_DOMAIN, getOrigin } from "@/lib/auth";

// 로그인 방식 (PLAN.md 2.1절)
//   관리자(@teamsparta.co) : Google
//   그 외 모든 주체        : 이메일만 입력. 비밀번호·메일 인증 없음 (감수한 위험, PLAN.md 2.1절)
// 이메일만으로 로그인하는 방식은 서버에서 service role로 로그인 토큰을 만들어 바로 세션으로 바꾼다.

// values: 에러 후 폼을 다시 채우기 위한 입력값
export type FormResult = { error?: string; values?: { name?: string; email?: string } };

const normalizeEmail = (v: FormDataEntryValue | null) => String(v ?? "").trim().toLowerCase();
const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v);
const isAdminEmail = (email: string) => email.endsWith(`@${ADMIN_DOMAIN}`);

const ADMIN_USE_GOOGLE = "팀스파르타 계정은 Google 로그인을 이용해 주세요.";
const FAILED = "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

// 로그인 화면. 계정이 있거나, 관리자가 고객사 담당자·강사로 등록한 이메일이면 들어온다.
export async function signInWithEmail(_: FormResult, formData: FormData): Promise<FormResult> {
  const email = normalizeEmail(formData.get("email"));
  const next = safeNext(formData.get("next"));
  const values = { email };
  if (!isEmail(email)) return { error: "이메일 형식을 확인해 주세요.", values };
  if (isAdminEmail(email)) return { error: ADMIN_USE_GOOGLE, values };

  const admin = createAdminClient();
  if (!(await findProfile(email)) && !(await isRegistered(email))) {
    return {
      error: "등록되지 않은 이메일이에요. 교육생은 강사에게 받은 보드 URL로 들어와 참여해 주세요.",
      values,
    };
  }
  if (!(await ensureUser(admin, email))) return { error: FAILED, values };
  if (!(await startSession(email))) return { error: FAILED, values };

  // 보드 URL에서 로그인했으면 그 보드로 돌아가 참여시킨다.
  if (next.startsWith("/b/")) await joinBoardById(next.slice(3));
  redirect(next);
}

// needName: 처음 보는 이메일이라 이름을 더 받아야 한다
export type EnterResult = FormResult & { needName?: boolean };

// 보드 URL의 입장 화면. 이메일을 먼저 받는다.
// 이미 계정이 있거나 강사·고객사 담당자로 등록된 이메일이면 바로 들어가고,
// 처음 보는 이메일이면 이름을 받아 계정을 만든다. 어느 쪽이든 들어온 보드에 참여한다.
export async function enterBoard(_: EnterResult, formData: FormData): Promise<EnterResult> {
  const boardId = String(formData.get("boardId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(formData.get("email"));
  const values = { name, email };
  if (!isEmail(email)) return { error: "이메일 형식을 확인해 주세요.", values };
  if (isAdminEmail(email)) return { error: ADMIN_USE_GOOGLE, values };

  const known = !!(await findProfile(email)) || (await isRegistered(email));
  if (!known && !name) return { needName: true, values };

  if (!(await ensureUser(createAdminClient(), email, name || undefined))) return { error: FAILED, values };
  if (!(await startSession(email))) return { error: FAILED, values };

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

// 보드에서 로그아웃하면 그 보드의 입장 화면으로, 그 외에는 로그인 화면으로 간다.
export async function signOut(from?: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const next = safeNext(from ?? "/");
  redirect(next.startsWith("/b/") ? next : "/");
}

export async function joinBoard(boardId: string) {
  await joinBoardById(boardId);
  redirect(`/b/${boardId}`);
}

async function joinBoardById(boardId: string) {
  const supabase = await createClient();
  await supabase.rpc("join_board", { bid: boardId });
}

async function findProfile(email: string) {
  const { data } = await createAdminClient().from("profiles").select("id").eq("email", email).maybeSingle();
  return data;
}

// 관리자가 고객사 담당자 또는 강사로 등록한 이메일인지
async function isRegistered(email: string) {
  const admin = createAdminClient();
  const [viewer, instructor] = await Promise.all([
    admin.from("education_viewers").select("email", { count: "exact", head: true }).eq("email", email),
    admin.from("board_members").select("email", { count: "exact", head: true }).eq("email", email).eq("role", "instructor"),
  ]);
  return !!(viewer.count || instructor.count);
}

// 계정이 없으면 비밀번호 없이 만든다 (가입 트리거가 profiles 행을 만든다).
async function ensureUser(admin: ReturnType<typeof createAdminClient>, email: string, name?: string) {
  if (await findProfile(email)) return true;
  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: name ? { name } : undefined,
  });
  return !error;
}

// 로그인 토큰을 발급해 곧바로 세션 쿠키로 바꾼다. 메일은 보내지 않는다.
async function startSession(email: string) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) return false;
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  return !verifyError;
}

// 외부 주소로 보내는 오픈 리디렉트를 막는다.
function safeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? "/");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
