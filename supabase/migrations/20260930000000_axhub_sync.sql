-- axhub 동기화 (PLAN.md 3절, 7절).
-- axhub가 원본이다. axhub에서 온 교육·회차·차시·분반·보드는 동기화가 만들고 고치고 지운다.
--
-- 대응 관계
--   교육 educations.axhub_course_id      = axhub courses.id
--   회차 rounds.axhub_round_id           = axhub course_rounds.id (status = active만)
--   차시 lessons.axhub_key               = "<round_id>:<날짜>:<같은 날 시간대 순번>"
--        같은 날 시간이 겹치는 axhub 차시들은 PracBoard 차시 하나 + 분반 여러 개가 된다.
--   분반 divisions.axhub_session_id      = axhub course_sessions.id
--   보드 boards.axhub_session_id         = axhub course_sessions.id (분반이 없어도 보드는 axhub 차시 하나에 대응)
-- 보드를 axhub 차시에 묶어 두므로, 분반이 생기거나 없어져도 보드(와 카드)는 그대로 옮겨진다.

alter table public.educations add column status text;

alter table public.lessons drop column axhub_session_id;
alter table public.lessons add column axhub_key text unique;

alter table public.divisions add column axhub_session_id uuid unique;
alter table public.boards add column axhub_session_id uuid unique;

-- axhub는 기업명만 준다 (client_name). 이름으로 고객사를 찾는다.
create unique index companies_name_key on public.companies (name);

-- 동기화 실행 기록. 관리자 화면에 마지막 동기화 결과를 보여주고, 동시에 두 번 도는 것을 막는 데 쓴다.
create table public.axhub_sync_runs (
  id bigint generated always as identity primary key,
  trigger text not null check (trigger in ('cron', 'manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  summary jsonb,
  error text
);

alter table public.axhub_sync_runs enable row level security;
create policy "관리자 조회" on public.axhub_sync_runs for select using (public.is_admin());

-- 확인용 예시 데이터 삭제 (axhub에서 오지 않은 교육). 아래 보드·카드까지 함께 지워진다.
delete from public.educations where axhub_course_id is null;
delete from public.companies c where not exists (select 1 from public.educations e where e.company_id = c.id);
