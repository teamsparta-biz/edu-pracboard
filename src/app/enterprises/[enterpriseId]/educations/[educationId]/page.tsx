"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/store/AppStore";
import Breadcrumb from "@/components/layout/Breadcrumb";
import LessonForm from "@/components/board/LessonForm";
import { Layers, ArrowUpRight, Plus, Search } from "lucide-react";

export default function Lessons() {
  const { enterpriseId, educationId } = useParams<{
    enterpriseId: string;
    educationId: string;
  }>();
  const {
    getEnterprise,
    getEducation,
    getLessonsByEducation,
    getCardsByLesson,
    addLesson,
  } = useAppStore();
  const enterprise = getEnterprise(enterpriseId);
  const education = getEducation(educationId);
  const lessons = getLessonsByEducation(educationId);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  if (!education || !enterprise) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        교육 과정을 찾을 수 없습니다.
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? lessons.filter(
        (l) =>
          l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q),
      )
    : lessons;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Breadcrumb
          items={[
            { label: "기업", to: "/" },
            { label: enterprise.name, to: `/enterprises/${enterpriseId}` },
            { label: education.name },
          ]}
        />
        <div className="mt-6 mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{education.name}</h1>
            <p className="mt-2 text-muted-foreground">
              {education.description} · {education.period}
            </p>
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> 차시 만들기
          </button>
        </div>

        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="차시 검색 (제목, 설명)"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
            <p className="text-muted-foreground">
              {q ? "검색 결과가 없어요." : "아직 만들어진 차시가 없어요."}
            </p>
            {!q && (
              <button
                onClick={() => setFormOpen(true)}
                className="mt-4 inline-flex items-center gap-2 text-foreground font-medium underline underline-offset-4"
              >
                <Plus className="w-4 h-4" /> 첫 차시 만들기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((l) => {
              const count = getCardsByLesson(l.id).length;
              return (
                <Link
                  key={l.id}
                  href={`/enterprises/${enterpriseId}/educations/${educationId}/lessons/${l.id}`}
                  className="group flex items-center gap-5 bg-white rounded-2xl border border-border p-5 hover:shadow-md hover:border-foreground/20 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center font-bold text-lg shrink-0">
                    {l.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-base truncate">{l.title}</h2>
                    <p className="text-sm text-muted-foreground truncate">{l.description}</p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Layers className="w-3.5 h-3.5" /> 자료 {count}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <LessonForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(data) => addLesson(educationId, data)}
        nextOrder={lessons.length + 1}
      />
    </div>
  );
}
