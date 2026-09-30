"use client";

import { FileText, Link as LinkIcon, Music, Play } from "lucide-react";
import type { Card } from "@/lib/types";
import { attachmentKind } from "@/lib/storage";
import ItemMenu from "@/components/app/ItemMenu";

type Props = {
  card: Card;
  // 권한이 없으면 넘기지 않는다
  onEdit?: (card: Card) => void;
  onDelete?: (card: Card) => void;
  onOpen: (card: Card) => void;
};

export default function BoardCard({ card, onEdit, onDelete, onOpen }: Props) {
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
            <span className="truncate">{card.author}</span>
          </span>
          <span className="shrink-0">{card.createdAt.slice(5)}</span>
        </div>
      </div>
    </div>
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
