-- 1) 고정 카드 순서 (2026-11-02)
-- 관리자·강사가 고정 카드끼리의 순서를 끌어다 놓아 바꿀 수 있다. 교육생 카드는 그대로 올린 순서대로 온다.
-- 순서 값은 고정 카드에만 있고(섹션 안 1, 2, 3...), 새로 고정되는 카드는 그 섹션의 맨 뒤에 붙는다.

alter table public.cards add column pin_position double precision;

-- 이미 있는 고정 카드는 올린 순서대로 번호를 매긴다 (트리거를 바꾸기 전에 채운다)
update public.cards c
set pin_position = o.n
from (
  select id, row_number() over (partition by section_id order by created_at) as n
  from public.cards where pinned
) o
where o.id = c.id;

-- 고정 여부에 더해 순서도 DB가 지킨다: 만들 때 섹션 맨 뒤 번호를 주고,
-- 수정할 때는 그 보드의 관리자·강사만 고정 카드의 순서를 바꿀 수 있다.
create or replace function public.set_card_pinned() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- 서버(service role)가 직접 넣는 경우 board_role은 null이라 고정되지 않는다
    new.pinned := coalesce(public.board_role(new.board_id) in ('admin', 'instructor'), false);
    new.pin_position := case when new.pinned then
      (select coalesce(max(c.pin_position), 0) + 1 from public.cards c where c.section_id = new.section_id and c.pinned)
    end;
  else
    new.pinned := old.pinned;
    if new.pin_position is distinct from old.pin_position
       and not (old.pinned and public.can_manage_board(old.board_id)) then
      new.pin_position := old.pin_position;
    end if;
  end if;
  return new;
end
$$;

-- 한 섹션의 고정 카드 순서를 ids 순서로 맞춘다. 호출한 사람 권한(RLS)으로 돈다.
-- 섹션의 보드를 관리할 수 없으면 거부한다. ids에 없는 카드나 고정되지 않은 카드는 건드리지 않는다.
create function public.reorder_pinned_cards(sid uuid, ids uuid[]) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  bid uuid;
begin
  select board_id into bid from public.sections where id = sid;
  if bid is null or not public.can_manage_board(bid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.cards c
  set pin_position = o.n
  from unnest(ids) with ordinality as o(id, n)
  where c.id = o.id and c.section_id = sid and c.pinned;
  return bid;
end
$$;

drop index public.cards_board_order_idx;
create index cards_board_order_idx on public.cards (board_id, pinned desc, pin_position, created_at);

-- 2) 링크 미리보기 이미지
-- 카드를 저장할 때 서버가 링크 페이지의 대표 이미지(og:image)를 찾아 넣는다. 없으면 null.
alter table public.cards add column link_image text;
