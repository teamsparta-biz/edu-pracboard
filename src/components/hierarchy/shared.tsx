"use client";

import { useState } from "react";
import { Check, Link2, Lock } from "lucide-react";
import Notice from "@/components/app/Notice";
import { Badge } from "@/components/ui/badge";
import type { Company } from "@/lib/types";

export type Mode = "admin" | "client";

export const basePath = (mode: Mode) => (mode === "admin" ? "/admin" : "/client");
export const rootLabel = (mode: Mode) => (mode === "admin" ? "전체 교육" : "내 교육");

export const educationPath = (mode: Mode, educationId: string) =>
  `${basePath(mode)}/educations/${educationId}`;
export const roundPath = (mode: Mode, educationId: string, roundId: string) =>
  `${educationPath(mode, educationId)}/rounds/${roundId}`;
export const lessonPath = (mode: Mode, educationId: string, roundId: string, lessonId: string) =>
  `${roundPath(mode, educationId, roundId)}/lessons/${lessonId}`;
export const boardPath = (boardId: string) => `/b/${boardId}`;

// wide: 카드를 한 줄에 4개 두는 교육 목록용
export function PageContainer({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={`w-full ${wide ? "max-w-7xl" : "max-w-6xl"} mx-auto px-6 py-10`}>{children}</div>;
}

// 고객사별 색을 따로 저장하지 않으므로 이름에서 색을 정한다.
const CHIP_COLORS = ["#1c2b8f", "#0a2e5c", "#a1004b", "#2f7d32", "#6a1b9a", "#b45309", "#0f766e", "#374151"];

function chipColor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CHIP_COLORS[hash % CHIP_COLORS.length];
}

export function CompanyChip({ company }: { company?: Company }) {
  if (!company) return null;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 text-xs font-medium text-muted-foreground">
      <span
        className="w-5 h-5 shrink-0 rounded-md flex items-center justify-center text-[10px] font-bold"
        style={{ backgroundColor: chipColor(company.name), color: "#fff" }}
      >
        {company.name.charAt(0)}
      </span>
      <span className="truncate">{company.name}</span>
    </span>
  );
}

export function ReadOnlyBadge() {
  return (
    <Badge variant="outline" className="gap-1">
      <Lock /> 읽기 전용
    </Badge>
  );
}

export function NotFound({ label }: { label: string }) {
  return <Notice icon={Lock} title={`${label}을(를) 찾을 수 없거나 볼 권한이 없어요`} />;
}

// 보드(최소 단위 교육) URL을 복사한다. 강사·교육생에게 전달하는 용도.
export function CopyUrlButton({ boardId, className = "" }: { boardId: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(`${window.location.origin}${boardPath(boardId)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className={
        "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors " +
        className
      }
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
      {copied ? "복사됨" : "URL 복사"}
    </button>
  );
}
