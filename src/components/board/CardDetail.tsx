"use client";

import { useState, useTransition } from "react";
import { Download, FileText, Link as LinkIcon, MessageCircle, X } from "lucide-react";
import { getAttachmentDownloadUrl } from "@/app/actions/board";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ItemMenu from "@/components/app/ItemMenu";
import { LikeButton } from "@/components/board/BoardCard";
import type { Card, Comment } from "@/lib/types";
import { attachmentKind, formatBytes } from "@/lib/storage";
import { COMMENT_MAX_LENGTH } from "@/lib/permissions";

type Props = {
  card: Card | null;
  onClose: () => void;
  onEdit?: (card: Card) => void;
  onDelete?: (card: Card) => void;
  liked: boolean;
  // 하트·댓글을 남길 수 없으면(교육 담당자) 넘기지 않는다
  onLike?: (card: Card) => void;
  // 성공하면 true. 입력칸을 비울지 정한다.
  onAddComment?: (card: Card, content: string) => Promise<boolean>;
  // 지울 수 있는 댓글이면 지우는 함수를 돌려준다
  deleteCommentHandler: (comment: Comment) => (() => void) | undefined;
};

export default function CardDetail({ card, onClose, onEdit, onDelete, liked, onLike, onAddComment, deleteCommentHandler }: Props) {
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
              <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground tabular-nums">
                <LikeButton count={card.likedBy.length} liked={liked} onClick={onLike && (() => onLike(card))} />
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" /> {card.comments.length}
                </span>
              </div>
            </div>

            <Comments
              // 카드가 바뀌면 입력 중이던 댓글을 비운다
              key={card.id}
              comments={card.comments}
              onAdd={onAddComment && ((content) => onAddComment(card, content))}
              deleteHandler={deleteCommentHandler}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Comments({
  comments,
  onAdd,
  deleteHandler,
}: {
  comments: Comment[];
  onAdd?: (content: string) => Promise<boolean>;
  deleteHandler: (comment: Comment) => (() => void) | undefined;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  if (!comments.length && !onAdd) return null;

  function submit() {
    const content = text.trim();
    if (!content || !onAdd) return;
    startTransition(async () => {
      if (await onAdd(content)) setText("");
    });
  }

  return (
    <div className="border-t border-border bg-muted/40 px-5 py-4 space-y-3 max-h-[40vh] overflow-y-auto">
      {comments.map((c) => {
        const remove = deleteHandler(c);
        return (
          <div key={c.id} className="group flex gap-2.5">
            <span className="w-6 h-6 shrink-0 rounded-full bg-white border border-border flex items-center justify-center text-[10px] font-medium">
              {c.author.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-medium">{c.author}</span>
                <span className="text-muted-foreground tabular-nums">{c.createdAt}</span>
                {remove && (
                  <button
                    type="button"
                    onClick={remove}
                    aria-label="댓글 삭제"
                    className="ml-auto p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">{c.content}</p>
            </div>
          </div>
        );
      })}
      {onAdd && (
        <div className="flex items-end gap-2 pt-1">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // 한글 조합 중 Enter는 글자 확정이라 보내지 않는다
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="댓글을 남겨 주세요. (Shift+Enter 줄바꿈)"
            aria-label="댓글"
            className="min-h-10 bg-white text-sm"
          />
          <Button size="sm" onClick={submit} disabled={pending || !text.trim()} className="shrink-0">
            {pending ? "등록 중" : "등록"}
          </Button>
        </div>
      )}
    </div>
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
