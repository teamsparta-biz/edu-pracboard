"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Card } from "@/lib/types";
import { MAX_ATTACHMENT_BYTES, attachmentKind, formatBytes } from "@/lib/storage";

export type CardFormData = {
  title: string;
  content?: string;
  link?: string;
  // 새로 고른 파일. 수정할 때 removeAttachment가 true면 기존 첨부를 지운다.
  file?: File;
  removeAttachment?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CardFormData) => void;
  // 있으면 수정, 없으면 새 카드
  card?: Card | null;
  // 보드에 끌어다 놓은 파일. 새 카드 창을 이 파일이 붙은 채로 연다.
  initialFile?: File;
};

// 첨부 미리보기: 새로 고른 파일(로컬 URL) 또는 기존 첨부(서명 URL)
type Preview = { url: string; name: string; type: string; size?: number };

export default function CardForm({ open, onClose, onSubmit, card, initialFile }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md sm:max-w-md">
        {/* 열 때마다 입력값을 새로 채우기 위해 key로 다시 만든다 */}
        {open && <CardFormBody key={card?.id ?? "new"} card={card} initialFile={initialFile} onClose={onClose} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  );
}

const TOO_LARGE = `파일은 ${formatBytes(MAX_ATTACHMENT_BYTES)} 이하만 올릴 수 있어요.`;
const localPreview = (f: File): Preview => ({ url: URL.createObjectURL(f), name: f.name, type: f.type, size: f.size });
// 끌어다 놓은 파일로 새 카드를 만들 때 제목 칸을 파일 이름(확장자 제외)으로 채워 둔다
const titleFromFile = (f: File) => f.name.replace(/.[^.]+$/, "");

function CardFormBody({ card, initialFile, onClose, onSubmit }: Omit<Props, "open">) {
  const dropped = initialFile && initialFile.size <= MAX_ATTACHMENT_BYTES ? initialFile : undefined;
  const [title, setTitle] = useState(card?.title ?? (dropped ? titleFromFile(dropped) : ""));
  const [content, setContent] = useState(card?.content ?? "");
  const [link, setLink] = useState(card?.link ?? "");
  const [file, setFile] = useState<File | undefined>(dropped);
  const [preview, setPreview] = useState<Preview | undefined>(() => (dropped ? localPreview(dropped) : card?.attachment));
  const [removed, setRemoved] = useState(false);
  const [fileError, setFileError] = useState<string | undefined>(initialFile && !dropped ? TOO_LARGE : undefined);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function clearAttachment() {
    if (file && preview) URL.revokeObjectURL(preview.url);
    setFile(undefined);
    setPreview(undefined);
    setFileError(undefined);
    if (card?.attachment) setRemoved(true);
  }

  function pick(picked: File | undefined) {
    if (!picked) return;
    if (picked.size > MAX_ATTACHMENT_BYTES) {
      setFileError(TOO_LARGE);
      return;
    }
    clearAttachment();
    setFile(picked);
    setPreview(localPreview(picked));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    pick(picked);
  }

  function handleSubmit() {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      content: content.trim() || undefined,
      link: link.trim() || undefined,
      file,
      removeAttachment: removed && !file,
    });
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{card ? "자료 수정" : "자료 올리기"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">제목 *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="자료의 제목을 입력하세요" className="mt-1.5" />
        </div>

        <div>
          <label className="text-sm font-medium">첨부</label>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          {preview ? (
            <div className="mt-1.5 relative rounded-lg border border-border overflow-hidden">
              <AttachmentPreview preview={preview} />
              <button
                type="button"
                onClick={clearAttachment}
                className="absolute top-2 right-2 p-1 rounded-full bg-white/90 text-muted-foreground hover:text-destructive"
                aria-label="첨부 제거"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files[0]);
              }}
              className={
                "mt-1.5 w-full h-28 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-foreground/30 transition-colors " +
                (dragging ? "border-foreground/40 bg-muted" : "border-border")
              }
            >
              <Upload className="w-5 h-5" />
              <span className="text-sm">파일을 끌어다 놓거나 눌러서 업로드</span>
            </button>
          )}
          <p className={"mt-1.5 text-xs " + (fileError ? "text-destructive" : "text-muted-foreground")}>
            {fileError ?? `이미지, 동영상, 문서 등 파일 1개를 올릴 수 있어요. (${formatBytes(MAX_ATTACHMENT_BYTES)} 이하)`}
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">내용</label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="원하는 내용을 작성해 주세요." className="mt-1.5 min-h-24" />
        </div>

        <div>
          <label className="text-sm font-medium">링크</label>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className="mt-1.5" />
        </div>
      </div>

      <DialogFooter className="sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={!title.trim()}>
          {card ? "저장하기" : "등록하기"}
        </Button>
      </DialogFooter>
    </>
  );
}

function AttachmentPreview({ preview }: { preview: Preview }) {
  const kind = attachmentKind(preview.type);
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={preview.url} alt="미리보기" className="w-full h-40 object-cover" />;
  }
  if (kind === "video") return <video src={preview.url} className="w-full h-40 bg-black object-contain" muted />;
  return (
    <div className="flex items-center gap-3 p-4 pr-10">
      <FileText className="w-8 h-8 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{preview.name}</div>
        <div className="text-xs text-muted-foreground">{formatBytes(preview.size)}</div>
      </div>
    </div>
  );
}
