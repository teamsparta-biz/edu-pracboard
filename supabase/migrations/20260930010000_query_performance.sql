-- 조회 성능 (운영 규모 측정: 관리자 교육 목록 21.8ms → 4.7ms, PGlite 기준).
--   1) education_id로 묶어 세는 조회(교육 목록의 회차·보드 수, 동기화)를 위한 인덱스
--   2) 관리자 확인을 행마다가 아니라 쿼리당 한 번만 계산하도록 (select is_admin())을 앞에 둔다 (initPlan).
--      관리자가 아니면 기존 판단 함수로 넘어가므로 권한 규칙은 바뀌지 않는다.

create index boards_education_idx on public.boards (education_id);
create index lessons_education_idx on public.lessons (education_id);
create index divisions_education_idx on public.divisions (education_id);

drop policy "열람" on public.educations;
create policy "열람" on public.educations for select using ((select public.is_admin()) or public.can_view_hierarchy(id));
drop policy "열람" on public.rounds;
create policy "열람" on public.rounds for select using ((select public.is_admin()) or public.can_view_hierarchy(education_id));
drop policy "열람" on public.lessons;
create policy "열람" on public.lessons for select using ((select public.is_admin()) or public.can_view_hierarchy(education_id));
drop policy "열람" on public.divisions;
create policy "열람" on public.divisions for select using ((select public.is_admin()) or public.can_view_hierarchy(education_id));
drop policy "열람" on public.boards;
create policy "열람" on public.boards for select
  using ((select public.is_admin()) or public.can_view_education(education_id) or public.board_role(id) is not null);
drop policy "열람" on public.sections;
create policy "열람" on public.sections for select using ((select public.is_admin()) or public.board_role(board_id) is not null);
drop policy "열람" on public.cards;
create policy "열람" on public.cards for select using ((select public.is_admin()) or public.board_role(board_id) is not null);
