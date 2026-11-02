-- 교육 단위 보드 (2026-11-02)
-- 회차·차시에 속하지 않고 교육에 바로 붙는 보드. URL(/b/[id])과 섹션·카드 구성은 차시 보드와 같다.
--   - 수동 보드: 관리자가 교육 화면에서 직접 만든다. axhub 교육에도 만들 수 있고, 동기화가 건드리지 않는다.
--   - 기간형 보드: axhub의 기간형 차시(course_sessions.commitment = 'window')는 차시를 만들지 않고
--     그 교육의 보드 하나로 모은다. 동기화가 만들고 지운다 (axhub_window_course_id = axhub courses.id).

alter table public.boards alter column lesson_id drop not null;
alter table public.boards
  add column name text,
  add column description text not null default '',
  add column axhub_window_course_id uuid unique;

-- 차시 보드는 차시가, 교육 보드는 이름이 있어야 한다. 분반은 차시 보드에만 붙는다.
alter table public.boards add constraint boards_lesson_or_name
  check ((lesson_id is not null) or (name is not null and division_id is null));
