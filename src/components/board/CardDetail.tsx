"use client";

import Image from "next/image";
import { Link as LinkIcon, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Card } from "@/store/AppStore";

type Props = {
  card: Card | null;
  onClose: () => void;
  onDelete: (cardId: string) => void;
};

export default function CardDetail({ card, onClose, onDelete }: Props) {
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
                  <div className="text-sm font-medium leading-none">
                    {card.author}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {card.createdAt}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  onDelete(card.id);
                  onClose();
                }}
                className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                aria-label="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {card.image && (
              <div className="relative h-72 bg-muted">
                <Image
                  src={card.image}
                  alt={card.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            <div className="px-5 py-5">
              <DialogTitle className="text-lg font-semibold">
                {card.title}
              </DialogTitle>
              {card.content && (
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {card.content}
                </p>
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
