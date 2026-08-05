"use client";

import Image from "next/image";
import { Link as LinkIcon, Trash2 } from "lucide-react";
import type { Card } from "@/store/AppStore";

type Props = {
  card: Card;
  onDelete: (cardId: string) => void;
  onOpen: (card: Card) => void;
};

export default function BoardCard({ card, onDelete, onOpen }: Props) {
  return (
    <div
      onClick={() => onOpen(card)}
      className="group relative bg-white rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(card.id);
        }}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
        aria-label="삭제"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="relative h-44 bg-muted flex items-center justify-center overflow-hidden">
        {card.image ? (
          <Image
            src={card.image}
            alt={card.title}
            fill
            className="object-cover"
          />
        ) : (
          <LinkIcon className="w-8 h-8 text-muted-foreground/40" />
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-sm line-clamp-1">{card.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2 flex-1">
          {card.content}
        </p>
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
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-foreground">
              {card.author.charAt(0)}
            </span>
            {card.author}
          </span>
          <span>{card.createdAt}</span>
        </div>
      </div>
    </div>
  );
}
