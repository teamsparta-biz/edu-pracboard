"use client";

import { useActionState } from "react";
import { enterBoard } from "@/app/actions/auth";
import { Divider, Field, FormError, GoogleButton, SubmitButton } from "@/components/auth/AuthFields";

type Props = {
  boardId: string;
  title: string;
  subtitle: string;
};

// 로그인하지 않은 사용자가 보드 URL로 들어왔을 때의 입장 화면.
// 이메일을 먼저 받고, 처음 보는 이메일이면 이름을 더 받아 이 보드의 교육생으로 참여시킨다.
export default function JoinBoard({ boardId, title, subtitle }: Props) {
  const [state, action] = useActionState(enterBoard, {});
  const needName = !!state.needName;

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-border p-7 shadow-sm">
        <div className="text-xs font-medium text-muted-foreground">{subtitle}</div>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {needName
            ? "처음 참여하시네요. 보드에 표시될 이름을 입력해 주세요."
            : "이메일을 입력하면 이 보드에 실습 결과물을 올릴 수 있어요."}
        </p>

        {/* 단계가 바뀌면 입력칸을 새로 만들어 기본값이 다시 채워지게 한다 */}
        <form action={action} key={needName ? "name" : "email"}>
          <input type="hidden" name="boardId" value={boardId} />
          <div className="mt-6 space-y-4">
            <div>
              <Field
                label="이메일"
                name="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="email"
                autoFocus={!needName}
                defaultValue={state.values?.email}
              />
              {!needName && <p className="mt-1.5 text-xs text-muted-foreground">회사 이메일을 입력해 주세요.</p>}
            </div>
            {needName && (
              <Field label="이름" name="name" placeholder="홍길동" autoComplete="name" autoFocus defaultValue={state.values?.name} />
            )}
          </div>
          <FormError message={state.error} />
          <SubmitButton>{needName ? "참여하기" : "들어가기"}</SubmitButton>
        </form>

        <Divider label="관리자" />
        <GoogleButton next={`/b/${boardId}`} />
      </div>
    </div>
  );
}
