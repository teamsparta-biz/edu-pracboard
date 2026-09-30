// supabase/migrations를 DATABASE_URL의 DB에 순서대로 적용한다. 적용한 것은 supabase_migrations.schema_migrations에 남긴다.
//
//   npm run db:migrate:e2e        (.env.e2e의 E2E 프로젝트)
//
// 운영 DB에는 쓰지 않는다: 접속 문자열의 프로젝트가 같은 파일의 NEXT_PUBLIC_SUPABASE_URL과 같고,
// 운영 프로젝트가 아닐 때만 실행한다. 운영 마이그레이션은 지금처럼 SQL Editor로 적용한다.

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const PRODUCTION_PROJECT_REF = "akmkalrrxcotdygsybpp";

const url = process.env.DATABASE_URL;
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url) throw new Error("DATABASE_URL이 없어요.");

// 풀러 주소의 사용자 이름은 "postgres.<project-ref>"
const dbRef = new URL(url).username.split(".")[1] ?? new URL(url).hostname.split(".")[1];
const apiRef = new URL(apiUrl).hostname.split(".")[0];
if (!dbRef || dbRef !== apiRef) throw new Error(`DB(${dbRef})와 API(${apiRef})의 프로젝트가 달라요. 멈춥니다.`);
if (dbRef === PRODUCTION_PROJECT_REF) throw new Error("운영 프로젝트예요. 이 스크립트는 운영 DB에 적용하지 않습니다.");
console.log(`대상 프로젝트: ${dbRef}`);

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql`create schema if not exists supabase_migrations`;
  await sql`create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, applied_at timestamptz default now())`;
  const applied = new Set((await sql`select version from supabase_migrations.schema_migrations`).map((r) => r.version));

  const dir = path.join(import.meta.dirname, "..", "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let count = 0;
  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (applied.has(version)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(fs.readFileSync(path.join(dir, file), "utf8"));
      await tx`insert into supabase_migrations.schema_migrations (version, name) values (${version}, ${rest.join("_")})`;
    });
    console.log(`적용: ${file}`);
    count++;
  }
  console.log(count ? `${count}개 적용했어요.` : "새로 적용할 마이그레이션이 없어요.");
} finally {
  await sql.end();
}
