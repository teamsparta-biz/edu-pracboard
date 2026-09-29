"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type LessonFormData = {
  title?: string;
  description?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: LessonFormData) => void;
  nextOrder: number;
  unitLabel?: string;
  withTitle?: boolean;
  // 있으면 수정
  initial?: LessonFormData;
};

// 회차·차시 만들기와 수정에 함께 쓴다.
export default function LessonForm({ open, ...props }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-md sm:max-w-md">{open && <LessonFormBody {...props} />}</DialogContent>
    </Dialog>
  );
}

function LessonFormBody({ onClose, onSubmit, nextOrder, unitLabel = "차시", withTitle = true, initial }: Omit<Props, "open">) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  function handleSubmit() {
    if (withTitle && !title.trim()) return;
    onSubmit({
      title: withTitle ? title.trim() : undefined,
      description: description.trim() || undefined,
    });
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {nextOrder}
          {unitLabel} {initial ? "수정" : "만들기"}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {withTitle && (
          <div>
            <label className="text-sm font-medium">제목 *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${unitLabel} 제목을 입력하세요`}
              className="mt-1.5"
              autoFocus
            />
          </div>
        )}

        <div>
          <label className="text-sm font-medium">설명</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`${unitLabel}에 대한 설명을 입력하세요`}
            className="mt-1.5 min-h-20"
            autoFocus={!withTitle}
          />
        </div>
      </div>

      <DialogFooter className="sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={withTitle && !title.trim()}>
          {initial ? "저장" : "만들기"}
        </Button>
      </DialogFooter>
    </>
  );
}
