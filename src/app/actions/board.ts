"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_IMAGE_BUCKET, MAX_ATTACHMENT_BYTES } from "@/lib/storage";
import { notifyBoards, removeFiles } from "@/lib/board-events";
import { getSessionUser } from "@/lib/auth";

// 권한은 RLS가 판단한다. 여기서는 RLS가 거부하면 에러를 돌려줄 뿐이다.
// 바뀐 뒤에는 같은 보드를 보고 있는 사람들에게 실시간 신호를 보낸다(notifyBoards).

export type ActionResult = { error?: string };

const DENIED = "권한이 없거나 요청을 처리하지 못했어요.";

export async function addSection(boardId: string, name: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("sections")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("sections")
    .insert({ board_id: boardId, name, position: (last?.position ?? 0) + 1 });
  if (error) return { error: DENIED };
  return changed(boardId);
}

export async function renameSection(sectionId: string, name: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sections").update({ name }).eq("id", sectionId).select("board_id");
  if (error || !data?.length) return { error: DENIED };
  return changed(data[0].board_id);
}

export async function deleteSection(sectionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: files } = await supabase.from("cards").select("attachment_path").eq("section_id", sectionId);
  const { data, error } = await supabase.from("sections").delete().eq("id", sectionId).select("board_id");
  if (error || !data?.length) return { error: DENIED };
  await removeFiles(files?.map((c) => c.attachment_path));
  return changed(data[0].board_id);
}

// 첨부 파일은 브라우저에서 Storage로 바로 올린다. 서버 액션 본문 크기 제한(1MB)을 피하기 위함.
// 올릴 권한(can_post)을 확인한 뒤에만 업로드 URL을 발급한다.
export async function createUpload(boardId: string, fileName: string, size: number) {
  if (size > MAX_ATTACHMENT_BYTES) return { error: "파일은 50MB 이하만 올릴 수 있어요." };
  const user = await getSessionUser();
  if (!user) return { error: DENIED };
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_post", { bid: boardId });
  if (!allowed) return { error: DENIED };

  // 저장 경로는 영문·숫자만 쓴다. 원래 파일 이름은 카드에 따로 저장한다.
  // 경로에 올린 사람을 넣어, 카드에는 본인이 올린 파일만 붙일 수 있게 한다 (ownUpload).
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const path = `${uploadPrefix(boardId, user.id)}${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
  const { data, error } = await createAdminClient().storage.from(CARD_IMAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "파일을 올릴 준비를 하지 못했어요." };
  return { path: data.path, token: data.token };
}

export type AttachmentInput = { path: string; name: string; type: string; size: number };

export type CardInput = {
  title: string;
  content?: string;
  link?: string;
  // 수정할 때: undefined = 그대로 두기, null = 첨부 삭제
  attachment?: AttachmentInput | null;
};

const attachmentColumns = (a: AttachmentInput | null) => ({
  attachment_path: a?.path ?? null,
  attachment_name: a?.name ?? null,
  attachment_type: a?.type || (a ? "application/octet-stream" : null),
  attachment_size: a?.size ?? null,
});

const uploadPrefix = (boardId: string, userId: string) => `${boardId}/${userId}/`;

// 이 보드에 본인이 올린 파일만 받는다. 남의 파일 경로를 넣어 그 파일을 지우거나 가져가는 것을 막는다.
const ownUpload = (boardId: string, userId: string, a: AttachmentInput | null | undefined) =>
  !a || (a.path.startsWith(uploadPrefix(boardId, userId)) && !a.path.includes(".."));

export async function addCard(boardId: string, sectionId: string, input: CardInput): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user || !ownUpload(boardId, user.id, input.attachment)) return { error: DENIED };

  const supabase = await createClient();
  const { error } = await supabase.from("cards").insert({
    board_id: boardId,
    section_id: sectionId,
    title: input.title,
    content: input.content ?? "",
    link: input.link || null,
    ...attachmentColumns(input.attachment ?? null),
    author_id: user.id,
    author_name: user.name,
  });
  if (error) {
    await removeFiles([input.attachment?.path]);
    return { error: DENIED };
  }
  return changed(boardId);
}

// 작성자 본인 또는 보드 관리자(관리자·강사)만 수정할 수 있다 (RLS).
export async function updateCard(cardId: string, input: CardInput): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { error: DENIED };
  const supabase = await createClient();
  const { data: before } = await supabase.from("cards").select("board_id, attachment_path").eq("id", cardId).maybeSingle();
  if (!before || !ownUpload(before.board_id, user.id, input.attachment)) return { error: DENIED };

  const { data, error } = await supabase
    .from("cards")
    .update({
      title: input.title,
      content: input.content ?? "",
      link: input.link || null,
      ...(input.attachment !== undefined ? attachmentColumns(input.attachment) : {}),
    })
    .eq("id", cardId)
    .select("id");
  if (error || !data?.length) {
    await removeFiles([input.attachment?.path]);
    return { error: DENIED };
  }
  // 첨부를 바꾸거나 지웠으면 이전 파일을 지운다
  if (input.attachment !== undefined && before.attachment_path !== input.attachment?.path) {
    await removeFiles([before.attachment_path]);
  }
  return changed(before.board_id);
}

export async function deleteCard(cardId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cards").delete().eq("id", cardId).select("board_id, attachment_path");
  if (error || !data?.length) return { error: DENIED };
  await removeFiles(data.map((c) => c.attachment_path));
  return changed(data[0].board_id);
}

// 원래 파일 이름으로 내려받는 서명 URL. 카드를 볼 수 있는 사람(RLS)에게만 발급한다.
export async function getAttachmentDownloadUrl(cardId: string) {
  const supabase = await createClient();
  const { data: card } = await supabase
    .from("cards")
    .select("attachment_path, attachment_name")
    .eq("id", cardId)
    .maybeSingle();
  if (!card?.attachment_path) return { error: DENIED };
  const { data } = await createAdminClient()
    .storage.from(CARD_IMAGE_BUCKET)
    .createSignedUrl(card.attachment_path, 60, { download: card.attachment_name ?? true });
  return data ? { url: data.signedUrl } : { error: DENIED };
}

async function changed(boardId: string): Promise<ActionResult> {
  await notifyBoards([boardId]);
  refresh();
  return {};
}
