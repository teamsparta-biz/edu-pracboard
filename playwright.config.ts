import { defineConfig, devices } from "@playwright/test";

// E2E는 전용 Supabase 프로젝트(.env.e2e)에서만 돈다. .env.local(운영)은 읽지 않는다.
// 이 설정 파일과 globalSetup은 Node로 바로 실행되므로 env 파일을 직접 읽는다.
try {
  process.loadEnvFile(".env.e2e");
} catch {
  throw new Error(".env.e2e가 없어요. E2E 전용 Supabase 프로젝트 값을 넣어 주세요 (.env.local은 운영이라 쓰지 않습니다).");
}

const PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = `http://localhost:${PORT}`;
const env = (key: string) => (process.env[key] ?? "").trim();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // 테스트마다 자기 교육·보드를 만들고 지운다. 같은 DB를 쓰므로 순서대로 돌린다.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // next dev는 항상 NODE_ENV=development라 테스트 전용 로그인(/api/test-login)이 켜진다.
    command: `npx next dev -p ${PORT}`,
    // Next는 .env.local(운영)을 스스로 읽지만, 이미 있는 환경변수는 덮어쓰지 않는다.
    // 그래서 여기서 E2E 값을 넘기는 것이 서버를 E2E 프로젝트로 향하게 한다. 빈 값도 "설정됨"으로 친다.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: env("NEXT_PUBLIC_SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: env("SUPABASE_SERVICE_ROLE_KEY"),
      AXHUB_DATABASE_URL: env("AXHUB_DATABASE_URL"),
      CRON_SECRET: env("CRON_SECRET"),
      TEST_LOGIN_SECRET: env("TEST_LOGIN_SECRET"),
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
