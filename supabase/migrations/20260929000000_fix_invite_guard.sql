-- 가입 제어 수정: 초대(generateLink invite)가 막히던 문제.
-- GoTrue는 초대 계정을 만든 뒤 invited_at을 별도 UPDATE로 기록하므로, INSERT 시점에는 invited_at이 비어 있다.
-- 대신 비밀번호 유무로 구분한다: 비밀번호 가입은 INSERT 시점에 비밀번호가 있고, 초대 계정은 비어 있다.

create or replace function public.guard_signup() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  addr text := lower(new.email);
begin
  -- Google 등 외부 로그인, 비밀번호 없는 계정(초대)은 통과
  if coalesce(new.raw_app_meta_data ->> 'provider', 'email') <> 'email'
    or coalesce(new.encrypted_password, '') = '' then
    return new;
  end if;

  if addr like '%@teamsparta.co' then
    raise exception 'PRACBOARD_ADMIN_USE_GOOGLE';
  end if;

  if exists (select 1 from public.education_viewers where email = addr)
    or exists (select 1 from public.board_members where email = addr and role = 'instructor') then
    raise exception 'PRACBOARD_USE_INVITE';
  end if;

  return new;
end
$$;
