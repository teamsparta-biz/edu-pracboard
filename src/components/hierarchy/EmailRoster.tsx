"use client";

import { useState, useTransition } from "react";
import { Trash2, UserPlus } from "lucide-react";
import type { ActionResult } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Member = { email: string; source?: "axhub" | "manual" };

type Props = {
  title: string;
  description: string;
  placeholder: string;
  members: Member[];
  onAdd: (email: string) => Promise<ActionResult>;
  onRemove: (email: string) => Promise<ActionResult>;
  className?: string;
};

// 이메일로 권한을 주는 목록 (고객사 담당자, 강사). 등록된 이메일은 그 이메일만 입력하면 로그인된다.
export default function EmailRoster({ title, description, placeholder, members, onAdd, onRemove, className = "" }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await onAdd(email);
      setError(r.error);
      if (!r.error) setEmail("");
    });
  }

  function remove(target: string) {
    startTransition(async () => setError((await onRemove(target)).error));
  }

  return (
    <section className={"bg-white rounded-2xl border border-border p-5 text-foreground " + className}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary">{members.length}명</Badge>
      </div>

      {members.length > 0 && (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {members.map((m) => (
            <li key={m.email} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="flex-1 truncate">{m.email}</span>
              {m.source && <Badge variant="outline">{m.source === "axhub" ? "axhub" : "직접 등록"}</Badge>}
              <button
                onClick={() => remove(m.email)}
                disabled={pending}
                title="권한 해제"
                className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-muted"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={placeholder} required />
        <Button type="submit" disabled={pending} className="gap-1.5 shrink-0">
          <UserPlus className="w-4 h-4" /> 등록
        </Button>
      </form>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
