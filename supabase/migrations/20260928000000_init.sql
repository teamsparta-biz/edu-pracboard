-- PracBoard 초기 스키마. 권한 설계는 docs/PLAN.md 2.1, 2.2절 기준.
--
-- 권한 판단
--   관리자       : Google 로그인 + @teamsparta.co (테이블 없음)
--   고객사 담당자 : education_viewers (교육 × 이메일, 읽기 전용)
--   강사 / 교육생 : board_members (보드 × 이메일 × 역할)
-- 권한 테이블은 user_id 대신 email을 키로 둔다. 가입 전에도 권한을 미리 부여할 수 있게 하기 위함.

-- ─────────────────────────────────────────────
-- 사용자
-- ─────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (email = lower(email)),
  name text not null default '',
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 교육 계층: 교육 → 회차 → 차시 → (분반) → 보드
-- axhub_* 컬럼은 axhub 원본 id. 연동 전 직접 만든 데이터는 null.
-- 하위 테이블에 education_id를 비정규화해 RLS 판단을 한 번의 조회로 끝낸다.
-- ─────────────────────────────────────────────

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  axhub_client_id uuid unique,
  name text not null,
  domain text,
  created_at timestamptz not null default now()
);

create table public.educations (
  id uuid primary key default gen_random_uuid(),
  axhub_course_id uuid unique,
  company_id uuid references public.companies (id) on delete set null,
  -- axhub 원본 교육명. "[기업명] - 교육명" 형태
  name text not null,
  created_at timestamptz not null default now()
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  axhub_round_id uuid unique,
  education_id uuid not null references public.educations (id) on delete cascade,
  position int not null,
  title text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  axhub_session_id uuid unique,
  education_id uuid not null references public.educations (id) on delete cascade,
  round_id uuid not null references public.rounds (id) on delete cascade,
  position int not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  education_id uuid not null references public.educations (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  position int not null,
  name text not null,
  created_at timestamptz not null default now()
);

-- 최소 단위 교육. 고유 URL /b/[id]
-- 분반이 없는 차시는 보드 1개, 분반이 있으면 분반마다 보드 1개.
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  education_id uuid not null references public.educations (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  division_id uuid unique references public.divisions (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index boards_one_per_lesson on public.boards (lesson_id) where division_id is null;

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  position int not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (id, board_id)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  section_id uuid not null,
  title text not null default '',
  content text not null default '',
  image text,
  link text,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null,
  created_at timestamptz not null default now(),
  -- 카드의 섹션과 보드가 어긋나지 않게 한다
  foreign key (section_id, board_id) references public.sections (id, board_id) on delete cascade
);

create index rounds_education_idx on public.rounds (education_id);
create index lessons_round_idx on public.lessons (round_id);
create index divisions_lesson_idx on public.divisions (lesson_id);
create index boards_lesson_idx on public.boards (lesson_id);
create index sections_board_idx on public.sections (board_id);
create index cards_section_idx on public.cards (section_id);
create index cards_board_idx on public.cards (board_id);

-- ─────────────────────────────────────────────
-- 권한
-- ─────────────────────────────────────────────

-- 고객사 담당자. axhub 교육 담당자는 자동(source = axhub), 관리자가 추가 등록(source = manual).
create table public.education_viewers (
  education_id uuid not null references public.educations (id) on delete cascade,
  email text not null check (email = lower(email)),
  source text not null check (source in ('axhub', 'manual')),
  created_at timestamptz not null default now(),
  primary key (education_id, email)
);

-- 강사는 axhub 배정 동기화로(추가만 하고 삭제하지 않는다), 교육생은 보드 URL 가입으로 등록된다.
create table public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('instructor', 'student')),
  created_at timestamptz not null default now(),
  primary key (board_id, email)
);

create index education_viewers_email_idx on public.education_viewers (email);
create index board_members_email_idx on public.board_members (email);

-- ─────────────────────────────────────────────
-- 권한 판단 함수
-- security definer: RLS가 걸린 권한 테이블을 정책 안에서 조회하기 위함
-- ─────────────────────────────────────────────

create function public.current_email() returns text
language sql stable
as $$ select lower(auth.jwt() ->> 'email') $$;

-- app_metadata는 사용자가 수정할 수 없으므로 provider 판단에 쓸 수 있다.
create function public.is_admin() returns boolean
language sql stable
as $$
  select coalesce(
    public.current_email() like '%@teamsparta.co'
      and (auth.jwt() -> 'app_metadata' -> 'providers') ? 'google',
    false
  )
$$;

create function public.can_view_education(eid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.education_viewers v
    where v.education_id = eid and v.email = public.current_email()
  )
$$;

-- 'admin' | 'instructor' | 'student' | 'viewer' | null
create function public.board_role(bid uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when public.is_admin() then 'admin'
    else coalesce(
      (select m.role from public.board_members m
        where m.board_id = bid and m.email = public.current_email()),
      (select 'viewer' from public.boards b
        join public.education_viewers v on v.education_id = b.education_id
        where b.id = bid and v.email = public.current_email())
    )
  end
$$;

-- 강사·교육생이 보드 화면에서 상위 계층 이름(교육명, 회차, 차시)을 볼 수 있게 한다.
create function public.is_education_member(eid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.board_members m
    join public.boards b on b.id = m.board_id
    where b.education_id = eid and m.email = public.current_email()
  )
$$;

create function public.can_view_hierarchy(eid uuid) returns boolean
language sql stable
as $$ select public.can_view_education(eid) or public.is_education_member(eid) $$;

create function public.can_manage_board(bid uuid) returns boolean
language sql stable
as $$ select coalesce(public.board_role(bid) in ('admin', 'instructor'), false) $$;

create function public.can_post(bid uuid) returns boolean
language sql stable
as $$ select coalesce(public.board_role(bid) in ('admin', 'instructor', 'student'), false) $$;

-- 보드 URL로 들어온 사용자를 교육생으로 등록한다. 이미 역할이 있으면 그대로 둔다.
create function public.join_board(bid uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  existing text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.boards where id = bid) then
    raise exception 'board not found';
  end if;

  existing := public.board_role(bid);
  if existing is not null then
    return existing;
  end if;

  insert into public.board_members (board_id, email, role)
  values (bid, public.current_email(), 'student');
  return 'student';
end
$$;

revoke execute on function public.join_board(uuid) from public, anon;
grant execute on function public.join_board(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- 가입 제어 (auth.users 트리거)
-- 교육생 가입은 이메일 인증이 없으므로, 권한 있는 이메일을 비밀번호 가입으로 선점하지 못하게 막는다.
-- 가입 폼뿐 아니라 공개 키로 Auth API를 직접 호출하는 경우도 여기서 걸린다.
--   - @teamsparta.co 는 Google 로그인만
--   - 강사·고객사 담당자로 등록된 이메일은 초대(invited_at)로만
-- ─────────────────────────────────────────────

create function public.guard_signup() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  addr text := lower(new.email);
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', 'email') <> 'email' then
    return new;
  end if;

  if addr like '%@teamsparta.co' then
    raise exception 'PRACBOARD_ADMIN_USE_GOOGLE';
  end if;

  if new.invited_at is null and (
    exists (select 1 from public.education_viewers where email = addr)
    or exists (select 1 from public.board_members where email = addr and role = 'instructor')
  ) then
    raise exception 'PRACBOARD_USE_INVITE';
  end if;

  return new;
end
$$;

create trigger guard_signup
  before insert on auth.users
  for each row execute function public.guard_signup();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- RLS
-- 교육 계층의 생성·수정·삭제는 관리자만 (이후 axhub 동기화는 service role로 RLS를 우회한다).
-- ─────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.educations enable row level security;
alter table public.rounds enable row level security;
alter table public.lessons enable row level security;
alter table public.divisions enable row level security;
alter table public.boards enable row level security;
alter table public.sections enable row level security;
alter table public.cards enable row level security;
alter table public.education_viewers enable row level security;
alter table public.board_members enable row level security;

create policy "본인 또는 관리자" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "본인 수정" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and email = public.current_email());

create policy "관리자 또는 해당 교육 열람자" on public.companies for select
  using (public.is_admin() or exists (
    select 1 from public.educations e
    where e.company_id = companies.id and public.can_view_hierarchy(e.id)
  ));
create policy "관리자 관리" on public.companies for all
  using (public.is_admin()) with check (public.is_admin());

create policy "열람" on public.educations for select using (public.can_view_hierarchy(id));
create policy "관리자 관리" on public.educations for all
  using (public.is_admin()) with check (public.is_admin());

create policy "열람" on public.rounds for select using (public.can_view_hierarchy(education_id));
create policy "관리자 관리" on public.rounds for all
  using (public.is_admin()) with check (public.is_admin());

create policy "열람" on public.lessons for select using (public.can_view_hierarchy(education_id));
create policy "관리자 관리" on public.lessons for all
  using (public.is_admin()) with check (public.is_admin());

create policy "열람" on public.divisions for select using (public.can_view_hierarchy(education_id));
create policy "관리자 관리" on public.divisions for all
  using (public.is_admin()) with check (public.is_admin());

-- 보드는 URL로 들어와 가입하기 전에도 존재 여부와 이름을 보여줘야 하므로 join_board()가 따로 확인한다.
create policy "열람" on public.boards for select
  using (public.can_view_education(education_id) or public.board_role(id) is not null);
create policy "관리자 관리" on public.boards for all
  using (public.is_admin()) with check (public.is_admin());

create policy "열람" on public.sections for select using (public.board_role(board_id) is not null);
create policy "관리" on public.sections for all
  using (public.can_manage_board(board_id)) with check (public.can_manage_board(board_id));

create policy "열람" on public.cards for select using (public.board_role(board_id) is not null);
create policy "작성" on public.cards for insert
  with check (public.can_post(board_id) and author_id = auth.uid());
-- 교육생은 본인 카드만 수정·삭제 (PLAN.md 7절 미정 사항, 우선 이렇게 둔다)
create policy "수정" on public.cards for update
  using (public.can_manage_board(board_id) or author_id = auth.uid())
  with check (public.can_post(board_id));
create policy "삭제" on public.cards for delete
  using (public.can_manage_board(board_id) or author_id = auth.uid());

create policy "관리자 또는 본인" on public.education_viewers for select
  using (public.is_admin() or email = public.current_email());
create policy "관리자 관리" on public.education_viewers for all
  using (public.is_admin()) with check (public.is_admin());

create policy "관리자, 본인, 보드 관리자" on public.board_members for select
  using (public.is_admin() or email = public.current_email() or public.can_manage_board(board_id));
create policy "관리자 관리" on public.board_members for all
  using (public.is_admin()) with check (public.is_admin());
