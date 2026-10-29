-- 카드 하트와 댓글 (2026-10-29).
-- 남길 수 있는 사람은 카드를 올릴 수 있는 사람(관리자·강사·교육생, can_post)과 같다. 교육 담당자(viewer)는 보기만 한다.
-- 하트는 본인 것만 취소한다. 댓글은 작성자 본인과 보드 관리자(관리자·강사)가 지운다. 댓글 수정은 두지 않는다.
-- board_id를 비정규화해 RLS 판단을 cards와 같은 함수로 끝낸다. (card_id, board_id) 외래 키로 카드와 보드가 어긋나지 않게 한다.

alter table public.cards add constraint cards_id_board_key unique (id, board_id);

create table public.card_likes (
  card_id uuid not null,
  board_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id),
  foreign key (card_id, board_id) references public.cards (id, board_id) on delete cascade
);

create index card_likes_board_idx on public.card_likes (board_id);

create table public.card_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null,
  board_id uuid not null,
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null,
  created_at timestamptz not null default now(),
  foreign key (card_id, board_id) references public.cards (id, board_id) on delete cascade
);

create index card_comments_card_idx on public.card_comments (card_id, created_at);
create index card_comments_board_idx on public.card_comments (board_id);

alter table public.card_likes enable row level security;
alter table public.card_comments enable row level security;

create policy "열람" on public.card_likes for select using (public.board_role(board_id) is not null);
create policy "누르기" on public.card_likes for insert
  with check (public.can_post(board_id) and user_id = auth.uid());
create policy "취소" on public.card_likes for delete using (user_id = auth.uid());

create policy "열람" on public.card_comments for select using (public.board_role(board_id) is not null);
create policy "작성" on public.card_comments for insert
  with check (public.can_post(board_id) and author_id = auth.uid());
create policy "삭제" on public.card_comments for delete
  using (public.can_manage_board(board_id) or author_id = auth.uid());

-- 최근 만든 프로젝트(E2E)는 새 테이블에 API 역할 권한이 자동으로 붙지 않는다 (20260930020000_api_grants.sql)
grant select, insert, update, delete on public.card_likes, public.card_comments to authenticated, service_role;
