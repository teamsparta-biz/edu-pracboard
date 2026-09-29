// 카드 첨부 파일 버킷. 비공개이며, 화면에는 서버에서 발급한 서명 URL로만 보여준다.
// 이미지 전용이던 시절의 이름을 유지한다 (버킷 이름은 바꿀 수 없다).
export const CARD_IMAGE_BUCKET = "card-images";

// Supabase 프로젝트의 업로드 한도와 같다. 버킷에도 같은 값이 설정돼 있다.
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export type AttachmentKind = "image" | "video" | "audio" | "file";

export function attachmentKind(type: string): AttachmentKind {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "file";
}

export function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// 실시간 반영 채널. 내용 없이 "바뀌었다"는 신호만 보내고, 받은 쪽이 서버에서 다시 읽는다.
export const boardChannel = (boardId: string) => `board:${boardId}`;
export const BOARD_CHANGED = "changed";
