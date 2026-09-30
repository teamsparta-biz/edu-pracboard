import type { Round } from "@/lib/types";

// axhub 교육명 앞의 "[기업명]" 또는 "[기업명] - "를 뗀다. 기업명은 따로 보여준다. 형식이 다르면 원본 그대로.
export function educationTitle(name: string) {
  return name.replace(/^\s*\[[^\]]*\]\s*(-\s*)?/, "") || name;
}

// axhub 회차는 제목 없이 번호만 있다. 직접 만든 회차는 제목을 함께 보여준다.
export function roundLabel(round: Pick<Round, "order" | "title">) {
  return round.title ? `${round.order}회차 · ${round.title}` : `${round.order}회차`;
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
