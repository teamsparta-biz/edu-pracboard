"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { CheckSquare, Lock, Pencil, Pin, PinOff, Plus, Settings2, Trash2, ChevronLeft, ChevronRight, Upload, X } from "lucide-react";
import {
  addCard,
  addComment,
  addSection,
  createUpload,
  deleteCard,
  deleteCards,
  deleteComment,
  deleteSection,
  renameSection,
  reorderPinnedCards,
  setCardsPinned,
  toggleLike,
  updateCard,
  type AttachmentInput,
} from "@/app/actions/board";
import { createClient } from "@/lib/supabase/client";
import { CARD_IMAGE_BUCKET, MAX_ATTACHMENT_BYTES, formatBytes } from "@/lib/storage";
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
  educationBoard,
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
  // 하트와 고정 카드 순서는 바로 보여주고, 서버에서 다시 읽은 값이 오면 그것으로 바뀐다
  const [shownCards, applyLocal] = useOptimistic(allCards, (list: Card[], change: LocalChange) =>
    change.type === "pinOrder"
      ? withPinOrder(list, change.ids)
      : list.map((c) =>
          c.id !== change.cardId
            ? c
            : { ...c, likedBy: c.likedBy.includes(userId) ? c.likedBy.filter((id) => id !== userId) : [...c.likedBy, userId] },
        ),
  );
  // 끌고 있는 고정 카드와, 끄는 동안 미리 보여주는 고정 카드 순서
  const [pinDrag, setPinDrag] = useState<{ id: string; ids: string[] } | null>(null);
  // 다중 선택 (관리자·강사): 지금 섹션의 카드를 골라 한꺼번에 지우거나 고정한다
  const [selecting, setSelecting] = useState(false);
  const [rawPicked, setPicked] = useState<string[]>([]);

  // 다른 사람이 바꾼 내용을 새로고침 없이 반영한다
  useBoardRealtime(board.id);

  // 섹션이 삭제돼 범위를 벗어나면 마지막 섹션으로 맞춘다.
  const sectionIndex = Math.min(rawSectionIndex, Math.max(sections.length - 1, 0));
  const navAnchorRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // 화살표나 키보드로 섹션이 바뀌면 탭 줄에서 그 탭이 보이게 한다 (섹션이 많아 가로로 넘칠 때)
  useEffect(() => {
    tabRefs.current[sectionIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sectionIndex]);

  const manage = canManageBoard(role);
  const post = canPost(role);
  const readOnly = !post;
  const react = canReact(role);

  const section = sections[sectionIndex];
  const sectionCards = section ? shownCards.filter((c) => c.sectionId === section.id) : [];
  const cards = pinDrag ? withPinOrder(sectionCards, pinDrag.ids) : sectionCards;
  // 실시간 반영으로 지워진 카드는 선택에서 뺀다
  const picked = rawPicked.filter((id) => sectionCards.some((c) => c.id === id));
  const pickedCards = sectionCards.filter((c) => picked.includes(c.id));
  const hasPrev = sectionIndex > 0;
  const hasNext = sectionIndex < sections.length - 1;

  // 교육 보드는 회차·차시 없이 보드 이름이 제목이다
  const title = lesson ? `${lesson.order}차시${division ? ` · ${division.name}` : ""}` : (educationBoard?.name ?? "보드");
  const description = lesson ? lesson.description : (educationBoard?.description ?? "");

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

  const pinHandler = manage ? (card: Card) => run(() => setCardsPinned([card.id], !card.pinned)) : undefined;

  function stopSelecting() {
    setSelecting(false);
    setPicked([]);
  }
  const togglePick = (id: string) => setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  // Esc로 선택을 끝낸다 (창이 열려 있으면 창이 먼저 닫힌다)
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !confirm && stopSelecting();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, confirm]);

  function deletePicked() {
    const targets = pickedCards;
    if (!targets.length) return;
    setConfirm({
      title: `카드 ${targets.length}개를 삭제할까요?`,
      description: "선택한 카드와 첨부 파일, 하트·댓글이 모두 삭제돼요. 되돌릴 수 없어요.",
      run: () => run(() => deleteCards(targets.map((c) => c.id)), stopSelecting),
    });
  }
  // 보이는 순서대로 고정해야 고정 카드 사이의 순서도 그대로 간다
  const pinPicked = (pinned: boolean) =>
    run(() => setCardsPinned(pickedCards.filter((c) => c.pinned !== pinned).map((c) => c.id), pinned), () => setPicked([]));

  const likeHandler = react
    ? (card: Card) =>
        startTransition(async () => {
          applyLocal({ type: "like", cardId: card.id });
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

  // 고정 카드끼리 끌어다 놓아 순서를 바꾼다 (관리자·강사). 끄는 동안 자리를 미리 바꿔 보여주고, 놓으면 저장한다.
  // 모바일 터치는 브라우저가 끌어 놓기를 지원하지 않아 순서를 바꿀 수 없다.
  const pinDragProps = (card: Card) => {
    if (!manage || !card.pinned || !section) return undefined;
    const sectionId = section.id;
    return {
      dragging: pinDrag?.id === card.id,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.id);
        setPinDrag({ id: card.id, ids: cards.filter((c) => c.pinned).map((c) => c.id) });
      },
      onDragOver: (e: React.DragEvent) => {
        if (!pinDrag) return;
        e.preventDefault();
        const from = pinDrag.ids.indexOf(pinDrag.id);
        const to = pinDrag.ids.indexOf(card.id);
        if (from === to) return;
        const ids = [...pinDrag.ids];
        ids.splice(from, 1);
        ids.splice(to, 0, pinDrag.id);
        setPinDrag({ ...pinDrag, ids });
      },
      onDragEnd: (e: React.DragEvent) => {
        const dragged = pinDrag;
        setPinDrag(null);
        // 카드 영역 밖에 놓거나 Esc로 취소하면 원래대로 둔다
        if (!dragged || e.dataTransfer.dropEffect === "none") return;
        const before = sectionCards.filter((c) => c.pinned).map((c) => c.id);
        if (before.join() === dragged.ids.join()) return;
        startTransition(async () => {
          applyLocal({ type: "pinOrder", ids: dragged.ids });
          const result = await reorderPinnedCards(sectionId, dragged.ids);
          setError(result.error);
        });
      },
    };
  };
  // 카드 사이 빈틈에 놓아도 놓은 것으로 친다
  const pinDropZone = pinDrag
    ? {
        onDragOver: (e: React.DragEvent) => e.preventDefault(),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
        },
      }
    : {};

  // 섹션을 바꿀 때, 아래로 스크롤해 탭이 화면 위에 붙어 있던 상태면 새 섹션의 처음부터 보이도록 탭 위치로 올린다
  function goToSection(i: number) {
    setSectionIndex(i);
    setPicked([]);
    const top = navAnchorRef.current ? navAnchorRef.current.getBoundingClientRect().top + window.scrollY : 0;
    if (window.scrollY > top) window.scrollTo({ top });
  }

  // 화살표 키로 탭 사이를 오간다 (탭 목록 표준 동작)
  function handleTabKey(e: React.KeyboardEvent) {
    const last = sections.length - 1;
    const next =
      e.key === "ArrowRight" ? Math.min(sectionIndex + 1, last)
      : e.key === "ArrowLeft" ? Math.max(sectionIndex - 1, 0)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    goToSection(next);
    tabRefs.current[next]?.focus();
  }

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
            <p className="text-sm text-white/70">파일 1개, {formatBytes(MAX_ATTACHMENT_BYTES)} 이하</p>
          </div>
        </div>
      )}
      {mode && (
        <Breadcrumb
          items={[
            { label: rootLabel(mode), to: basePath(mode) },
            { label: educationTitle(education.name), to: educationPath(mode, education.id) },
            ...(round && lesson
              ? [
                  { label: roundLabel(round), to: roundPath(mode, education.id, round.id) },
                  division
                    ? { label: `${lesson.order}차시`, to: lessonPath(mode, education.id, round.id, lesson.id) }
                    : { label: `${lesson.order}차시` },
                  ...(division ? [{ label: division.name }] : []),
                ]
              : [{ label: title }]),
          ]}
        />
      )}

      <div className={(mode ? "mt-6 " : "") + "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"}>
        <div>
          <div className="text-sm text-muted-foreground">
            {[education.company?.name, educationTitle(education.name), round && roundLabel(round)].filter(Boolean).join(" · ")}
          </div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-2 text-muted-foreground">{description}</p>}
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

      {/* 섹션 탭: 모든 섹션을 한 줄로 보여주고 한 번에 이동한다. 스크롤해도 화면 위에 붙어 있다. */}
      <div ref={navAnchorRef} className="mt-8" />
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-12 px-6 lg:px-12 py-3 bg-board-bg/95 backdrop-blur border-b border-border/60 flex flex-col sm:flex-row sm:items-center gap-3">
        <div
          role="tablist"
          aria-label="섹션"
          onKeyDown={handleTabKey}
          className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sections.length === 0 && <span className="text-sm text-muted-foreground px-1">섹션 없음</span>}
          {sections.map((s, i) => {
            const active = i === sectionIndex;
            return (
              <button
                key={s.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => goToSection(i)}
                className={
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full pl-3.5 pr-2 py-1.5 text-sm font-medium whitespace-nowrap border transition-colors " +
                  (active
                    ? "bg-board border-board text-white"
                    : "bg-white border-border text-foreground hover:bg-muted")
                }
              >
                {s.name}
                <span
                  className={
                    "min-w-5 rounded-full px-1.5 text-xs tabular-nums " +
                    (active ? "bg-white/25 text-white" : "bg-muted text-muted-foreground")
                  }
                >
                  {countIn(s)}
                </span>
              </button>
            );
          })}
          {manage && (
            <button
              onClick={() => setSectionForm("add")}
              aria-label="섹션 추가"
              className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground border border-dashed border-border hover:bg-white hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> 섹션
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pending && <span className="text-sm text-muted-foreground">저장 중...</span>}
          {post && (
            <button
              onClick={() => setCardFormOpen(true)}
              disabled={!section}
              className="inline-flex items-center gap-2 whitespace-nowrap bg-board text-white px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
            >
              <Plus className="w-4 h-4" /> 자료 올리기
            </button>
          )}
          {manage && (
            <button
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              disabled={!section || (!selecting && sectionCards.length === 0)}
              aria-pressed={selecting}
              className={
                "inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-colors disabled:opacity-40 disabled:pointer-events-none " +
                (selecting ? "bg-foreground text-background border-foreground" : "bg-white border-border text-foreground hover:bg-muted")
              }
            >
              <CheckSquare className="w-4 h-4" /> {selecting ? "선택 끝내기" : "선택"}
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

      <div className="relative mt-6 px-0 sm:px-12 lg:-mx-6 min-h-[340px]">
        {/* 화살표는 카드 영역 높이만큼의 세로 레일 안에서 화면 가운데에 붙어 있어, 스크롤해도 따라온다 */}
        {hasPrev && (
          <div className="hidden sm:block absolute left-0 inset-y-0 pt-[152px]">
            <button
              onClick={() => goToSection(sectionIndex - 1)}
              aria-label="이전 섹션"
              className="sticky top-[calc(50vh-18px)] flex items-center justify-center w-9 h-9 rounded-full bg-white border border-border text-foreground shadow-sm hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
        {hasNext && (
          <div className="hidden sm:block absolute right-0 inset-y-0 pt-[152px]">
            <button
              onClick={() => goToSection(sectionIndex + 1)}
              aria-label="다음 섹션"
              className="sticky top-[calc(50vh-18px)] flex items-center justify-center w-9 h-9 rounded-full bg-white border border-border text-foreground shadow-sm hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {!section ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
            <p className="text-muted-foreground">아직 만들어진 섹션이 없어요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5" {...pinDropZone}>
            {cards.map((c) => (
              <BoardCard
                key={c.id}
                card={c}
                onEdit={editHandler(c)}
                onDelete={deleteHandler(c)}
                onOpen={setSelected}
                liked={c.likedBy.includes(userId)}
                onLike={selecting ? undefined : likeHandler}
                drag={pinDragProps(c)}
                onPin={pinHandler}
                select={selecting ? { checked: picked.includes(c.id), onToggle: () => togglePick(c.id) } : undefined}
              />
            ))}
          </div>
        )}

        {(hasPrev || hasNext) && (
          <div className="mt-4 flex sm:hidden items-center justify-center gap-3">
            {hasPrev && (
              <button
                onClick={() => goToSection(sectionIndex - 1)}
                aria-label="이전 섹션"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-border text-foreground shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {hasNext && (
              <button
                onClick={() => goToSection(sectionIndex + 1)}
                aria-label="다음 섹션"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-border text-foreground shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {selecting && (
        <div
          role="toolbar"
          aria-label="선택한 카드"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full bg-foreground text-background shadow-xl px-2 py-2 text-sm max-w-[calc(100vw-32px)] overflow-x-auto"
        >
          <span className="px-3 font-medium whitespace-nowrap tabular-nums">{picked.length}개 선택</span>
          <button
            onClick={() => setPicked(picked.length === sectionCards.length ? [] : sectionCards.map((c) => c.id))}
            className="whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-white/15 transition-colors"
          >
            {picked.length === sectionCards.length ? "선택 해제" : "전체 선택"}
          </button>
          <span className="w-px h-5 bg-white/20 mx-1" />
          <button
            onClick={() => pinPicked(true)}
            disabled={!pickedCards.some((c) => !c.pinned) || pending}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-white/15 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Pin className="w-4 h-4" /> 고정
          </button>
          <button
            onClick={() => pinPicked(false)}
            disabled={!pickedCards.some((c) => c.pinned) || pending}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-white/15 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <PinOff className="w-4 h-4" /> 고정 해제
          </button>
          <button
            onClick={deletePicked}
            disabled={!picked.length || pending}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-red-300 hover:bg-white/15 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash2 className="w-4 h-4" /> 삭제
          </button>
          <button onClick={stopSelecting} aria-label="선택 끝내기" className="rounded-full p-1.5 hover:bg-white/15 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

type LocalChange = { type: "like"; cardId: string } | { type: "pinOrder"; ids: string[] };

// 고정 카드 자리는 그대로 두고, 그 자리에 들어갈 카드만 ids 순서로 바꾼다
function withPinOrder(list: Card[], ids: string[]) {
  const rank = new Map(ids.map((id, i) => [id, i]));
  const ordered = list.filter((c) => rank.has(c.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  let next = 0;
  return list.map((c) => (rank.has(c.id) ? ordered[next++] : c));
}
