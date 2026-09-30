"use client";

import { useState, useTransition } from "react";
import { Lock, Pencil, Plus, Trash2, MessagesSquare, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addCard,
  addSection,
  createUpload,
  deleteCard,
  deleteSection,
  renameSection,
  updateCard,
  type AttachmentInput,
} from "@/app/actions/board";
import { createClient } from "@/lib/supabase/client";
import { CARD_IMAGE_BUCKET } from "@/lib/storage";
import type { BoardContext } from "@/lib/data";
import type { BoardRole, Card, Section } from "@/lib/types";
import { educationTitle, roundLabel } from "@/lib/education";
import { canEditCard, canManageBoard, canPost } from "@/lib/permissions";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import { useBoardRealtime } from "@/components/board/useBoardRealtime";
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
  // 보드 아래에 붙는 관리 영역 (관리자의 강사 목록)
  children?: React.ReactNode;
};

export default function BoardView({
  board,
  lesson,
  round,
  education,
  division,
  sections,
  cards: allCards,
  role,
  userId,
  children,
}: Props) {
  const [rawSectionIndex, setSectionIndex] = useState(0);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [sectionForm, setSectionForm] = useState<"add" | "rename" | null>(null);
  const [selected, setSelected] = useState<Card | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; run: () => void } | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  // 다른 사람이 바꾼 내용을 새로고침 없이 반영한다
  useBoardRealtime(board.id);

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

  const editHandler = (card: Card) => (canEditCard(role, userId, card) ? setEditingCard : undefined);
  const deleteHandler = (card: Card) =>
    canEditCard(role, userId, card)
      ? (target: Card) =>
          setConfirm({
            title: "카드를 삭제할까요?",
            description: `"${target.title}" 카드와 첨부 파일이 삭제돼요.`,
            run: () => {
              setSelected(null);
              run(() => deleteCard(target.id));
            },
          })
      : undefined;

  function handleSectionForm(name: string) {
    if (sectionForm === "rename" && section) run(() => renameSection(section.id, name));
    else run(() => addSection(board.id, name), () => setSectionIndex(sections.length));
  }

  function handleDeleteSection() {
    if (!section || sections.length <= 1) return;
    setConfirm({
      title: "섹션을 삭제할까요?",
      description: `"${section.name}" 섹션의 카드 ${cards.length}개도 함께 삭제돼요.`,
      run: () => run(() => deleteSection(section.id), () => setSectionIndex(Math.max(sectionIndex - 1, 0))),
    });
  }

  // 파일은 브라우저에서 Storage로 바로 올리고, 카드에는 경로만 저장한다.
  async function upload(file: File): Promise<AttachmentInput | { error: string }> {
    const target = await createUpload(board.id, file.name, file.size);
    if (target.error || !target.path || !target.token) return { error: target.error ?? "파일을 올리지 못했어요." };
    const { error } = await createClient()
      .storage.from(CARD_IMAGE_BUCKET)
      .uploadToSignedUrl(target.path, target.token, file, { contentType: file.type || undefined });
    if (error) return { error: "파일을 올리지 못했어요." };
    return { path: target.path, name: file.name, type: file.type, size: file.size };
  }

  function handleCardForm(data: CardFormData) {
    const editing = editingCard;
    run(async () => {
      let attachment: AttachmentInput | null | undefined = data.removeAttachment ? null : undefined;
      if (data.file) {
        const uploaded = await upload(data.file);
        if ("error" in uploaded) return uploaded;
        attachment = uploaded;
      }
      const input = { title: data.title, content: data.content, link: data.link, attachment };
      if (editing) return updateCard(editing.id, input);
      return section ? addCard(board.id, section.id, input) : { error: "섹션이 없어요." };
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
            { label: roundLabel(round), to: roundPath(mode, education.id, round.id) },
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
            {education.company?.name} · {educationTitle(education.name)} · {roundLabel(round)}
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
                onClick={() => setSectionForm("rename")}
                disabled={!section}
                className="inline-flex items-center gap-2 border border-white/20 text-white/80 px-4 py-2 rounded-full text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <Pencil className="w-4 h-4" /> 이름 변경
              </button>
              <button
                onClick={handleDeleteSection}
                disabled={sections.length <= 1 || pending}
                className="inline-flex items-center gap-2 border border-white/20 text-white/80 px-4 py-2 rounded-full text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <Trash2 className="w-4 h-4" /> 섹션 삭제
              </button>
              <button
                onClick={() => setSectionForm("add")}
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
              <BoardCard key={c.id} card={c} onEdit={editHandler(c)} onDelete={deleteHandler(c)} onOpen={setSelected} />
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

      {children && <div className="mt-12 max-w-2xl">{children}</div>}

      {post && (
        <CardForm
          open={cardFormOpen || !!editingCard}
          card={editingCard}
          onClose={() => {
            setCardFormOpen(false);
            setEditingCard(null);
          }}
          onSubmit={handleCardForm}
        />
      )}
      {manage && (
        <SectionForm
          open={!!sectionForm}
          initialName={sectionForm === "rename" ? section?.name : undefined}
          onClose={() => setSectionForm(null)}
          onSubmit={handleSectionForm}
        />
      )}
      <CardDetail
        // 실시간 반영으로 카드가 바뀌거나 지워지면 열려 있는 상세도 따라간다
        card={selected ? (allCards.find((c) => c.id === selected.id) ?? null) : null}
        onClose={() => setSelected(null)}
        onEdit={selected ? editHandler(selected) : undefined}
        onDelete={selected ? deleteHandler(selected) : undefined}
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        onConfirm={() => confirm?.run()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
