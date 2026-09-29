"use client";

import { useState, useTransition } from "react";
import { Download, FileText, Link as LinkIcon } from "lucide-react";
import { getAttachmentDownloadUrl } from "@/app/actions/board";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ItemMenu from "@/components/app/ItemMenu";
import type { Card } from "@/lib/types";
import { attachmentKind, formatBytes } from "@/lib/storage";

type Props = {
  card: Card | null;
  onClose: () => void;
  onEdit?: (card: Card) => void;
  onDelete?: (card: Card) => void;
};

export default function CardDetail({ card, onClose, onEdit, onDelete }: Props) {
  return (
    <Dialog open={!!card} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden sm:max-w-lg">
        {card && (
          <>
            <div className="flex items-center justify-between pl-5 pr-12 py-4">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {card.author.charAt(0)}
                </span>
                <div>
                  <div className="text-sm font-medium leading-none">{card.author}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{card.createdAt}</div>
                </div>
              </div>
              <ItemMenu
                label="카드 메뉴"
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                onEdit={onEdit && (() => onEdit(card))}
                onDelete={onDelete && (() => onDelete(card))}
              />
            </div>

            <AttachmentView card={card} />

            <div className="px-5 py-5">
              <DialogTitle className="text-lg font-semibold">{card.title}</DialogTitle>
              {card.content && (
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{card.content}</p>
              )}
              {card.link && (
                <a
                  href={card.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:underline break-all"
                >
                  <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                  {card.link}
                </a>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AttachmentView({ card }: { card: Card }) {
  const a = card.attachment;
  if (!a) return null;
  const kind = attachmentKind(a.type);

  return (
    <div className="bg-muted">
      {kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.url} alt={card.title} className="w-full max-h-[60vh] object-contain" />
      )}
      {kind === "video" && <video src={a.url} controls playsInline className="w-full max-h-[60vh] bg-black" />}
      {kind === "audio" && <audio src={a.url} controls className="w-full p-4" />}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-border bg-white">
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="flex-1 min-w-0 text-sm truncate">{a.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{formatBytes(a.size)}</span>
        <DownloadButton cardId={card.id} />
      </div>
    </div>
  );
}

// 원래 파일 이름으로 내려받는 링크는 누를 때 발급한다.
function DownloadButton({ cardId }: { cardId: string }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      className="gap-1.5 shrink-0"
      onClick={() =>
        startTransition(async () => {
          const r = await getAttachmentDownloadUrl(cardId);
          if (r.url) window.location.href = r.url;
          else setFailed(true);
        })
      }
    >
      <Download className="w-3.5 h-3.5" /> {failed ? "다시 시도" : "내려받기"}
    </Button>
  );
}
