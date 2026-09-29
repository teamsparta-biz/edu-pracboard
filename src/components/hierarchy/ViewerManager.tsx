"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Trash2, UserPlus } from "lucide-react";
import { addViewer, createAccessLink, removeViewer, type InviteResult } from "@/app/actions/admin";
import type { Viewer } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 교육별 고객사 담당자(읽기 전용) 관리. axhub 교육 담당자는 자동 등록되고, 여기서 추가로 등록할 수 있다.
// 메일 발송 없이 초대 링크를 만들어 관리자가 직접 전달한다.
export default function ViewerManager({ educationId, viewers }: { educationId: string; viewers: Viewer[] }) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<InviteResult & { email?: string }>({});
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    startTransition(async () => {
      const r = await addViewer(educationId, target);
      setResult({ ...r, email: target });
      if (!r.error) setEmail("");
    });
  }

  function issueLink(target: string) {
    startTransition(async () => setResult({ ...(await createAccessLink(target)), email: target }));
  }

  function remove(target: string) {
    startTransition(async () => {
      const r = await removeViewer(educationId, target);
      setResult(r.error ? { error: r.error } : {});
    });
  }

  return (
    <section className="mb-8 bg-white rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">고객사 담당자</h2>
          <p className="text-xs text-muted-foreground">등록된 이메일로 로그인하면 이 교육을 읽기 전용으로 볼 수 있어요.</p>
        </div>
        <Badge variant="secondary">{viewers.length}명</Badge>
      </div>

      {viewers.length > 0 && (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {viewers.map((v) => (
            <li key={v.email} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="flex-1 truncate">{v.email}</span>
              <Badge variant="outline">{v.source === "axhub" ? "axhub" : "직접 등록"}</Badge>
              <button
                onClick={() => issueLink(v.email)}
                disabled={pending}
                title="초대·비밀번호 재설정 링크 만들기"
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <KeyRound className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => remove(v.email)}
                disabled={pending}
                title="열람 권한 해제"
                className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-muted"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="담당자 이메일 (예: hr@company.com)"
          required
        />
        <Button type="submit" disabled={pending} className="gap-1.5 shrink-0">
          <UserPlus className="w-4 h-4" /> 등록
        </Button>
      </form>

      <InviteNotice result={result} />
    </section>
  );
}

function InviteNotice({ result }: { result: InviteResult & { email?: string } }) {
  const [copied, setCopied] = useState(false);

  if (result.error) return <p className="mt-3 text-sm text-destructive">{result.error}</p>;

  if (result.inviteUrl) {
    const url = result.inviteUrl;
    return (
      <div className="mt-3 rounded-xl bg-muted/60 p-3 text-sm">
        <p>
          <b>{result.email}</b>에게 아래 링크를 전달해 주세요.{" "}
          {result.existing ? "비밀번호를 다시 설정하는 링크예요." : "링크로 들어와 비밀번호를 정하면 가입이 끝나요."}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-white border border-border px-2 py-1.5 text-xs">{url}</code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "복사됨" : "복사"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">링크는 한 번만 쓸 수 있고, 일정 시간이 지나면 만료돼요.</p>
      </div>
    );
  }

  if (result.existing) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        {result.email}은(는) 이미 계정이 있어서 바로 로그인하면 돼요.
        {result.selfSignup && (
          <span className="block mt-1 text-amber-700">
            ⚠️ 초대 없이 직접 가입한 계정이에요. 담당자 본인이 가입한 게 맞는지 확인해 주세요.
          </span>
        )}
      </p>
    );
  }

  return null;
}
