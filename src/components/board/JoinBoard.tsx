"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  subtitle: string;
  onJoin: (name: string, email: string) => void;
};

// 교육생이 보드 URL로 처음 들어왔을 때의 회원가입 화면.
// 가입한 계정은 이 보드(URL)에만 접근할 수 있다.
export default function JoinBoard({ title, subtitle, onJoin }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const valid = name.trim() && /^\S+@\S+\.\S+$/.test(email.trim());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onJoin(name.trim(), email.trim());
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl border border-border p-7 shadow-sm"
      >
        <div className="text-xs font-medium text-muted-foreground">{subtitle}</div>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          회원가입하면 이 보드에 실습 결과물을 올릴 수 있어요.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">이름</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className="mt-1.5" autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium">이메일</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="mt-1.5"
            />
          </div>
        </div>

        <Button type="submit" disabled={!valid} className="mt-6 w-full">
          참여하기
        </Button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          이미 계정이 있나요?{" "}
          <Link href="/" className="underline underline-offset-4 hover:text-foreground">
            데모 계정 선택
          </Link>
        </p>
      </form>
    </div>
  );
}
