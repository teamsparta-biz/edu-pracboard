"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Layers, LayoutGrid, Plus, Search, Users } from "lucide-react";
import { useAppStore } from "@/store/AppStore";
import { educationTitle } from "@/lib/education";
import { canViewEducation } from "@/lib/permissions";
import Breadcrumb from "@/components/layout/Breadcrumb";
import LessonForm from "@/components/board/LessonForm";
import { Badge } from "@/components/ui/badge";
import {
  CompanyChip,
  CopyUrlButton,
  NotFound,
  PageContainer,
  ReadOnlyBadge,
  basePath,
  boardPath,
  educationPath,
  lessonPath,
  rootLabel,
  roundPath,
  type Mode,
} from "./shared";

type RowProps = {
  href: string;
  order: number | string;
  title: string;
  description?: string;
  meta: React.ReactNode;
  action?: React.ReactNode;
};

function Row({ href, order, title, description, meta, action }: RowProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-5 bg-white rounded-2xl border border-border p-5 hover:shadow-md hover:border-foreground/20 transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center font-bold text-lg shrink-0">
        {order}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-base truncate">{title}</h2>
        {description && <p className="text-sm text-muted-foreground truncate">{description}</p>}
      </div>
      <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        {meta}
      </span>
      {action}
      <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}

function Header({
  mode,
  title,
  description,
  companyId,
  onCreate,
  createLabel,
}: {
  mode: Mode;
  title: string;
  description?: string;
  companyId: string;
  onCreate?: () => void;
  createLabel?: string;
}) {
  const company = useAppStore((s) => s.getCompany(companyId));
  return (
    <div className="mt-6 mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <CompanyChip company={company} />
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
          {mode === "client" && <ReadOnlyBadge />}
        </div>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {mode === "admin" && onCreate && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> {createLabel}
        </button>
      )}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-6 max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl text-muted-foreground">
      {children}
    </div>
  );
}

// 교육 → 회차 목록
export function RoundList({ mode, educationId }: { mode: Mode; educationId: string }) {
  const user = useAppStore((s) => s.getCurrentUser());
  const { getEducation, getRoundsByEducation, getLessonsByRound, addRound } = useAppStore();
  const education = getEducation(educationId);
  const rounds = getRoundsByEducation(educationId);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  if (!education || !canViewEducation(user, educationId)) return <NotFound label="교육" />;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rounds.filter((r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
    : rounds;

  return (
    <PageContainer>
      <Breadcrumb items={[{ label: rootLabel(mode), to: basePath(mode) }, { label: educationTitle(education.name) }]} />
      <Header
        mode={mode}
        title={educationTitle(education.name)}
        companyId={education.companyId}
        onCreate={() => setFormOpen(true)}
        createLabel="회차 만들기"
      />
      <SearchBox value={query} onChange={setQuery} placeholder="회차 검색 (제목, 설명)" />
      {filtered.length === 0 ? (
        <Empty>{q ? "검색 결과가 없어요." : "아직 만들어진 회차가 없어요."}</Empty>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Row
              key={r.id}
              href={roundPath(mode, educationId, r.id)}
              order={r.order}
              title={`${r.order}회차 · ${r.title}`}
              description={r.description}
              meta={
                <>
                  <Layers className="w-3.5 h-3.5" /> 차시 {getLessonsByRound(r.id).length}
                </>
              }
            />
          ))}
        </div>
      )}
      <LessonForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(data) => addRound(educationId, { title: data.title ?? "", description: data.description })}
        nextOrder={rounds.length + 1}
        unitLabel="회차"
      />
    </PageContainer>
  );
}

// 회차 → 차시 목록. 분반이 없는 차시는 바로 보드로, 있으면 분반 목록으로 이동.
export function LessonList({ mode, educationId, roundId }: { mode: Mode; educationId: string; roundId: string }) {
  const user = useAppStore((s) => s.getCurrentUser());
  const {
    getEducation,
    getRound,
    getLessonsByRound,
    getDivisionsByLesson,
    getBoardsByLesson,
    getCardCountByBoard,
    addLesson,
  } = useAppStore();
  const education = getEducation(educationId);
  const round = getRound(roundId);
  const lessons = getLessonsByRound(roundId);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  if (!education || !round || round.educationId !== educationId || !canViewEducation(user, educationId)) {
    return <NotFound label="회차" />;
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? lessons.filter((l) => l.description.toLowerCase().includes(q)) : lessons;

  return (
    <PageContainer>
      <Breadcrumb
        items={[
          { label: rootLabel(mode), to: basePath(mode) },
          { label: educationTitle(education.name), to: educationPath(mode, educationId) },
          { label: `${round.order}회차 · ${round.title}` },
        ]}
      />
      <Header
        mode={mode}
        title={`${round.order}회차 · ${round.title}`}
        description={round.description}
        companyId={education.companyId}
        onCreate={() => setFormOpen(true)}
        createLabel="차시 만들기"
      />
      <SearchBox value={query} onChange={setQuery} placeholder="차시 검색 (설명)" />
      {filtered.length === 0 ? (
        <Empty>{q ? "검색 결과가 없어요." : "아직 만들어진 차시가 없어요."}</Empty>
      ) : (
        <div className="space-y-3">
          {filtered.map((l) => {
            const divisions = getDivisionsByLesson(l.id);
            if (divisions.length > 0) {
              return (
                <Row
                  key={l.id}
                  href={lessonPath(mode, educationId, roundId, l.id)}
                  order={l.order}
                  title={`${l.order}차시`}
                  description={l.description}
                  meta={
                    <>
                      <Users className="w-3.5 h-3.5" /> 분반 {divisions.length}
                    </>
                  }
                />
              );
            }
            const board = getBoardsByLesson(l.id)[0];
            return (
              <Row
                key={l.id}
                href={board ? boardPath(board.id) : "#"}
                order={l.order}
                title={`${l.order}차시`}
                description={l.description}
                meta={
                  <>
                    <LayoutGrid className="w-3.5 h-3.5" /> 자료 {board ? getCardCountByBoard(board.id) : 0}
                  </>
                }
                action={mode === "admin" && board ? <CopyUrlButton boardId={board.id} /> : undefined}
              />
            );
          })}
        </div>
      )}
      <LessonForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(data) => addLesson(roundId, data)}
        nextOrder={lessons.length + 1}
        withTitle={false}
      />
    </PageContainer>
  );
}

// 차시 → 분반 목록. 각 분반이 하나의 보드.
export function DivisionList({
  mode,
  educationId,
  roundId,
  lessonId,
}: {
  mode: Mode;
  educationId: string;
  roundId: string;
  lessonId: string;
}) {
  const user = useAppStore((s) => s.getCurrentUser());
  const { getEducation, getRound, getLesson, getDivisionsByLesson, getBoardsByLesson, getCardCountByBoard } =
    useAppStore();
  const education = getEducation(educationId);
  const round = getRound(roundId);
  const lesson = getLesson(lessonId);

  if (
    !education ||
    !round ||
    !lesson ||
    round.educationId !== educationId ||
    lesson.roundId !== roundId ||
    !canViewEducation(user, educationId)
  ) {
    return <NotFound label="차시" />;
  }

  const divisions = getDivisionsByLesson(lessonId);
  const boards = getBoardsByLesson(lessonId);

  return (
    <PageContainer>
      <Breadcrumb
        items={[
          { label: rootLabel(mode), to: basePath(mode) },
          { label: educationTitle(education.name), to: educationPath(mode, educationId) },
          { label: `${round.order}회차 · ${round.title}`, to: roundPath(mode, educationId, roundId) },
          { label: `${lesson.order}차시` },
        ]}
      />
      <Header
        mode={mode}
        title={`${lesson.order}차시`}
        description={lesson.description}
        companyId={education.companyId}
      />
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">분반 {divisions.length}</Badge> 분반마다 별도 보드(URL)가 있어요.
      </div>
      <div className="space-y-3">
        {divisions.map((d) => {
          const board = boards.find((b) => b.divisionId === d.id);
          if (!board) return null;
          return (
            <Row
              key={d.id}
              href={boardPath(board.id)}
              order={d.order}
              title={d.name}
              meta={
                <>
                  <LayoutGrid className="w-3.5 h-3.5" /> 자료 {getCardCountByBoard(board.id)}
                </>
              }
              action={mode === "admin" ? <CopyUrlButton boardId={board.id} /> : undefined}
            />
          );
        })}
      </div>
    </PageContainer>
  );
}
