"use client";

import { useState } from "react";
import { Code2, FileText, GripVertical, Heart, Link as LinkIcon, MessageCircle, Music, Pin, Play } from "lucide-react";
import type { Card } from "@/lib/types";
import { attachmentKind } from "@/lib/storage";
import ItemMenu from "@/components/app/ItemMenu";
import HtmlPreview from "@/components/board/HtmlPreview";

type Props = {
  card: Card;
  // 권한이 없으면 넘기지 않는다
  onEdit?: (card: Card) => void;
  onDelete?: (card: Card) => void;
  onOpen: (card: Card) => void;
  liked: boolean;
  // 하트를 누를 수 없으면(교육 담당자) 넘기지 않는다. 그때는 수만 보여준다.
  onLike?: (card: Card) => void;
  // 고정 카드 순서를 바꿀 수 있으면(관리자·강사) 끌기 이벤트를 넘긴다
  drag?: React.HTMLAttributes<HTMLDivElement> & { dragging: boolean };
};

export default function BoardCard({ card, onEdit, onDelete, onOpen, liked, onLike, drag }: Props) {
  const { dragging, ...dragHandlers } = drag ?? { dragging: false };
  return (
    <div
      onClick={() => onOpen(card)}
      draggable={!!drag}
      {...dragHandlers}
      className={
        "group relative bg-white rounded-2xl border border-border overflow-hidden hover:shadow-md transition-[box-shadow,opacity] cursor-pointer flex flex-col" +
        (drag ? " active:cursor-grabbing" : "") +
        (dragging ? " opacity-40 ring-2 ring-board" : "")
      }
    >
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100 transition-opacity">
        <ItemMenu
          label="카드 메뉴"
          className="bg-white/90 text-muted-foreground hover:text-foreground"
          onEdit={onEdit && (() => onEdit(card))}
          onDelete={onDelete && (() => onDelete(card))}
        />
      </div>

      {card.pinned && (
        <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-board shadow-sm">
          {drag ? <GripVertical className="w-3 h-3 -ml-0.5" /> : <Pin className="w-3 h-3" />} 고정
        </span>
      )}

      <CardThumbnail card={card} />

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-sm line-clamp-1">{card.title}</h3>
        {/* 문단 자체가 늘어나면 두 줄 제한 아래로 다음 줄이 보이므로, 남는 높이는 감싼 div가 받는다 */}
        <div className="flex-1">
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{card.content}</p>
        </div>
        {card.link && (
          <a
            href={card.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-2 flex items-center gap-1 text-xs text-blue-600 truncate hover:underline"
          >
            <LinkIcon className="w-3 h-3 shrink-0" />
            <span className="truncate">{card.link}</span>
          </a>
        )}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="w-5 h-5 shrink-0 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-foreground">
              {card.author.charAt(0)}
            </span>
            {/* 하트·댓글 수가 들어가 날짜는 카드 상세에서만 보여준다. 좁은 카드에서 이름이 잘리지 않게 하기 위함 */}
            <span className="truncate" title={`${card.author} · ${card.createdAt}`}>
              {card.author}
            </span>
          </span>
          <span className="flex items-center gap-2.5 shrink-0 tabular-nums">
            <LikeButton count={card.likedBy.length} liked={liked} onClick={onLike && (() => onLike(card))} />
            <span className="flex items-center gap-1" aria-label={`댓글 ${card.comments.length}개`}>
              <MessageCircle className="w-3.5 h-3.5" />
              {card.comments.length}
            </span>
          </span>
        </div>
        <CommentPreview card={card} />
      </div>
    </div>
  );
}

// 카드를 열지 않아도 최근 댓글이 보이게 한다. 나머지는 카드 상세에서.
const PREVIEW_COMMENTS = 2;

function CommentPreview({ card }: { card: Card }) {
  const { comments } = card;
  if (!comments.length) return null;
  const recent = comments.slice(-PREVIEW_COMMENTS);
  return (
    <div className="mt-3 -mx-4 -mb-4 px-4 py-3 bg-muted/50 border-t border-border space-y-1.5" aria-label="최근 댓글">
      {comments.length > PREVIEW_COMMENTS && (
        <p className="text-xs text-muted-foreground">댓글 {comments.length}개 모두 보기</p>
      )}
      {recent.map((c) => (
        <p key={c.id} className="text-xs leading-relaxed line-clamp-2 break-all">
          <span className="font-semibold mr-1.5">{c.author}</span>
          <span className="text-foreground/80">{c.content}</span>
        </p>
      ))}
    </div>
  );
}

// 누를 수 없으면 수만 보여준다
export function LikeButton({ count, liked, onClick, className = "" }: { count: number; liked: boolean; onClick?: () => void; className?: string }) {
  const icon = <Heart className={"w-3.5 h-3.5 " + (liked ? "fill-rose-500 text-rose-500" : "")} />;
  if (!onClick) {
    return (
      <span className={"flex items-center gap-1 " + className} aria-label={`하트 ${count}개`}>
        {icon}
        {count}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-pressed={liked}
      aria-label={liked ? `하트 취소 (${count}개)` : `하트 누르기 (${count}개)`}
      className={"flex items-center gap-1 rounded-full -mx-1 px-1 py-0.5 hover:text-rose-500 hover:bg-rose-50 transition-colors " + (liked ? "text-rose-500 " : "") + className}
    >
      {icon}
      {count}
    </button>
  );
}

const box = "relative h-44 bg-muted flex items-center justify-center overflow-hidden";

function CardThumbnail({ card }: { card: Card }) {
  const a = card.attachment;
  if (!a) return <LinkThumbnail card={card} />;

  const kind = attachmentKind(a.type);
  if (kind === "image") {
    return (
      <div className={box}>
        {/* 비공개 파일의 서명 URL이라 이미지 최적화(공용 캐시)를 거치지 않는다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.url} alt={card.title} draggable={false} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <div className={box + " bg-black"}>
        <video src={`${a.url}#t=0.1`} className="absolute inset-0 w-full h-full object-cover opacity-80" muted preload="metadata" />
        <span className="relative w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
          <Play className="w-4 h-4 text-foreground translate-x-px" />
        </span>
      </div>
    );
  }
  const Icon = kind === "audio" ? Music : kind === "html" ? Code2 : FileText;
  const fileBox = (
    <div className={box + " flex-col gap-2 px-4"}>
      <Icon className="w-8 h-8 text-muted-foreground/60" />
      <span className="text-xs text-muted-foreground truncate max-w-full">{a.name}</span>
    </div>
  );
  if (kind === "html") {
    return (
      <div className={box + " bg-white border-b border-border"}>
        <HtmlPreview url={a.url} size={a.size} title={card.title} variant="thumbnail" fallback={fileBox} />
      </div>
    );
  }
  return fileBox;
}

// 첨부 없이 링크만 있는 카드: 링크 페이지의 대표 이미지, 없으면 사이트 주소를 보여준다
function LinkThumbnail({ card }: { card: Card }) {
  const [broken, setBroken] = useState<string>();
  const host = card.link ? hostOf(card.link) : undefined;
  if (card.linkImage && broken !== card.linkImage) {
    return (
      <div className={box}>
        {/* 다른 사이트의 이미지라 이미지 최적화(허용 도메인 목록)를 거치지 않는다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.linkImage}
          alt={card.title}
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setBroken(card.linkImage)}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div className={box + " flex-col gap-2 px-4"}>
      <LinkIcon className="w-8 h-8 text-muted-foreground/40" />
      {host && <span className="text-xs text-muted-foreground truncate max-w-full">{host}</span>}
    </div>
  );
}

function hostOf(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
