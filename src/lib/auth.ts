import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/types";

export const ADMIN_DOMAIN = "teamsparta.co";

// DB의 is_admin()과 같은 규칙. 화면 분기용이고, 실제 권한은 RLS가 강제한다.
function isAdminClaims(email: string, providers: unknown) {
  return (
    email.endsWith(`@${ADMIN_DOMAIN}`) && Array.isArray(providers) && providers.includes("google")
  );
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !claims.email) return null;

  const email = claims.email.toLowerCase();
  const { data: profile } = await supabase.from("profiles").select("name").eq("id", claims.sub).maybeSingle();

  return {
    id: claims.sub,
    email,
    name: profile?.name || email.split("@")[0],
    isAdmin: isAdminClaims(email, claims.app_metadata?.providers),
  };
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}

// 로그인 후 이동할 화면. 관리자 → 전체 교육, 고객사 담당자 → 내 교육, 그 외 → 보드
export async function homePath(user: SessionUser) {
  if (user.isAdmin) return "/admin";
  const supabase = await createClient();
  const { count } = await supabase
    .from("education_viewers")
    .select("education_id", { count: "exact", head: true })
    .eq("email", user.email);
  if (count) return "/client";
  if (await isInstructor(user.email)) return "/instructor";
  return "/";
}

// 강사로 등록된 보드가 하나라도 있는지 (강사 화면 입장 조건)
export async function isInstructor(email: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("board_members")
    .select("board_id", { count: "exact", head: true })
    .eq("email", email)
    .eq("role", "instructor");
  return !!count;
}

export async function getOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
