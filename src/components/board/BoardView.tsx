"use client";

import { useState, useTransition } from "react";
import { Lock, Plus, Trash2, MessagesSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { addCard, addSection, createImageUpload, deleteCard, deleteSection } from "@/app/actions/board";
import { createClient } from "@/lib/supabase/client";
import { CARD_IMAGE_BUCKET } from "@/lib/storage";
import type { BoardContext } from "@/lib/data";
import type { BoardRole, Card, Section } from "@/lib/types";
import { educationTitle } from "@/lib/education";
import { canDeleteCard, canManageBoard, canPost } from "@/lib/permissions";
import Breadcrumb from "@/components/layout/Breadcrumb";
import BoardCard from "@/components/board/BoardCard";
import CardForm, { type CardFormData } from "@/components/board/CardForm";
import CardDetail from "@/components/board/CardDetail";
import SectionForm from "@/components/board/SectionForm";
import { CopyUrlButton, basePath, educationPath, lessonPath, rootLabel, roundPath } from "@/components/hierarchy/shared";

type Props = BoardContext & {
  sections: Section[];
  cards: Card[];
  role: BoardRole;
  userId: string;
};

export default function BoardView({ board, lesson, round, education, division, sections, cards: allCards, role, userId }: Props) {
  const [rawSectionIndex, setSectionIndex] = useState(0);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [sectionFormOpen, setSectionFormOpen] = useState(false);
  const [selected, setSelected] = useState<Card | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  // 섹션이 삭제돼 범위를 벗어나면 마지막 섹션으로 맞춘다.
  const sectionIndex = Math.min(rawSectionIndex, Math.max(sections.length - 1, 0));

  const manage = canManageBoard(role);
  const post = canPost(role);
  const readOnly = !post;

  const section = sections[sectionIndex];
  const cards = section ? allCards.filter((c) => c.sectionId === section.id) : [];
  const hasPrev = sectionIndex > 0;
  const hasNext = sectionIndex < sections.length - 1;

  const title = `${lesson.order}차시${division ? ` · ${division.name}` : ""}`;

  // 관리자·고객사 담당자는 상위 계층에서 들어오므로 경로를 보여주고,
  // 강사·교육생은 이 URL만 보므로 경로 없이 교육 정보만 보여준다.
  const mode = role === "admin" ? "admin" : role === "viewer" ? "client" : null;

  function run(action: () => Promise<{ error?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      if (!result.error) after?.();
    });
  }

  const deleteHandler = (card: Card) =>
    canDeleteCard(role, userId, card) ? (id: string) => run(() => deleteCard(id)) : undefined;

  function handleAddSection(name: string) {
    run(() => addSection(board.id, name), () => setSectionIndex(sections.length));
  }

  function handleDeleteSection() {
    if (!section || sections.length <= 1) return;
    run(() => deleteSection(section.id), () => setSectionIndex(Math.max(sectionIndex - 1, 0)));
  }

  function handleAddCard(sectionId: string, data: CardFormData) {
    run(async () => {
      let imagePath: string | undefined;
      if (data.imageFile) {
        const upload = await createImageUpload(board.id, data.imageFile.name);
        if (upload.error || !upload.path || !upload.token) return { error: upload.error };
        const { error } = await createClient()
          .storage.from(CARD_IMAGE_BUCKET)
          .uploadToSignedUrl(upload.path, upload.token, data.imageFile);
        if (error) return { error: "이미지를 올리지 못했어요." };
        imagePath = upload.path;
      }
      return addCard(board.id, sectionId, { title: data.title, content: data.content, link: data.link, imagePath });
    });
  }

  return (
    <div className="w-full max-w-[1800px] mx-auto px-6 lg:px-12 py-10">
      {mode && (
        <Breadcrumb
          variant="light"
          items={[
            { label: rootLabel(mode), to: basePath(mode) },
            { label: educationTitle(education.name), to: educationPath(mode, education.id) },
            { label: `${round.order}회차 · ${round.title}`, to: roundPath(mode, education.id, round.id) },
            division
              ? { label: `${lesson.order}차시`, to: lessonPath(mode, education.id, round.id, lesson.id) }
              : { label: `${lesson.order}차시` },
            ...(division ? [{ label: division.name }] : []),
          ]}
        />
      )}

      <div className={(mode ? "mt-6 " : "") + "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"}>
        <div>
          <div className="text-sm text-white/60">
            {education.company?.name} · {educationTitle(education.name)} · {round.order}회차 {round.title}
          </div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-2 text-white/60">{lesson.description}</p>
        </div>

        <div className="flex items-center gap-2 self-start">
          {readOnly && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-white text-sm px-4 py-2">
              <Lock className="w-3.5 h-3.5" /> 읽기 전용
            </span>
          )}
          {manage && (
            <CopyUrlButton
              boardId={board.id}
              className="border-white/20 text-white/80 hover:text-white hover:bg-white/10 px-4 py-2 text-sm"
            />
          )}
        </div>
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
          {pending && <span className="text-sm text-white/50">· 저장 중...</span>}
        </div>

        <div className="flex items-center gap-2">
          {post && (
            <button
              onClick={() => setCardFormOpen(true)}
              disabled={!section}
              className="inline-flex items-center gap-2 bg-white text-[#591a2e] px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
            >
              <Plus className="w-4 h-4" /> 자료 올리기
            </button>
          )}
          {manage && (
            <>
              <button
                onClick={handleDeleteSection}
                disabled={sections.length <= 1 || pending}
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
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-200">{error}</p>}

      <div className="relative mt-6 px-0 sm:px-20 min-h-[340px]">
        {hasPrev && (
          <button
            onClick={() => setSectionIndex(sectionIndex - 1)}
            aria-label="이전 섹션"
            className="hidden sm:flex absolute left-0 top-[170px] -translate-y-1/2 items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={() => setSectionIndex(sectionIndex + 1)}
            aria-label="다음 섹션"
            className="hidden sm:flex absolute right-0 top-[170px] -translate-y-1/2 items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {!section ? (
          <div className="text-center py-20 border-2 border-dashed border-white/15 rounded-2xl">
            <p className="text-white/50">아직 만들어진 섹션이 없어요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-5">
            {cards.map((c) => (
              <BoardCard key={c.id} card={c} onDelete={deleteHandler(c)} onOpen={setSelected} />
            ))}
          </div>
        )}

        {(hasPrev || hasNext) && (
          <div className="mt-4 flex sm:hidden items-center justify-center gap-3">
            {hasPrev && (
              <button
                onClick={() => setSectionIndex(sectionIndex - 1)}
                aria-label="이전 섹션"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {hasNext && (
              <button
                onClick={() => setSectionIndex(sectionIndex + 1)}
                aria-label="다음 섹션"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {section && post && (
        <CardForm
          open={cardFormOpen}
          onClose={() => setCardFormOpen(false)}
          onSubmit={(data) => handleAddCard(section.id, data)}
        />
      )}
      {manage && (
        <SectionForm
          open={sectionFormOpen}
          onClose={() => setSectionFormOpen(false)}
          onSubmit={handleAddSection}
        />
      )}
      <CardDetail
        card={selected}
        onClose={() => setSelected(null)}
        onDelete={selected ? deleteHandler(selected) : undefined}
      />
    </div>
  );
}
