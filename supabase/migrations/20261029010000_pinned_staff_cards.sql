-- 관리자·강사가 올린 카드는 섹션 맨 앞에 고정한다 (2026-10-29).
-- 고정 카드끼리는 올린 순서대로, 그 뒤에 교육생 카드가 올린 순서대로 온다.
-- 고정 여부는 화면이 아니라 DB가 정한다: 카드를 만들 때 작성자의 보드 역할(board_role)로 채우고, 이후에는 바꿀 수 없다.

alter table public.cards add column pinned boolean not null default false;

-- 이미 있는 카드 (트리거를 만들기 전에 채운다. 트리거는 수정 시 고정 여부를 바꾸지 못하게 한다): 그 보드의 강사이거나 관리자(@teamsparta.co)가 쓴 카드를 고정한다
update public.cards c
set pinned = true
from public.profiles p
where p.id = c.author_id
  and (
    p.email like '%@teamsparta.co'
    or exists (
      select 1 from public.board_members m
      where m.board_id = c.board_id and m.email = p.email and m.role = 'instructor'
    )
  );

create function public.set_card_pinned() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- 서버(service role)가 직접 넣는 경우 board_role은 null이라 고정되지 않는다
    new.pinned := coalesce(public.board_role(new.board_id) in ('admin', 'instructor'), false);
  else
    new.pinned := old.pinned;
  end if;
  return new;
end
$$;

create trigger cards_set_pinned
  before insert or update on public.cards
  for each row execute function public.set_card_pinned();

create index cards_board_order_idx on public.cards (board_id, pinned desc, created_at);
