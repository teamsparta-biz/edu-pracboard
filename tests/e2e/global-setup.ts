import { request, type FullConfig } from "@playwright/test";
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import { ADMIN_STATE, PRODUCTION_PROJECT_REF, service } from "./helpers";

// 1) 운영 DB가 아닌지, 키가 이 프로젝트 것인지 확인한다.
// 2) 첨부 파일 버킷을 준비한다.
// 3) 테스트 관리자 계정을 준비하고, 테스트 전용 로그인(/api/test-login)으로 세션을 만들어 저장한다.
export default async function globalSetup(config: FullConfig) {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL이 없어요 (.env.e2e).");
  if (url.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error(`E2E가 운영 DB(${PRODUCTION_PROJECT_REF})를 가리키고 있어 멈춥니다. .env.e2e를 확인하세요.`);
  }
  console.log(`[e2e] Supabase 대상: ${url}`);

  // 테스트 서버(next dev)는 .env.local(운영)도 읽는다. 이미 설정된 변수(빈 값 포함)는 덮어쓰지 않으므로,
  // 앱이 쓰는 변수(.env.local.example)가 모두 .env.e2e에 있어야 운영 값이 섞이지 않는다.
  const required = fs
    .readFileSync(".env.local.example", "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=/)?.[1])
    .filter((k): k is string => !!k);
  const missing = required.filter((k) => process.env[k] === undefined);
  if (missing.length) {
    throw new Error(`.env.e2e에 없는 변수가 있어 운영 값이 섞일 수 있어요: ${missing.join(", ")}. 값이 필요 없으면 빈 값으로라도 적어 주세요.`);
  }

  // 키가 다른 프로젝트 것이면 형식과 길이가 같아도 여기서 거부된다
  const db = service();
  const { error: authError } = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (authError) throw new Error(`SUPABASE_SERVICE_ROLE_KEY가 이 프로젝트에서 동작하지 않아요: ${authError.message}`);

  const { data: bucket } = await db.storage.getBucket("card-images");
  if (!bucket) {
    const { error } = await db.storage.createBucket("card-images", { public: false, fileSizeLimit: "50MB" });
    if (error) throw new Error(`첨부 파일 버킷을 만들지 못했어요: ${error.message}`);
    console.log("[e2e] card-images 버킷 생성");
  }

  await ensureTestAdmin(db);

  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3100";
  const secret = process.env.TEST_LOGIN_SECRET;
  if (!secret) throw new Error("TEST_LOGIN_SECRET이 없어요 (.env.e2e).");
  const context = await request.newContext({ baseURL });
  const res = await context.get(`/api/test-login?secret=${encodeURIComponent(secret)}`);
  if (!res.ok()) throw new Error(`테스트 관리자 로그인 실패 (${res.status()}): ${await res.text()}`);
  const { providers } = await res.json();
  if (!providers?.includes("google")) throw new Error(`테스트 관리자 세션에 Google 로그인이 없어요 (${providers}). 관리자로 인정되지 않습니다.`);
  fs.mkdirSync(path.dirname(ADMIN_STATE), { recursive: true });
  await context.storageState({ path: ADMIN_STATE });
  await context.dispose();
}

// 관리자 판단(is_admin)은 "Google 로그인 + @teamsparta.co"다. Supabase는 로그인할 때마다 연결된
// 로그인 수단(auth.identities)으로 app_metadata.providers를 다시 계산하므로, app_metadata만 고쳐서는
// 안 되고 Google 로그인 수단을 실제로 연결해 둬야 한다. E2E DB에만 하는 일이다.
const TEST_ADMIN_EMAIL = "e2e-admin@teamsparta.co";

async function ensureTestAdmin(db: ReturnType<typeof service>) {
  const { error } = await db.auth.admin.createUser({
    email: TEST_ADMIN_EMAIL,
    email_confirm: true,
    user_metadata: { name: "E2E 관리자" },
  });
  if (error && !error.message.toLowerCase().includes("already been registered")) {
    throw new Error(`테스트 관리자 계정을 만들지 못했어요: ${error.message}`);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL이 없어요 (.env.e2e). 테스트 관리자에 Google 로그인을 연결하는 데 필요해요.");
  if (url.includes(PRODUCTION_PROJECT_REF)) throw new Error("DATABASE_URL이 운영 DB예요. 멈춥니다.");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`
      insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
      select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'google', now(), now()
      from auth.users u
      where u.email = ${TEST_ADMIN_EMAIL}
        and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')`;
  } finally {
    await sql.end();
  }
}
