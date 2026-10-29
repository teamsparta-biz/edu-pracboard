"use client";

import { FileText, Heart, Link as LinkIcon, MessageCircle, Music, Play } from "lucide-react";
import type { Card } from "@/lib/types";
import { attachmentKind } from "@/lib/storage";
import ItemMenu from "@/components/app/ItemMenu";

type Props = {
  card: Card;
  // 권한이 없으면 넘기지 않는다
  onEdit?: (card: Card) => void;
  onDelete?: (card: Card) => void;
  onOpen: (card: Card) => void;
  liked: boolean;
  // 하트를 누를 수 없으면(교육 담당자) 넘기지 않는다. 그때는 수만 보여준다.
  onLike?: (card: Card) => void;
};

export default function BoardCard({ card, onEdit, onDelete, onOpen, liked, onLike }: Props) {
  return (
    <div
      onClick={() => onOpen(card)}
      className="group relative bg-white rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col"
    >
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100 transition-opacity">
        <ItemMenu
          label="카드 메뉴"
          className="bg-white/90 text-muted-foreground hover:text-foreground"
          onEdit={onEdit && (() => onEdit(card))}
          onDelete={onDelete && (() => onDelete(card))}
        />
      </div>

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
      </div>
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

function CardThumbnail({ card }: { card: Card }) {
  const a = card.attachment;
  const box = "relative h-44 bg-muted flex items-center justify-center overflow-hidden";
  if (!a) {
    return (
      <div className={box}>
        <LinkIcon className="w-8 h-8 text-muted-foreground/40" />
      </div>
    );
  }

  const kind = attachmentKind(a.type);
  if (kind === "image") {
    return (
      <div className={box}>
        {/* 비공개 파일의 서명 URL이라 이미지 최적화(공용 캐시)를 거치지 않는다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.url} alt={card.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
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
  const Icon = kind === "audio" ? Music : FileText;
  return (
    <div className={box + " flex-col gap-2 px-4"}>
      <Icon className="w-8 h-8 text-muted-foreground/60" />
      <span className="text-xs text-muted-foreground truncate max-w-full">{a.name}</span>
    </div>
  );
}
