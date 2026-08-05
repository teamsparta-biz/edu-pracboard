"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAppStore, type Card } from "@/store/AppStore";
import Breadcrumb from "@/components/layout/Breadcrumb";
import BoardCard from "@/components/board/BoardCard";
import CardForm from "@/components/board/CardForm";
import CardDetail from "@/components/board/CardDetail";
import { Plus, Layers } from "lucide-react";

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
    getCardsByLesson,
    addCard,
    deleteCard,
  } = useAppStore();
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Card | null>(null);

  const enterprise = getEnterprise(enterpriseId);
  const education = getEducation(educationId);
  const lesson = getLesson(lessonId);
  const cards = getCardsByLesson(lessonId);

  if (!lesson || !education || !enterprise) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        차시를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <Breadcrumb
          items={[
            { label: "기업", to: "/" },
            { label: enterprise.name, to: `/enterprises/${enterpriseId}` },
            { label: education.name, to: `/enterprises/${enterpriseId}/educations/${educationId}` },
            { label: `${lesson.order}차시` },
          ]}
        />
        <div className="mt-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {lesson.order}차시
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{lesson.title}</h1>
            <p className="mt-2 text-muted-foreground">{lesson.description}</p>
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> 자료 올리기
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Layers className="w-3.5 h-3.5" /> 게시된 자료 {cards.length}개
        </div>

        {cards.length === 0 ? (
          <div className="mt-10 text-center py-20 border-2 border-dashed border-border rounded-2xl">
            <p className="text-muted-foreground">아직 올라온 자료가 없어요.</p>
            <button
              onClick={() => setFormOpen(true)}
              className="mt-4 inline-flex items-center gap-2 text-foreground font-medium underline underline-offset-4"
            >
              <Plus className="w-4 h-4" /> 첫 자료 올리기
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {cards.map((c) => (
              <BoardCard key={c.id} card={c} onDelete={deleteCard} onOpen={setSelected} />
            ))}
          </div>
        )}
      </div>
      <CardForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(data) => addCard(lessonId, data)}
      />
      <CardDetail card={selected} onClose={() => setSelected(null)} onDelete={deleteCard} />
    </div>
  );
}
