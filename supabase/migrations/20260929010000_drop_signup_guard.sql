-- 가입 제어 트리거 삭제.
-- 로그인이 "이메일만 입력"으로 바뀌어(PLAN.md 2.1절) 비밀번호 가입으로 이메일을 선점하는 걸 막을 이유가 없어졌다.
-- 게다가 GoTrue는 관리자 API로 비밀번호 없이 만든 계정에도 비밀번호 값을 채우므로,
-- 이 트리거가 등록된 강사·고객사 담당자의 계정 생성을 막고 있었다.
-- 관리자 판단은 여전히 is_admin()(Google 로그인 + @teamsparta.co)이 하므로 영향이 없다.

drop trigger if exists guard_signup on auth.users;
drop function if exists public.guard_signup();
