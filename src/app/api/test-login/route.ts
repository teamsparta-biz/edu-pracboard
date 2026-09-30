import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// E2E 전용 관리자 로그인. 실제 관리자 로그인은 Google이라 자동 테스트가 통과할 수 없다.
// Playwright globalSetup이 테스트 관리자 계정(Google 로그인 수단이 연결된 @teamsparta.co)을 준비한 뒤
// 이 주소를 한 번 불러 쿠키 세션을 만들고, 관리자 테스트가 그 세션을 쓴다 (tests/e2e/global-setup.ts).
// 세션은 앱의 createClient()로 만들어 @supabase/ssr이 쓰는 쿠키 형식 그대로 저장된다.
//
// 세 조건이 모두 맞아야만 동작한다. 운영 배포에서는 어느 것도 성립하지 않는다.
//   1) NODE_ENV가 production이 아님 (next dev)
//   2) TEST_LOGIN_SECRET이 설정돼 있고 요청의 secret과 같음
//   3) 연결된 Supabase가 운영 프로젝트가 아님
const PRODUCTION_PROJECT_REF = "akmkalrrxcotdygsybpp";
const TEST_ADMIN_EMAIL = "e2e-admin@teamsparta.co";

export async function GET(request: Request) {
  const secret = process.env.TEST_LOGIN_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (process.env.NODE_ENV === "production" || !secret || url.includes(PRODUCTION_PROJECT_REF)) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  if (new URL(request.url).searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: link, error: linkError } = await createAdminClient().auth.admin.generateLink({
    type: "magiclink",
    email: TEST_ADMIN_EMAIL,
  });
  if (linkError || !link.properties?.hashed_token) {
    return NextResponse.json({ error: linkError?.message ?? "no token" }, { status: 500 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, providers: data.user?.app_metadata?.providers });
}
