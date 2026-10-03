"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, LayoutGrid, Search } from "lucide-react";
import {
  EDUCATION_PHASES,
  educationPhase,
  educationStatusLabel,
  educationTitle,
  type EducationPhase,
} from "@/lib/education";
import type { Education } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { CompanyChip, PageContainer, ReadOnlyBadge, educationPath, type Mode } from "./shared";

type EducationItem = Education & { roundCount: number; boardCount: number };

// 목록은 이미 걸러져 온다 (관리자: 전체, 고객사 담당자: 열람 권한이 있는 교육, 강사: 배정된 교육).
export default function EducationList({
  mode,
  educations,
  initialTab,
  children,
}: {
  mode: Mode;
  educations: EducationItem[];
  // 관리자 탭 (?tab=). 교육에 들어갔다 돌아와도 보던 탭이 유지된다.
  initialTab?: string;
  // 목록 위에 붙는 영역 (관리자의 axhub 동기화)
  children?: React.ReactNode;
}) {
  const isAdmin = mode === "admin";
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<EducationPhase>(
    EDUCATION_PHASES.some((p) => p.key === initialTab) ? (initialTab as EducationPhase) : "operation",
  );

  const selectTab = (next: EducationPhase) => {
    setTab(next);
    window.history.replaceState(null, "", `?tab=${next}`);
  };

  // 기업명으로 검색해도, 교육명으로 검색해도 걸리도록 둘 다 본다.
  const q = query.trim().toLowerCase();
  const searched = q
    ? educations.filter((e) => [e.name, e.company?.name ?? ""].some((v) => v.toLowerCase().includes(q)))
    : educations;
  // 고객사 담당자·강사는 볼 수 있는 교육이 적어서 탭 없이 전부 보여준다.
  const filtered = isAdmin ? searched.filter((e) => educationPhase(e.status) === tab) : searched;

  return (
    <PageContainer wide={isAdmin}>
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {isAdmin ? "전체 교육" : "내 교육"}
          </h1>
          {mode === "client" && <ReadOnlyBadge />}
        </div>
        <p className="mt-2 text-muted-foreground">
          {isAdmin
            ? `생성된 모든 교육 ${educations.length}개`
            : mode === "instructor"
              ? "강사로 배정된 교육만 표시돼요."
              : "열람 권한이 있는 교육만 표시돼요."}
        </p>
      </div>

      {children}

      {isAdmin && (
        <div className="mb-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <div role="tablist" className="inline-flex self-start p-1 rounded-xl bg-muted">
            {EDUCATION_PHASES.map((p) => {
              const count = searched.filter((e) => educationPhase(e.status) === p.key).length;
              const active = tab === p.key;
              return (
                <button
                  key={p.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(p.key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label} <span className="ml-0.5 tabular-nums text-xs text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="기업명 또는 교육명으로 검색"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl text-muted-foreground">
          {educations.length === 0
            ? "열람 가능한 교육이 없어요."
            : q
              ? "검색 결과가 없어요."
              : "이 탭에 해당하는 교육이 없어요."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((ed) => (
            <Link
              key={ed.id}
              href={educationPath(mode, ed.id)}
              className="group bg-white rounded-2xl border border-border p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CompanyChip company={ed.company} />
                {educationStatusLabel(ed.status) && (
                  <Badge className="shrink-0" variant={ed.status === "stopped" ? "destructive" : "secondary"}>
                    {educationStatusLabel(ed.status)}
                  </Badge>
                )}
              </div>
              <h2 className="mt-4 text-lg font-semibold leading-snug flex-1">{educationTitle(ed.name)}</h2>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> {ed.roundCount}회차
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5" /> 보드 {ed.boardCount}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
