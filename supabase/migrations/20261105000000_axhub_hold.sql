-- axhub에서 사라진 교육·보드 보관 (2026-11-05)
-- 카드가 있는 교육·보드는 바로 지우지 않고 사라진 시각을 적어 두었다가, 보관 기간(30일)이 지나면 동기화가 지운다.
-- 그 사이 axhub에 다시 나타나면 표시를 지우고 원래 자리로 돌아간다. 운영자 실수(회차 취소 후 되돌림 등)로 결과물이 사라지지 않게 하기 위함.
-- 차시가 사라진 보드는 차시에서 떼어 교육 보드로 옮겨 둔다 (lesson_id = null, 이름 = 원래 위치).

alter table public.educations add column axhub_missing_since timestamptz;
alter table public.boards add column axhub_missing_since timestamptz;
