"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Layers, LayoutGrid, Plus, Search, Users } from "lucide-react";
import { createLesson, createRound } from "@/app/actions/admin";
import { educationTitle } from "@/lib/education";
import type { Board, Company, Division, Education, Lesson, Round } from "@/lib/types";
import Breadcrumb from "@/components/layout/Breadcrumb";
import LessonForm from "@/components/board/LessonForm";
import { Badge } from "@/components/ui/badge";
import {
  CompanyChip,
  CopyUrlButton,
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
  company,
  onCreate,
  createLabel,
  error,
}: {
  mode: Mode;
  title: string;
  description?: string;
  company?: Company;
  onCreate?: () => void;
  createLabel?: string;
  error?: string;
}) {
  return (
    <div className="mt-6 mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <CompanyChip company={company} />
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
          {mode === "client" && <ReadOnlyBadge />}
        </div>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
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

// 관리자의 생성 요청. 실패하면 헤더 아래에 문구를 띄운다.
function useCreate() {
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  const run = (action: () => Promise<{ error?: string }>) =>
    startTransition(async () => setError((await action()).error));
  return { error, run };
}

// 교육 → 회차 목록
export function RoundList({
  mode,
  education,
  rounds,
  children,
}: {
  mode: Mode;
  education: Education;
  rounds: (Round & { lessonCount: number })[];
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const { error, run } = useCreate();

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
        company={education.company}
        onCreate={() => setFormOpen(true)}
        createLabel="회차 만들기"
        error={error}
      />
      {children}
      <SearchBox value={query} onChange={setQuery} placeholder="회차 검색 (제목, 설명)" />
      {filtered.length === 0 ? (
        <Empty>{q ? "검색 결과가 없어요." : "아직 만들어진 회차가 없어요."}</Empty>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Row
              key={r.id}
              href={roundPath(mode, education.id, r.id)}
              order={r.order}
              title={`${r.order}회차 · ${r.title}`}
              description={r.description}
              meta={
                <>
                  <Layers className="w-3.5 h-3.5" /> 차시 {r.lessonCount}
                </>
              }
            />
          ))}
        </div>
      )}
      <LessonForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(data) =>
          run(() => createRound(education.id, { title: data.title ?? "", description: data.description }))
        }
        nextOrder={rounds.length + 1}
        unitLabel="회차"
      />
    </PageContainer>
  );
}

// 회차 → 차시 목록. 분반이 없는 차시는 바로 보드로, 있으면 분반 목록으로 이동.
export function LessonList({
  mode,
  education,
  round,
  lessons,
}: {
  mode: Mode;
  education: Education;
  round: Round;
  lessons: (Lesson & { divisionCount: number; board?: Board })[];
}) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const { error, run } = useCreate();

  const q = query.trim().toLowerCase();
  const filtered = q ? lessons.filter((l) => l.description.toLowerCase().includes(q)) : lessons;

  return (
    <PageContainer>
      <Breadcrumb
        items={[
          { label: rootLabel(mode), to: basePath(mode) },
          { label: educationTitle(education.name), to: educationPath(mode, education.id) },
          { label: `${round.order}회차 · ${round.title}` },
        ]}
      />
      <Header
        mode={mode}
        title={`${round.order}회차 · ${round.title}`}
        description={round.description}
        company={education.company}
        onCreate={() => setFormOpen(true)}
        createLabel="차시 만들기"
        error={error}
      />
      <SearchBox value={query} onChange={setQuery} placeholder="차시 검색 (설명)" />
      {filtered.length === 0 ? (
        <Empty>{q ? "검색 결과가 없어요." : "아직 만들어진 차시가 없어요."}</Empty>
      ) : (
        <div className="space-y-3">
          {filtered.map((l) =>
            l.divisionCount > 0 ? (
              <Row
                key={l.id}
                href={lessonPath(mode, education.id, round.id, l.id)}
                order={l.order}
                title={`${l.order}차시`}
                description={l.description}
                meta={
                  <>
                    <Users className="w-3.5 h-3.5" /> 분반 {l.divisionCount}
                  </>
                }
              />
            ) : (
              <Row
                key={l.id}
                href={l.board ? boardPath(l.board.id) : "#"}
                order={l.order}
                title={`${l.order}차시`}
                description={l.description}
                meta={
                  <>
                    <LayoutGrid className="w-3.5 h-3.5" /> 자료 {l.board?.cardCount ?? 0}
                  </>
                }
                action={mode === "admin" && l.board ? <CopyUrlButton boardId={l.board.id} /> : undefined}
              />
            ),
          )}
        </div>
      )}
      <LessonForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(data) => run(() => createLesson(education.id, round.id, data))}
        nextOrder={lessons.length + 1}
        withTitle={false}
      />
    </PageContainer>
  );
}

// 차시 → 분반 목록. 각 분반이 하나의 보드.
export function DivisionList({
  mode,
  education,
  round,
  lesson,
  divisions,
}: {
  mode: Mode;
  education: Education;
  round: Round;
  lesson: Lesson;
  divisions: (Division & { board?: Board })[];
}) {
  return (
    <PageContainer>
      <Breadcrumb
        items={[
          { label: rootLabel(mode), to: basePath(mode) },
          { label: educationTitle(education.name), to: educationPath(mode, education.id) },
          { label: `${round.order}회차 · ${round.title}`, to: roundPath(mode, education.id, round.id) },
          { label: `${lesson.order}차시` },
        ]}
      />
      <Header mode={mode} title={`${lesson.order}차시`} description={lesson.description} company={education.company} />
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">분반 {divisions.length}</Badge> 분반마다 별도 보드(URL)가 있어요.
      </div>
      <div className="space-y-3">
        {divisions.map(
          (d) =>
            d.board && (
              <Row
                key={d.id}
                href={boardPath(d.board.id)}
                order={d.order}
                title={d.name}
                meta={
                  <>
                    <LayoutGrid className="w-3.5 h-3.5" /> 자료 {d.board.cardCount}
                  </>
                }
                action={mode === "admin" ? <CopyUrlButton boardId={d.board.id} /> : undefined}
              />
            ),
        )}
      </div>
    </PageContainer>
  );
}
