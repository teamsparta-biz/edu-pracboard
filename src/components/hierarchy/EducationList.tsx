"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, LayoutGrid, Search } from "lucide-react";
import { useAppStore } from "@/store/AppStore";
import { educationTitle } from "@/lib/education";
import { canViewEducation } from "@/lib/permissions";
import { CompanyChip, PageContainer, ReadOnlyBadge, educationPath, type Mode } from "./shared";

export default function EducationList({ mode }: { mode: Mode }) {
  const user = useAppStore((s) => s.getCurrentUser());
  const { educations, getCompany, getRoundsByEducation, getBoardsByEducation } = useAppStore();
  const [query, setQuery] = useState("");

  const visible = educations.filter((e) => canViewEducation(user, e.id));
  // 기업명으로 검색해도, 교육명으로 검색해도 걸리도록 둘 다 본다.
  const q = query.trim().toLowerCase();
  const filtered = q
    ? visible.filter((e) =>
        [e.name, getCompany(e.companyId)?.name ?? ""].some((v) => v.toLowerCase().includes(q)),
      )
    : visible;
  const isAdmin = mode === "admin";

  return (
    <PageContainer>
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {isAdmin ? "전체 교육" : "내 교육"}
          </h1>
          {!isAdmin && <ReadOnlyBadge />}
        </div>
        <p className="mt-2 text-muted-foreground">
          {isAdmin
            ? `생성된 모든 교육 ${visible.length}개`
            : "열람 권한이 있는 교육만 표시돼요."}
        </p>
      </div>

      {isAdmin && (
        <div className="mb-6">
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
          {visible.length === 0 ? "열람 가능한 교육이 없어요." : "검색 결과가 없어요."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((ed) => (
            <Link
              key={ed.id}
              href={educationPath(mode, ed.id)}
              className="group bg-white rounded-2xl border border-border p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
            >
              <div className="flex items-center justify-between">
                <CompanyChip company={getCompany(ed.companyId)} />
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <h2 className="mt-4 text-lg font-semibold leading-snug flex-1">
                {educationTitle(ed.name)}
              </h2>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> {getRoundsByEducation(ed.id).length}회차
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5" /> 보드 {getBoardsByEducation(ed.id).length}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
