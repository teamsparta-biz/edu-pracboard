-- API 역할의 테이블 권한을 명시한다.
-- 예전에 만든 Supabase 프로젝트(운영)는 public 테이블에 이 권한이 자동으로 붙지만, 최근 만든 프로젝트(E2E)는
-- 자동으로 붙지 않아 service role조차 "permission denied"가 난다. 어느 프로젝트에서든 같게 동작하도록 적는다.
-- 운영에는 이미 있는 권한이라 적용해도 달라지는 것이 없다. 행 단위 접근은 여전히 RLS가 막는다.
-- anon(로그인 전)은 테이블을 직접 읽지 않는다 (가입 전 보드 미리보기는 서버가 service role로 읽는다).

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
