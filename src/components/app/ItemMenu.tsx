"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
  label?: string;
};

// 수정·삭제 메뉴(…). 권한이 없는 동작은 넘기지 않는다.
export default function ItemMenu({ onEdit, onDelete, className = "", label = "더 보기" }: Props) {
  if (!onEdit && !onDelete) return null;
  return (
    // 목록 행(Link)이나 카드 안에 있어도 이동·열기가 일어나지 않게 막는다.
    // 메뉴 항목은 포털에 그려지지만 React 이벤트는 컴포넌트 트리를 따라 올라오므로 여기서 함께 막힌다.
    <span
      className="inline-flex"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <ItemMenuContent onEdit={onEdit} onDelete={onDelete} className={className} label={label} />
    </span>
  );
}

function ItemMenuContent({ onEdit, onDelete, className, label }: Required<Pick<Props, "className" | "label">> & Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} className={"p-1.5 rounded-full transition-colors " + className}>
        <MoreHorizontal className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil /> 수정
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 /> 삭제
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
