"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncNow } from "@/app/actions/sync";
import { Button } from "@/components/ui/button";

type LastSync = {
  trigger: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  error: string | null;
} | null;

const time = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

// 관리자 첫 화면의 axhub 동기화 상태와 "지금 동기화" 버튼. 자동 동기화는 1시간마다 돈다.
export default function SyncPanel({ last }: { last: LastSync }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; message?: string }>();

  const status = !last
    ? "아직 동기화한 적이 없어요."
    : !last.finished_at
      ? `${time(last.started_at)}부터 동기화 중이에요.`
      : last.ok
        ? `마지막 동기화 ${time(last.finished_at)} (${last.trigger === "cron" ? "자동" : "수동"})`
        : `${time(last.finished_at)} 동기화 실패: ${last.error ?? "알 수 없는 오류"}`;

  return (
    <section className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-border bg-white px-5 py-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">axhub 동기화</div>
        <p className={"text-xs " + (last?.ok === false ? "text-destructive" : "text-muted-foreground")}>{status}</p>
        {result && (
          <p className={"mt-1 text-xs " + (result.error ? "text-destructive" : "text-foreground")}>{result.error ?? result.message}</p>
        )}
      </div>
      <Button
        variant="outline"
        disabled={pending}
        className="gap-1.5 self-start sm:self-auto"
        onClick={() => startTransition(async () => setResult(await syncNow()))}
      >
        <RefreshCw className={"w-4 h-4 " + (pending ? "animate-spin" : "")} />
        {pending ? "동기화 중..." : "지금 동기화"}
      </Button>
    </section>
  );
}
