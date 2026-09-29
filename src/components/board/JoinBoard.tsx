"use client";

import { useActionState, useState } from "react";
import { joinWithEmail, signInWithEmail } from "@/app/actions/auth";
import { Divider, Field, FormError, GoogleButton, SubmitButton } from "@/components/auth/AuthFields";

type Props = {
  boardId: string;
  title: string;
  subtitle: string;
};

// 보드 URL로 처음 들어온 사용자의 참여 화면. 이름과 이메일만 받는다.
// 참여하면 이 보드의 교육생이 된다.
export default function JoinBoard({ boardId, title, subtitle }: Props) {
  const [mode, setMode] = useState<"join" | "login">("join");
  const [joinState, joinAction] = useActionState(joinWithEmail, {});
  const [loginState, loginAction] = useActionState(signInWithEmail, {});
  const isJoin = mode === "join";

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-border p-7 shadow-sm">
        <div className="text-xs font-medium text-muted-foreground">{subtitle}</div>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isJoin
            ? "이름과 이메일을 입력하면 이 보드에 실습 결과물을 올릴 수 있어요."
            : "참여할 때 입력한 이메일로 다시 들어와요."}
        </p>

        {isJoin ? (
          <form action={joinAction} key="join">
            <input type="hidden" name="boardId" value={boardId} />
            <div className="mt-6 space-y-4">
              <Field label="이름" name="name" placeholder="홍길동" autoComplete="name" autoFocus defaultValue={joinState.values?.name} />
              <div>
                <Field label="이메일" name="email" type="email" placeholder="name@company.com" autoComplete="email" defaultValue={joinState.values?.email} />
                <p className="mt-1.5 text-xs text-muted-foreground">회사 이메일을 입력해 주세요.</p>
              </div>
            </div>
            <FormError message={joinState.error} />
            <SubmitButton>참여하기</SubmitButton>
          </form>
        ) : (
          <form action={loginAction} key="login">
            <input type="hidden" name="next" value={`/b/${boardId}`} />
            <div className="mt-6">
              <Field label="이메일" name="email" type="email" placeholder="name@company.com" autoComplete="email" autoFocus defaultValue={loginState.values?.email} />
            </div>
            <FormError message={loginState.error} />
            <SubmitButton>들어가기</SubmitButton>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {isJoin ? "이미 참여했나요? " : "처음 오셨나요? "}
          <button
            type="button"
            onClick={() => setMode(isJoin ? "login" : "join")}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {isJoin ? "이메일로 들어가기" : "참여하기"}
          </button>
        </p>

        {!isJoin && (
          <>
            <Divider label="관리자" />
            <GoogleButton next={`/b/${boardId}`} />
          </>
        )}
      </div>
    </div>
  );
}
