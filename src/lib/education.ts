import type { Division, EducationBoard, Lesson, Round } from "@/lib/types";

// axhub 교육명 앞의 "[기업명]" 또는 "[기업명] - "를 뗀다. 기업명은 따로 보여준다. 형식이 다르면 원본 그대로.
export function educationTitle(name: string) {
  return name.replace(/^\s*\[[^\]]*\]\s*(-\s*)?/, "") || name;
}

// axhub 회차는 제목 없이 번호만 있다. 직접 만든 회차는 제목을 함께 보여준다.
export function roundLabel(round: Pick<Round, "order" | "title">) {
  return round.title ? `${round.order}회차 · ${round.title}` : `${round.order}회차`;
}

// 보드가 교육 안에서 어디에 있는지. 차시 보드는 "1회차 · 2차시 · A반", 교육 보드는 보드 이름.
export function boardPlace(ctx: {
  round?: Pick<Round, "order" | "title">;
  lesson?: Pick<Lesson, "order">;
  division?: Pick<Division, "name">;
  educationBoard?: Pick<EducationBoard, "name">;
}) {
  if (ctx.educationBoard || !ctx.round || !ctx.lesson) return ctx.educationBoard?.name ?? "보드";
  return `${roundLabel(ctx.round)} · ${ctx.lesson.order}차시${ctx.division ? ` · ${ctx.division.name}` : ""}`;
}

// axhub 교육 상태 (setup → operation → tax_invoice → closed, 중간에 멈추면 stopped)
export function educationStatusLabel(status?: string | null) {
  switch (status) {
    case "setup":
      return "준비 중";
    case "operation":
      return "진행 중";
    case "tax_invoice":
    case "closed":
      return "종료";
    case "stopped":
      return "중단";
    default:
      return null;
  }
}

// 관리자 첫 화면의 탭 구분. 중단된 교육은 종료에, 상태가 없는 직접 만든 교육은 교육 중에 둔다.
export type EducationPhase = "setup" | "operation" | "ended";

export const EDUCATION_PHASES: { key: EducationPhase; label: string }[] = [
  { key: "setup", label: "교육 준비" },
  { key: "operation", label: "교육 중" },
  { key: "ended", label: "교육 종료" },
];

export function educationPhase(status?: string | null): EducationPhase {
  switch (status) {
    case "setup":
      return "setup";
    case "tax_invoice":
    case "closed":
    case "stopped":
      return "ended";
    default:
      return "operation";
  }
}
