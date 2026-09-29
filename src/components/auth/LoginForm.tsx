"use client";

import { useActionState } from "react";
import { signInWithEmail } from "@/app/actions/auth";
import { Divider, Field, FormError, GoogleButton, SubmitButton } from "./AuthFields";

const linkErrors: Record<string, string> = {
  google: "Google 로그인에 실패했어요. 팀스파르타 계정인지 확인해 주세요.",
};

// 관리자는 Google, 강사·고객사 담당자·교육생은 이메일만으로 로그인한다.
export default function LoginForm({ next = "/", linkError }: { next?: string; linkError?: string }) {
  const [state, action] = useActionState(signInWithEmail, {});

  return (
    <div className="w-full max-w-sm bg-white rounded-2xl border border-border p-7 shadow-sm">
      <div className="text-xs font-medium text-muted-foreground">PracBoard · 교육 실습 결과물 보드</div>
      <h1 className="mt-1 text-xl font-bold tracking-tight">로그인</h1>

      <div className="mt-6">
        <GoogleButton next={next} />
        <p className="mt-2 text-center text-xs text-muted-foreground">관리자(@teamsparta.co) 전용</p>
      </div>

      <Divider label="강사 · 고객사 담당자 · 교육생" />

      <form action={action}>
        <input type="hidden" name="next" value={next} />
        <Field
          label="이메일"
          name="email"
          type="email"
          placeholder="name@company.com"
          autoComplete="email"
          defaultValue={state.values?.email}
        />
        <FormError message={state.error ?? (linkError ? linkErrors[linkError] : undefined)} />
        <SubmitButton>로그인</SubmitButton>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        교육생은 강사에게 받은 보드 URL로 들어와 참여해 주세요.
      </p>
    </div>
  );
}
