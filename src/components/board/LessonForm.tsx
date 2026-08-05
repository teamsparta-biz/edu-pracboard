"use client";

import { useState } from "react";
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

type LessonFormData = {
  title: string;
  description?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: LessonFormData) => void;
  nextOrder: number;
};

export default function LessonForm({ open, onClose, onSubmit, nextOrder }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function reset() {
    setTitle("");
    setDescription("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), description: description.trim() || undefined });
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{nextOrder}차시 만들기</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">제목 *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="차시 제목을 입력하세요"
              className="mt-1.5"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">설명</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="차시에 대한 설명을 입력하세요"
              className="mt-1.5 min-h-20"
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-end">
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            만들기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
