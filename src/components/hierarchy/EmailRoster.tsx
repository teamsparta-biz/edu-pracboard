"use client";

import { useState, useTransition } from "react";
import { Trash2, UserPlus, Users } from "lucide-react";
import type { ActionResult } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Member = { email: string; source?: "axhub" | "manual" };

type Props = {
  title: string;
  description: string;
  placeholder: string;
  members: Member[];
  onAdd: (email: string) => Promise<ActionResult>;
  onRemove: (email: string) => Promise<ActionResult>;
  // 버튼 모양: 보드(어두운 배경) 또는 목록 화면(밝은 배경)
  variant?: "board" | "page";
};

// 이메일로 권한을 주는 목록 (고객사 담당자, 강사). 버튼을 누르면 창으로 열린다.
// 등록된 이메일은 그 이메일만 입력하면 로그인된다.
export default function EmailRoster({ title, description, placeholder, members, onAdd, onRemove, variant = "page" }: Props) {
  const [open, setOpen] = useState(false);
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

  const trigger =
    variant === "board"
      ? "border-white/20 text-white/80 hover:text-white hover:bg-white/10"
      : "border-border bg-white text-foreground hover:bg-muted";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={"inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors " + trigger}
      >
        <Users className="w-4 h-4" />
        {title} {members.length}명
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {members.length > 0 ? (
            <ul className="divide-y divide-border border-y border-border">
              {members.map((m) => (
                <li key={m.email} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1 min-w-0 truncate">{m.email}</span>
                  {m.source && <Badge variant="outline">{m.source === "axhub" ? "axhub" : "직접 등록"}</Badge>}
                  <button
                    type="button"
                    onClick={() => remove(m.email)}
                    disabled={pending}
                    aria-label={`${m.email} 권한 해제`}
                    className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-muted"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg bg-muted/60 px-3 py-4 text-center text-sm text-muted-foreground">아직 등록된 사람이 없어요.</p>
          )}

          <form onSubmit={submit} className="flex gap-2">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={placeholder} required />
            <Button type="submit" disabled={pending} className="gap-1.5 shrink-0">
              <UserPlus className="w-4 h-4" /> 등록
            </Button>
          </form>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
