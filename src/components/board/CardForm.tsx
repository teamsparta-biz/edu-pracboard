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
};

// 첨부 미리보기: 새로 고른 파일(로컬 URL) 또는 기존 첨부(서명 URL)
type Preview = { url: string; name: string; type: string; size?: number };

export default function CardForm({ open, onClose, onSubmit, card }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md sm:max-w-md">
        {/* 열 때마다 입력값을 새로 채우기 위해 key로 다시 만든다 */}
        {open && <CardFormBody key={card?.id ?? "new"} card={card} onClose={onClose} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  );
}

function CardFormBody({ card, onClose, onSubmit }: Omit<Props, "open">) {
  const [title, setTitle] = useState(card?.title ?? "");
  const [content, setContent] = useState(card?.content ?? "");
  const [link, setLink] = useState(card?.link ?? "");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<Preview | undefined>(card?.attachment);
  const [removed, setRemoved] = useState(false);
  const [fileError, setFileError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function clearAttachment() {
    if (file && preview) URL.revokeObjectURL(preview.url);
    setFile(undefined);
    setPreview(undefined);
    setFileError(undefined);
    if (card?.attachment) setRemoved(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (picked.size > MAX_ATTACHMENT_BYTES) {
      setFileError(`파일은 ${formatBytes(MAX_ATTACHMENT_BYTES)} 이하만 올릴 수 있어요.`);
      return;
    }
    clearAttachment();
    setFile(picked);
    setPreview({ url: URL.createObjectURL(picked), name: picked.name, type: picked.type, size: picked.size });
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
              className="mt-1.5 w-full h-28 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-foreground/30 transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="text-sm">업로드</span>
            </button>
          )}
          <p className={"mt-1.5 text-xs " + (fileError ? "text-destructive" : "text-muted-foreground")}>
            {fileError ?? `이미지, 동영상, 문서 등 파일 1개를 올릴 수 있어요. (${formatBytes(MAX_ATTACHMENT_BYTES)} 이하)`}
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">내용</label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="아름다운 내용을 적어보세요..." className="mt-1.5 min-h-24" />
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
