"use client";

import { useActionState } from "react";
import { setPassword } from "@/app/actions/auth";
import { Field, FormError, SubmitButton } from "./AuthFields";

export default function SetPasswordForm({ email }: { email: string }) {
  const [state, action] = useActionState(setPassword, {});

  return (
    <form action={action} className="w-full max-w-sm bg-white rounded-2xl border border-border p-7 shadow-sm">
      <h1 className="text-xl font-bold tracking-tight">비밀번호 설정</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {email} 계정의 비밀번호를 정해 주세요. 다음부터는 이 비밀번호로 로그인해요.
      </p>
      <div className="mt-6 space-y-4">
        <Field label="비밀번호" name="password" type="password" minLength={6} autoComplete="new-password" />
        <Field label="비밀번호 확인" name="confirm" type="password" minLength={6} autoComplete="new-password" />
      </div>
      <FormError message={state.error} />
      <SubmitButton>저장하고 시작하기</SubmitButton>
    </form>
  );
}
