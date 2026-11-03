-- 상단 고정을 관리자·강사가 직접 켜고 끈다 (2026-11-03).
-- 지금까지는 카드를 만들 때 작성자 역할(관리자·강사)로만 정해지고 바꿀 수 없었다.
-- 이제 그 보드의 관리자·강사는 어떤 카드든(교육생 카드 포함) 고정하거나 고정을 풀 수 있다.
--   고정하면 그 섹션 고정 카드의 맨 뒤에 붙고, 풀면 순서 값이 지워져 교육생 카드 사이(올린 순서)로 돌아간다.
--   그 밖의 사람이 바꾸려 하면 조용히 원래 값으로 둔다(카드의 다른 칸 수정은 그대로 된다).
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
    return new;
  end if;

  if new.pinned is distinct from old.pinned then
    if public.can_manage_board(old.board_id) then
      new.pin_position := case when new.pinned then
        (select coalesce(max(c.pin_position), 0) + 1 from public.cards c
         where c.section_id = new.section_id and c.pinned and c.id <> new.id)
      end;
      return new;
    end if;
    new.pinned := old.pinned;
  end if;

  if new.pin_position is distinct from old.pin_position
     and not (old.pinned and public.can_manage_board(old.board_id)) then
    new.pin_position := old.pin_position;
  end if;
  return new;
end
$$;
