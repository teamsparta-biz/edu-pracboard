"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAppStore, type Card } from "@/store/AppStore";
import Breadcrumb from "@/components/layout/Breadcrumb";
import BoardCard from "@/components/board/BoardCard";
import CardForm from "@/components/board/CardForm";
import CardDetail from "@/components/board/CardDetail";
import SectionForm from "@/components/board/SectionForm";
import {
  Plus,
  Trash2,
  BookOpen,
  MessagesSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function Board() {
  const { enterpriseId, educationId, lessonId } = useParams<{
    enterpriseId: string;
    educationId: string;
    lessonId: string;
  }>();
  const {
    getEnterprise,
    getEducation,
    getLesson,
    getSectionsByLesson,
    getCardsBySection,
    addSection,
    deleteSection,
    addCard,
    deleteCard,
  } = useAppStore();

  const [sectionIndex, setSectionIndex] = useState(0);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [sectionFormOpen, setSectionFormOpen] = useState(false);
  const [selected, setSelected] = useState<Card | null>(null);

  const enterprise = getEnterprise(enterpriseId);
  const education = getEducation(educationId);
  const lesson = getLesson(lessonId);
  const sections = getSectionsByLesson(lessonId);

  useEffect(() => {
    setSectionIndex((i) => Math.min(i, Math.max(sections.length - 1, 0)));
  }, [sections.length]);

  if (!lesson || !education || !enterprise) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        차시를 찾을 수 없습니다.
      </div>
    );
  }

  const section = sections[sectionIndex];
  const cards = section ? getCardsBySection(section.id) : [];
  const hasPrev = sectionIndex > 0;
  const hasNext = sectionIndex < sections.length - 1;

  function handleAddSection(name: string) {
    addSection(lessonId, name);
    setSectionIndex(sections.length);
  }

  function handleDeleteSection() {
    if (!section || sections.length <= 1) return;
    deleteSection(section.id);
    setSectionIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="min-h-screen bg-[#591a2e]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Breadcrumb
          variant="light"
          items={[
            { label: "기업", to: "/" },
            { label: enterprise.name, to: `/enterprises/${enterpriseId}` },
            { label: education.name, to: `/enterprises/${enterpriseId}/educations/${educationId}` },
            { label: `${lesson.order}차시` },
          ]}
        />

        <div className="mt-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="text-sm text-white/60">
              {enterprise.name} · {education.name}
            </div>
            <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-white">
              {lesson.order}차시 · {lesson.title}
            </h1>
            <p className="mt-2 text-white/60">{lesson.description}</p>
          </div>

          {sections.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-white text-sm px-4 py-2 self-start">
              <BookOpen className="w-3.5 h-3.5" /> 섹션 {sectionIndex + 1}
            </span>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white">
            <MessagesSquare className="w-5 h-5" />
            <span className="font-semibold">{section?.name ?? "섹션 없음"}</span>
            {section && (
              <span className="text-sm text-white/50">
                · {cards.length}개 · {sectionIndex + 1}/{sections.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCardFormOpen(true)}
              disabled={!section}
              className="inline-flex items-center gap-2 bg-white text-[#591a2e] px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
            >
              <Plus className="w-4 h-4" /> 자료 올리기
            </button>
            <button
              onClick={handleDeleteSection}
              disabled={sections.length <= 1}
              className="inline-flex items-center gap-2 border border-white/20 text-white/80 px-4 py-2 rounded-full text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <Trash2 className="w-4 h-4" /> 섹션 삭제
            </button>
            <button
              onClick={() => setSectionFormOpen(true)}
              className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-white/20 transition-colors"
            >
              <Plus className="w-4 h-4" /> 섹션 추가
            </button>
          </div>
        </div>

        <div className="relative mt-6 px-0 sm:px-12">
          <button
            onClick={() => hasPrev && setSectionIndex((i) => i - 1)}
            disabled={!hasPrev}
            aria-label="이전 섹션"
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-20 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => hasNext && setSectionIndex((i) => i + 1)}
            disabled={!hasNext}
            aria-label="다음 섹션"
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-20 disabled:pointer-events-none"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!section ? (
            <div className="text-center py-20 border-2 border-dashed border-white/15 rounded-2xl">
              <p className="text-white/50">아직 만들어진 섹션이 없어요.</p>
            </div>
          ) : cards.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-white/15 rounded-2xl">
              <p className="text-white/50">아직 올라온 자료가 없어요.</p>
              <button
                onClick={() => setCardFormOpen(true)}
                className="mt-4 inline-flex items-center gap-2 text-white font-medium underline underline-offset-4"
              >
                <Plus className="w-4 h-4" /> 첫 자료 올리기
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {cards.map((c) => (
                <BoardCard key={c.id} card={c} onDelete={deleteCard} onOpen={setSelected} />
              ))}
            </div>
          )}

          <div className="mt-4 flex sm:hidden items-center justify-center gap-3">
            <button
              onClick={() => hasPrev && setSectionIndex((i) => i - 1)}
              disabled={!hasPrev}
              aria-label="이전 섹션"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white disabled:opacity-20"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => hasNext && setSectionIndex((i) => i + 1)}
              disabled={!hasNext}
              aria-label="다음 섹션"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white disabled:opacity-20"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {section && (
        <CardForm
          open={cardFormOpen}
          onClose={() => setCardFormOpen(false)}
          onSubmit={(data) => addCard(section.id, data)}
        />
      )}
      <SectionForm
        open={sectionFormOpen}
        onClose={() => setSectionFormOpen(false)}
        onSubmit={handleAddSection}
      />
      <CardDetail card={selected} onClose={() => setSelected(null)} onDelete={deleteCard} />
    </div>
  );
}
