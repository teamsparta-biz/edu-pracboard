"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type CardFormData = {
  title: string;
  content?: string;
  image?: string;
  link?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CardFormData) => void;
};

export default function CardForm({ open, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTitle("");
    setContent("");
    setLink("");
    setImage(undefined);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      content: content.trim() || undefined,
      image,
      link: link.trim() || undefined,
    });
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>자료 올리기</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">제목 *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="자료의 제목을 입력하세요"
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-medium">내용</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="자료에 대한 설명을 입력하세요"
              className="mt-1.5 min-h-24"
            />
          </div>

          <div>
            <label className="text-sm font-medium">이미지</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {image ? (
              <div className="mt-1.5 relative rounded-lg border border-border overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="미리보기" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={() => setImage(undefined)}
                  className="absolute top-2 right-2 p-1 rounded-full bg-white/90 text-muted-foreground hover:text-destructive"
                  aria-label="이미지 제거"
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
                <ImagePlus className="w-5 h-5" />
                <span className="text-sm">이미지 업로드</span>
              </button>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">링크</label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://"
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-end">
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            등록하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
