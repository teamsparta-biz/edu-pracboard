"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { makeZip } from "client-zip";
import { getExportManifest } from "@/app/actions/export";
import { buildHtml, buildXlsx, planExport, type ExportManifest, type ExportScope } from "@/lib/board-export";
import { formatBytes } from "@/lib/storage";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// 게시물 zip 내려받기 (관리자·교육 담당자). 목록을 먼저 받아 크기를 보여주고, 저장을 누르면 브라우저가
// 첨부 파일을 하나씩 받아 zip으로 묶는다. Chrome·Edge는 저장 위치에 바로 써서 크기에 제한이 없고,
// 그 밖의 브라우저는 메모리에 모았다가 저장한다.

type Plan = ReturnType<typeof planExport> & { manifest: ExportManifest; bytes: number };
type State =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "ready"; plan: Plan }
  | { step: "saving"; plan: Plan; done: number; bytes: number }
  | { step: "done"; plan: Plan; failed: string[] }
  | { step: "error"; message: string };

// 메모리에 모으는 방식에서 안내를 띄우는 크기
const MEMORY_WARN_BYTES = 1024 * 1024 * 1024;

type SavePicker = (opts: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<WritableStream<Uint8Array>> }>;

export default function ExportButton({ scope, label = "게시물 내려받기", className }: { scope: ExportScope; label?: string; className?: string }) {
  const [state, setState] = useState<State>({ step: "idle" });
  const abort = useRef<AbortController | null>(null);

  async function open() {
    setState({ step: "loading" });
    try {
      const manifest = await getExportManifest(scope);
      if ("error" in manifest) return setState({ step: "error", message: manifest.error });
      const plan = planExport(manifest);
      setState({ step: "ready", plan: { ...plan, manifest, bytes: plan.files.reduce((s, f) => s + f.size, 0) } });
    } catch {
      setState({ step: "error", message: "목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." });
    }
  }

  async function save(plan: Plan) {
    const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
    let target: WritableStream<Uint8Array> | null = null;
    if (picker) {
      try {
        const handle = await picker({
          suggestedName: `${plan.root}.zip`,
          types: [{ description: "ZIP 파일", accept: { "application/zip": [".zip"] } }],
        });
        target = await handle.createWritable();
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // 저장 창에서 취소
        target = null;
      }
    }

    const controller = new AbortController();
    abort.current = controller;
    const failed: string[] = [];
    let done = 0;
    let bytes = 0;
    setState({ step: "saving", plan, done, bytes });
    const tick = () => setState({ step: "saving", plan, done, bytes });

    async function* entries() {
      yield { name: `${plan.root}/게시물 목록.xlsx`, input: buildXlsx(plan) };
      yield { name: `${plan.root}/게시물 보기.html`, input: buildHtml(plan, plan.manifest) };
      for (const f of plan.files) {
        let res: Response | null = null;
        try {
          res = await fetch(f.url, { signal: controller.signal });
        } catch (e) {
          if (controller.signal.aborted) throw e;
        }
        if (!res?.ok || !res.body) {
          failed.push(f.path.slice(plan.root.length + 1));
          continue;
        }
        // 받은 만큼 진행률에 더한다
        const counted = res.body.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, c) {
              bytes += chunk.byteLength;
              c.enqueue(chunk);
            },
          }),
        );
        yield { name: f.path, input: counted, size: f.size };
        done++;
        tick();
      }
      if (failed.length)
        yield { name: `${plan.root}/받지 못한 파일.txt`, input: `아래 파일은 내려받지 못했어요. 다시 시도해 주세요.\r\n\r\n${failed.join("\r\n")}\r\n` };
    }

    const timer = setInterval(tick, 300);
    try {
      const zip = makeZip(entries());
      if (target) {
        await zip.pipeTo(target, { signal: controller.signal });
      } else {
        const blob = await new Response(zip).blob();
        if (controller.signal.aborted) throw new DOMException("aborted", "AbortError");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${plan.root}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setState({ step: "done", plan, failed });
    } catch {
      setState(
        controller.signal.aborted
          ? { step: "idle" }
          : { step: "error", message: "내려받는 중에 연결이 끊겼어요. 다시 시도해 주세요." },
      );
    } finally {
      clearInterval(timer);
      abort.current = null;
    }
  }

  function close() {
    abort.current?.abort();
    setState({ step: "idle" });
  }

  const hasPicker = typeof window !== "undefined" && "showSaveFilePicker" in window;

  return (
    <>
      <button
        onClick={open}
        disabled={state.step === "loading"}
        className={
          className ??
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
        }
      >
        <Download className="w-4 h-4" /> {state.step === "loading" ? "불러오는 중…" : label}
      </button>

      <Dialog open={state.step !== "idle" && state.step !== "loading"} onOpenChange={(o) => !o && state.step !== "saving" && close()}>
        <DialogContent className="max-w-md sm:max-w-md">
          {state.step === "error" && (
            <>
              <DialogHeader>
                <DialogTitle>내려받지 못했어요</DialogTitle>
                <DialogDescription>{state.message}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-end">
                <Button onClick={close}>닫기</Button>
              </DialogFooter>
            </>
          )}

          {state.step === "ready" && (
            <>
              <DialogHeader>
                <DialogTitle>게시물 내려받기</DialogTitle>
                <DialogDescription className="break-all">{state.plan.root}.zip</DialogDescription>
              </DialogHeader>
              <ul className="space-y-1 text-sm">
                {state.plan.multi && <li>보드 {state.plan.manifest.boards.length}개</li>}
                <li>
                  게시물 {state.plan.rows.length}개 · 첨부 파일 {state.plan.files.length}개 ({formatBytes(state.plan.bytes)})
                </li>
                <li className="text-muted-foreground">게시물 목록(엑셀)과 보기용 화면(HTML)이 함께 들어 있어요. 압축을 푼 뒤 열면 첨부 파일로 바로 이동해요.</li>
                {!hasPicker && state.plan.bytes > MEMORY_WARN_BYTES && (
                  <li className="text-destructive">용량이 커서 이 브라우저에서는 실패할 수 있어요. Chrome이나 Edge를 권장해요.</li>
                )}
              </ul>
              <DialogFooter className="sm:justify-end">
                <Button variant="ghost" onClick={close}>
                  취소
                </Button>
                <Button onClick={() => save(state.plan)}>
                  <Download /> 내려받기
                </Button>
              </DialogFooter>
            </>
          )}

          {state.step === "saving" && (
            <>
              <DialogHeader>
                <DialogTitle>내려받는 중…</DialogTitle>
                <DialogDescription>
                  첨부 파일 {state.done} / {state.plan.files.length} · {formatBytes(state.bytes)} / {formatBytes(state.plan.bytes)}
                </DialogDescription>
              </DialogHeader>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${state.plan.bytes ? Math.min(100, (state.bytes / state.plan.bytes) * 100) : 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">끝날 때까지 이 창을 닫거나 페이지를 떠나지 마세요.</p>
              <DialogFooter className="sm:justify-end">
                <Button variant="ghost" onClick={close}>
                  중단
                </Button>
              </DialogFooter>
            </>
          )}

          {state.step === "done" && (
            <>
              <DialogHeader>
                <DialogTitle>내려받기 완료</DialogTitle>
                <DialogDescription>
                  {state.failed.length
                    ? `파일 ${state.failed.length}개는 받지 못했어요. zip 안의 "받지 못한 파일.txt"를 확인해 주세요.`
                    : "압축을 풀고 '게시물 보기.html' 또는 '게시물 목록.xlsx'를 열어 보세요."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-end">
                <Button onClick={close}>닫기</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
