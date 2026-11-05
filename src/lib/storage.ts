// 카드 첨부 파일 버킷. 비공개이며, 화면에는 서버에서 발급한 서명 URL로만 보여준다.
// 이미지 전용이던 시절의 이름을 유지한다 (버킷 이름은 바꿀 수 없다).
export const CARD_IMAGE_BUCKET = "card-images";

// Supabase 프로젝트의 업로드 한도와 같다. 버킷에도 같은 값이 설정돼 있다.
export const MAX_ATTACHMENT_BYTES = 200 * 1024 * 1024;

export type AttachmentKind = "image" | "video" | "audio" | "html" | "file";

// 브라우저가 그릴 수 있는 이미지만 그림으로 보여준다. 아이폰 사진(HEIC)·TIFF 등은 깨진 그림이 되므로 파일로 보여준다.
const RENDERABLE_IMAGES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/apng",
  "image/bmp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

export function attachmentKind(type: string): AttachmentKind {
  if (RENDERABLE_IMAGES.has(type)) return "image";
  if (type === "text/html") return "html";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "file";
}

// HTML 미리보기는 파일 내용을 받아 격리된 창에 그린다. 너무 큰 파일은 미리보기 없이 파일로만 보여준다.
export const MAX_HTML_PREVIEW_BYTES = 5 * 1024 * 1024;

export function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  const mb = bytes / 1024 / 1024;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
}

// 실시간 반영 채널. 내용 없이 "바뀌었다"는 신호만 보내고, 받은 쪽이 서버에서 다시 읽는다.
export const boardChannel = (boardId: string) => `board:${boardId}`;
export const BOARD_CHANGED = "changed";
