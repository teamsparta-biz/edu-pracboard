"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, ChevronDown, Lock, Pencil, Plus, Settings2, Trash2, MessagesSquare, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import {
  addCard,
  addComment,
  addSection,
  createUpload,
  deleteCard,
  deleteComment,
  deleteSection,
  renameSection,
  toggleLike,
  updateCard,
  type AttachmentInput,
} from "@/app/actions/board";
import { createClient } from "@/lib/supabase/client";
import { CARD_IMAGE_BUCKET } from "@/lib/storage";
import type { BoardContext } from "@/lib/data";
import type { BoardRole, Card, Comment, Section } from "@/lib/types";
import { educationTitle, roundLabel } from "@/lib/education";
import { canDeleteComment, canEditCard, canManageBoard, canPost, canReact } from "@/lib/permissions";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  // 제목 오른쪽 버튼 줄에 붙는 관리 버튼 (관리자의 강사 목록)
  headerActions?: React.ReactNode;
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
  headerActions,
}: Props) {
  const [rawSectionIndex, setSectionIndex] = useState(0);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [sectionForm, setSectionForm] = useState<"add" | "rename" | null>(null);
  const [selected, setSelected] = useState<Card | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; run: () => void } | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  // 보드에 끌어다 놓은 파일. 자료 올리기 창을 이 파일이 붙은 채로 연다.
  const [droppedFile, setDroppedFile] = useState<File>();
  // dragenter/dragleave는 자식 요소를 지날 때마다 오므로 깊이를 세어 바깥으로 나갔을 때만 끈다
  const [dragDepth, setDragDepth] = useState(0);
  // 하트는 누르자마자 보여주고, 서버에서 다시 읽은 값이 오면 그것으로 바뀐다
  const [shownCards, toggleLikeLocal] = useOptimistic(allCards, (list: Card[], cardId: string) =>
    list.map((c) =>
      c.id !== cardId
        ? c
        : { ...c, likedBy: c.likedBy.includes(userId) ? c.likedBy.filter((id) => id !== userId) : [...c.likedBy, userId] },
    ),
  );

  // 다른 사람이 바꾼 내용을 새로고침 없이 반영한다
  useBoardRealtime(board.id);

  // 섹션이 삭제돼 범위를 벗어나면 마지막 섹션으로 맞춘다.
  const sectionIndex = Math.min(rawSectionIndex, Math.max(sections.length - 1, 0));

  const manage = canManageBoard(role);
  const post = canPost(role);
  const readOnly = !post;
  const react = canReact(role);

  const section = sections[sectionIndex];
  const cards = section ? shownCards.filter((c) => c.sectionId === section.id) : [];
  const hasPrev = sectionIndex > 0;
  const hasNext = sectionIndex < sections.length - 1;

  const title = `${lesson.order}차시${division ? ` · ${division.name}` : ""}`;

  // 이미 창이 열려 있으면 창 안의 첨부 칸이 파일을 받는다 (창은 포털이라 이벤트가 여기까지 올라온다)
  const acceptsDrop = post && !!section && !cardFormOpen && !editingCard;
  const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");
  const dropHandlers = acceptsDrop
    ? {
        onDragEnter: (e: React.DragEvent) => isFileDrag(e) && setDragDepth((d) => d + 1),
        onDragLeave: (e: React.DragEvent) => isFileDrag(e) && setDragDepth((d) => Math.max(d - 1, 0)),
        onDragOver: (e: React.DragEvent) => isFileDrag(e) && e.preventDefault(),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragDepth(0);
          const file = e.dataTransfer.files[0];
          if (!file) return;
          setDroppedFile(file);
          setCardFormOpen(true);
        },
      }
    : {};
  const countIn = (s: Section) => allCards.filter((c) => c.sectionId === s.id).length;

  // 관리자·고객사 담당자·강사는 상위 계층에서 들어오므로 경로를 보여주고,
  // 교육생은 이 URL만 보므로 경로 없이 교육 정보만 보여준다.
  const mode = role === "admin" ? "admin" : role === "viewer" ? "client" : role === "instructor" ? "instructor" : null;

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

  const likeHandler = react
    ? (card: Card) =>
        startTransition(async () => {
          toggleLikeLocal(card.id);
          const result = await toggleLike(card.id);
          if (result.error) setError(result.error);
        })
    : undefined;

  const addCommentHandler = react
    ? async (card: Card, content: string) => {
        const result = await addComment(card.id, content);
        setError(result.error);
        return !result.error;
      }
    : undefined;

  const deleteCommentHandler = (comment: Comment) =>
    canDeleteComment(role, userId, comment)
      ? () =>
          setConfirm({
            title: "댓글을 삭제할까요?",
            description: `"${comment.content.length > 30 ? comment.content.slice(0, 30) + "…" : comment.content}" 댓글이 삭제돼요.`,
            run: () => run(() => deleteComment(comment.id)),
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
    <div className="w-full max-w-[1800px] mx-auto px-6 lg:px-12 py-10" {...dropHandlers}>
      {acceptsDrop && dragDepth > 0 && (
        <div className="fixed inset-0 z-40 p-6 bg-black/40 pointer-events-none">
          <div className="h-full rounded-3xl border-2 border-dashed border-white/70 flex flex-col items-center justify-center gap-3 text-white text-center">
            <Upload className="w-8 h-8" />
            <p className="text-lg font-semibold">여기에 놓으면 &quot;{section?.name}&quot; 섹션에 올릴 수 있어요</p>
            <p className="text-sm text-white/70">파일 1개, 50MB 이하</p>
          </div>
        </div>
      )}
      {mode && (
        <Breadcrumb
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
          <div className="text-sm text-muted-foreground">
            {education.company?.name} · {educationTitle(education.name)} · {roundLabel(round)}
          </div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-muted-foreground">{lesson.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          {headerActions}
          {readOnly && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground text-sm px-4 py-2">
              <Lock className="w-3.5 h-3.5" /> 읽기 전용
            </span>
          )}
          {manage && (
            <CopyUrlButton
              boardId={board.id}
              className="bg-white px-4 py-2 text-sm"
            />
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-foreground">
          <MessagesSquare className="w-5 h-5" />
          {/* 섹션이 여럿이면 이름을 눌러 원하는 섹션으로 바로 간다 */}
          {sections.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md -mx-1.5 px-1.5 py-0.5 font-semibold hover:bg-black/5 transition-colors">
                {section?.name} <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
                {sections.map((s, i) => (
                  <DropdownMenuItem key={s.id} onClick={() => setSectionIndex(i)}>
                    <Check className={i === sectionIndex ? "opacity-100" : "opacity-0"} />
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{countIn(s)}개</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="font-semibold">{section?.name ?? "섹션 없음"}</span>
          )}
          {section && (
            <span className="text-sm text-muted-foreground">
              · {cards.length}개 · {sectionIndex + 1}/{sections.length}
            </span>
          )}
          {pending && <span className="text-sm text-muted-foreground">· 저장 중...</span>}
        </div>

        <div className="flex items-center gap-2">
          {post && (
            <button
              onClick={() => setCardFormOpen(true)}
              disabled={!section}
              className="inline-flex items-center gap-2 whitespace-nowrap bg-board text-white px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
            >
              <Plus className="w-4 h-4" /> 자료 올리기
            </button>
          )}
          {/* 섹션 추가·이름 변경·삭제는 하나의 메뉴로 묶는다. 버튼 네 개를 늘어놓으면 좁은 화면에서 깨진다. */}
          {manage && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-2 whitespace-nowrap bg-white border border-border text-foreground px-4 py-2 rounded-full text-sm font-medium hover:bg-muted transition-colors">
                <Settings2 className="w-4 h-4" /> 섹션 관리
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setSectionForm("add")}>
                  <Plus /> 섹션 추가
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!section} onClick={() => setSectionForm("rename")}>
                  <Pencil /> 이름 변경
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" disabled={sections.length <= 1 || pending} onClick={handleDeleteSection}>
                  <Trash2 /> 섹션 삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="relative mt-6 px-0 sm:px-20 min-h-[340px]">
        {hasPrev && (
          <button
            onClick={() => setSectionIndex(sectionIndex - 1)}
            aria-label="이전 섹션"
            className="hidden sm:flex absolute left-0 top-[170px] -translate-y-1/2 items-center justify-center w-9 h-9 rounded-full bg-white border border-border text-foreground shadow-sm hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={() => setSectionIndex(sectionIndex + 1)}
            aria-label="다음 섹션"
            className="hidden sm:flex absolute right-0 top-[170px] -translate-y-1/2 items-center justify-center w-9 h-9 rounded-full bg-white border border-border text-foreground shadow-sm hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {!section ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
            <p className="text-muted-foreground">아직 만들어진 섹션이 없어요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-5">
            {cards.map((c) => (
              <BoardCard
                key={c.id}
                card={c}
                onEdit={editHandler(c)}
                onDelete={deleteHandler(c)}
                onOpen={setSelected}
                liked={c.likedBy.includes(userId)}
                onLike={likeHandler}
              />
            ))}
          </div>
        )}

        {(hasPrev || hasNext) && (
          <div className="mt-4 flex sm:hidden items-center justify-center gap-3">
            {hasPrev && (
              <button
                onClick={() => setSectionIndex(sectionIndex - 1)}
                aria-label="이전 섹션"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-border text-foreground shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {hasNext && (
              <button
                onClick={() => setSectionIndex(sectionIndex + 1)}
                aria-label="다음 섹션"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-border text-foreground shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {post && (
        <CardForm
          open={cardFormOpen || !!editingCard}
          card={editingCard}
          initialFile={editingCard ? undefined : droppedFile}
          onClose={() => {
            setCardFormOpen(false);
            setEditingCard(null);
            setDroppedFile(undefined);
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
        card={selected ? (shownCards.find((c) => c.id === selected.id) ?? null) : null}
        onClose={() => setSelected(null)}
        onEdit={selected ? editHandler(selected) : undefined}
        onDelete={selected ? deleteHandler(selected) : undefined}
        liked={!!selected && !!shownCards.find((c) => c.id === selected.id)?.likedBy.includes(userId)}
        onLike={likeHandler}
        onAddComment={addCommentHandler}
        deleteCommentHandler={deleteCommentHandler}
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
