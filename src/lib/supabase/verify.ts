import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { verifyOnServer } from "@/app/actions/auth";
import { createClient } from "./client";

// 서버가 만든 로그인 토큰을 브라우저에서 세션 쿠키로 바꾼다 (PLAN.md 2.1절).
// 토큰 확인(/auth/v1/verify)은 Supabase가 IP마다 횟수를 제한한다(한 번에 30회, 이후 설정한 속도).
// 서버에서 확인하면 모든 사람이 서버 IP 하나를 같이 쓰므로, 각자의 IP로 나가도록 브라우저에서 한다.
// 교육장처럼 여럿이 같은 IP를 쓰면 한도에 걸릴 수 있어서, 걸리면 최대 1분 동안 다시 해 본다.
// 기다리는 간격을 무작위로 섞어 모두가 같은 순간에 다시 몰리지 않게 한다.
// 회사 방화벽 등으로 브라우저가 Supabase에 닿지 못하면 서버가 대신 확인한다.
const RETRY_FOR_MS = 60_000;

export async function verifyInBrowser(tokenHash: string): Promise<string | null> {
  const supabase = createClient();
  const giveUpAt = Date.now() + RETRY_FOR_MS;
  for (;;) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (!error) return null;
    if (isAuthRetryableFetchError(error)) return verifyOnServer(tokenHash);
    if (error.status !== 429) return "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
    if (Date.now() >= giveUpAt) return "지금 접속하는 사람이 많아요. 잠시 뒤에 다시 눌러 주세요.";
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));
  }
}
