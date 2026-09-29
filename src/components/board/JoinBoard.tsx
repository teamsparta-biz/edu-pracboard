"use client";

import { useActionState, useState } from "react";
import { signInWithPassword, signUpStudent } from "@/app/actions/auth";
import { Divider, Field, FormError, GoogleButton, SubmitButton } from "@/components/auth/AuthFields";

type Props = {
  boardId: string;
  title: string;
  subtitle: string;
};

// 보드 URL로 처음 들어온 사용자의 가입·로그인 화면.
// 교육생은 이메일 인증 없이 바로 가입되고 이 보드에 교육생으로 등록된다.
export default function JoinBoard({ boardId, title, subtitle }: Props) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [signupState, signupAction] = useActionState(signUpStudent, {});
  const [loginState, loginAction] = useActionState(signInWithPassword, {});
  const isSignup = mode === "signup";

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-border p-7 shadow-sm">
        <div className="text-xs font-medium text-muted-foreground">{subtitle}</div>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignup
            ? "회원가입하면 이 보드에 실습 결과물을 올릴 수 있어요."
            : "가입한 이메일과 비밀번호로 로그인해 주세요."}
        </p>

        {isSignup ? (
          <form action={signupAction} key="signup">
            <input type="hidden" name="boardId" value={boardId} />
            <div className="mt-6 space-y-4">
              <Field label="이름" name="name" placeholder="홍길동" autoComplete="name" autoFocus defaultValue={signupState.values?.name} />
              <div>
                <Field label="이메일" name="email" type="email" placeholder="name@company.com" autoComplete="email" defaultValue={signupState.values?.email} />
                <p className="mt-1.5 text-xs text-muted-foreground">회사 이메일을 입력해 주세요.</p>
              </div>
              <Field label="비밀번호" name="password" type="password" minLength={6} autoComplete="new-password" />
            </div>
            <FormError message={signupState.error} />
            <SubmitButton>가입하고 참여하기</SubmitButton>
          </form>
        ) : (
          <form action={loginAction} key="login">
            <input type="hidden" name="next" value={`/b/${boardId}`} />
            <div className="mt-6 space-y-4">
              <Field label="이메일" name="email" type="email" placeholder="name@company.com" autoComplete="email" autoFocus defaultValue={loginState.values?.email} />
              <Field label="비밀번호" name="password" type="password" autoComplete="current-password" />
            </div>
            <FormError message={loginState.error} />
            <SubmitButton>로그인</SubmitButton>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {isSignup ? "이미 계정이 있나요? " : "처음 오셨나요? "}
          <button
            type="button"
            onClick={() => setMode(isSignup ? "login" : "signup")}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {isSignup ? "로그인" : "회원가입"}
          </button>
        </p>

        {!isSignup && (
          <>
            <Divider label="관리자" />
            <GoogleButton next={`/b/${boardId}`} />
          </>
        )}
      </div>
    </div>
  );
}
