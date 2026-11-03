-- 강사 권한의 출처. axhub 동기화가 준 권한은 axhub에서 배정이 빠지면 회수하고,
-- 관리자가 보드 화면에서 직접 등록한 강사는 동기화가 건드리지 않는다 (2026-11-03).
--   axhub  : 동기화가 axhub 배정(주강사·기술튜터·멘토)으로 준 권한
--   manual : 관리자가 직접 등록
--   null   : 교육생, 또는 이 컬럼 전에 생긴 강사 권한. 첫 동기화 때 axhub 배정에 있으면 axhub,
--            없으면 manual로 정한다 (예전에 직접 등록한 강사가 회수되지 않게).
alter table public.board_members
  add column source text check (source in ('axhub', 'manual'));
