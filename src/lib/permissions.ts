import type { Board, Card, Role, User } from "@/store/types";

// 권한 규칙은 docs/PLAN.md 2절 기준. 세부 정책은 미정이라 우선 단순하게 둔다.

export const ADMIN_DOMAIN = "teamsparta.co";

export const roleLabel: Record<Role, string> = {
  admin: "관리자",
  client: "고객사 담당자",
  instructor: "강사",
  student: "교육생",
};

export function homePath(user: User) {
  if (user.role === "admin") return "/admin";
  if (user.role === "client") return "/client";
  return `/b/${user.boardId}`;
}

export function canViewEducation(user: User | undefined, educationId: string) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "client") return !!user.educationIds?.includes(educationId);
  return false;
}

export function canViewBoard(user: User | undefined, board: Board, educationId: string) {
  if (!user) return false;
  if (user.role === "admin" || user.role === "client") return canViewEducation(user, educationId);
  return user.boardId === board.id;
}

// 섹션 관리, 모든 카드 삭제
export function canManageBoard(user: User | undefined, board: Board) {
  if (!user) return false;
  return user.role === "admin" || (user.role === "instructor" && user.boardId === board.id);
}

export function canPost(user: User | undefined, board: Board) {
  if (!user) return false;
  if (canManageBoard(user, board)) return true;
  return user.role === "student" && user.boardId === board.id;
}

// 교육생은 우선 본인 카드만 삭제 가능 (PLAN.md 7절 미정 사항)
export function canDeleteCard(user: User | undefined, board: Board, card: Card) {
  if (canManageBoard(user, board)) return true;
  return !!user && canPost(user, board) && card.authorId === user.id;
}
