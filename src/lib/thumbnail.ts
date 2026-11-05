import { attachmentKind } from "./storage";

// 보드 목록에 쓸 작은 이미지를 브라우저에서 만든다 (PLAN.md 5.1절).
// 가로·세로 800px 이하로 줄인 WebP(사파리 예전 버전은 JPEG). 이미 작은 이미지와 움직이는 GIF·SVG는 만들지 않는다.
// 만들지 못하면 null — 보드 목록은 원본을 보여준다.
const MAX_SIDE = 800;
const SKIP_BELOW_BYTES = 300 * 1024;

export async function makeThumbnail(file: File): Promise<Blob | null> {
  if (attachmentKind(file.type) !== "image" || file.type === "image/gif" || file.type === "image/svg+xml") return null;
  if (file.size <= SKIP_BELOW_BYTES) return null;
  try {
    // 휴대폰 사진의 회전 정보(EXIF)를 반영해 그린다
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.8));
    const webp = await encode("image/webp");
    const blob = webp?.type === "image/webp" ? webp : await encode("image/jpeg");
    return blob && blob.size < file.size ? blob : null;
  } catch {
    return null;
  }
}
