"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  // 있으면 이름 변경, 없으면 새 섹션
  initialName?: string;
};

export default function SectionForm({ open, onClose, onSubmit, initialName }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md sm:max-w-md">
        {open && <SectionFormBody initialName={initialName} onClose={onClose} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  );
}

function SectionFormBody({ initialName, onClose, onSubmit }: Omit<Props, "open">) {
  const [name, setName] = useState(initialName ?? "");
  const editing = initialName !== undefined;

  function handleSubmit() {
    if (!name.trim()) return;
    onSubmit(name.trim());
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "섹션 이름 변경" : "섹션 추가"}</DialogTitle>
      </DialogHeader>

      <div>
        <label className="text-sm font-medium">섹션 이름</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 교안 링크"
          className="mt-1.5"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </div>

      <DialogFooter className="sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={!name.trim()}>
          {editing ? "저장" : "추가"}
        </Button>
      </DialogFooter>
    </>
  );
}
