import "server-only";
import { createClient } from "@supabase/supabase-js";

// service role 클라이언트. RLS를 우회하므로 서버에서, 권한을 먼저 확인한 뒤에만 쓴다.
// 용도: 가입 전 보드 미리보기, 초대 링크 발급, 이미지 업로드 URL 발급.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
