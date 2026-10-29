import type { BoardRole, Card, Comment } from "@/lib/types";

// 화면 표시용 권한 규칙. 실제 권한은 DB의 RLS(supabase/migrations)가 강제하고,
// 여기 규칙은 버튼을 보여줄지 정하는 데만 쓴다. 두 곳의 규칙을 같이 고쳐야 한다.

export const roleLabel: Record<BoardRole, string> = {
  admin: "관리자",
  viewer: "교육 담당자",
  instructor: "강사",
  student: "교육생",
};

// 섹션 관리, 모든 카드 삭제
export const canManageBoard = (role: BoardRole) => role === "admin" || role === "instructor";

export const canPost = (role: BoardRole) => role !== "viewer";

// 교육생은 본인 카드만 수정·삭제 가능 (PLAN.md 7절 미정 사항)
export const canEditCard = (role: BoardRole, userId: string, card: Card) =>
  canManageBoard(role) || (canPost(role) && card.authorId === userId);

// 하트·댓글은 카드를 올릴 수 있는 사람만 남긴다. 교육 담당자는 보기만 한다.
export const canReact = canPost;

// 댓글은 작성자 본인과 관리자·강사가 지운다
export const canDeleteComment = (role: BoardRole, userId: string, comment: Comment) =>
  canManageBoard(role) || comment.authorId === userId;

export const COMMENT_MAX_LENGTH = 1000;
