"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_IMAGE_BUCKET, MAX_ATTACHMENT_BYTES, formatBytes } from "@/lib/storage";
import { notifyBoards, removeFiles } from "@/lib/board-events";
import { getSessionUser } from "@/lib/auth";
import { findLinkImage } from "@/lib/link-preview";
import { COMMENT_MAX_LENGTH } from "@/lib/permissions";

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
  const { data: files } = await supabase.from("cards").select("attachment_path, attachment_thumb_path").eq("section_id", sectionId);
  const { data, error } = await supabase.from("sections").delete().eq("id", sectionId).select("board_id");
  if (error || !data?.length) return { error: DENIED };
  await removeFiles(files?.flatMap((c) => [c.attachment_path, c.attachment_thumb_path]));
  return changed(data[0].board_id);
}

// 첨부 파일은 브라우저에서 Storage로 바로 올린다. 서버 액션 본문 크기 제한(1MB)을 피하기 위함.
// 올릴 권한(can_post)을 확인한 뒤에만 업로드 URL을 발급한다.
export async function createUpload(boardId: string, fileName: string, size: number) {
  if (size > MAX_ATTACHMENT_BYTES) return { error: `파일은 ${formatBytes(MAX_ATTACHMENT_BYTES)} 이하만 올릴 수 있어요.` };
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

// thumbPath: 보드 목록에 보여줄 작은 이미지 (makeThumbnail). 없으면 원본을 보여준다.
// 카드를 만들지 못해 쓸모없어진 업로드를 지운다. 본인이 이 보드에 올린 파일만.
export async function deleteUpload(boardId: string, path: string) {
  const user = await getSessionUser();
  if (user && ownPath(boardId, user.id, path)) await removeFiles([path]);
}

export type AttachmentInput = { path: string; name: string; type: string; size: number; thumbPath?: string };

export type CardInput = {
  title: string;
  content?: string;
  link?: string;
  // 수정할 때: undefined = 그대로 두기, null = 첨부 삭제
  attachment?: AttachmentInput | null;
};

const attachmentColumns = (a: AttachmentInput | null) => ({
  attachment_path: a?.path ?? null,
  // 맥에서 올린 한글 이름은 자모가 분리된 형태(NFD)라 윈도우에서 풀어져 보인다. 합친 형태(NFC)로 저장한다.
  attachment_name: a?.name.normalize("NFC") ?? null,
  attachment_type: a?.type || (a ? "application/octet-stream" : null),
  attachment_size: a?.size ?? null,
  attachment_thumb_path: a?.thumbPath ?? null,
});

// 링크는 웹 주소만 받는다. "github.com/x"처럼 https 없이 넣으면 붙인다 (그대로 두면 보드 안의 상대 주소가 된다).
// javascript: 같은 다른 형식이나 주소가 아닌 글은 저장하지 않는다.
function normalizeLink(link: string | undefined) {
  const value = link?.trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") ? withScheme : null;
  } catch {
    return null;
  }
}

const uploadPrefix = (boardId: string, userId: string) => `${boardId}/${userId}/`;

// 이 보드에 본인이 올린 파일만 받는다. 남의 파일 경로를 넣어 그 파일을 지우거나 가져가는 것을 막는다.
const ownPath = (boardId: string, userId: string, path: string) => path.startsWith(uploadPrefix(boardId, userId)) && !path.includes("..");
const ownUpload = (boardId: string, userId: string, a: AttachmentInput | null | undefined) =>
  !a || (ownPath(boardId, userId, a.path) && (!a.thumbPath || ownPath(boardId, userId, a.thumbPath)));

export async function addCard(boardId: string, sectionId: string, input: CardInput): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user || !ownUpload(boardId, user.id, input.attachment)) return { error: DENIED };

  const supabase = await createClient();
  const link = normalizeLink(input.link);
  const { data: created, error } = await supabase.from("cards").insert({
    board_id: boardId,
    section_id: sectionId,
    title: input.title,
    content: input.content ?? "",
    link,
    ...attachmentColumns(input.attachment ?? null),
    author_id: user.id,
    author_name: user.name,
  }).select("id").single();
  if (error || !created) {
    await removeFiles([input.attachment?.path, input.attachment?.thumbPath]);
    return { error: DENIED };
  }
  fillLinkImage(created.id, boardId, link);
  return changed(boardId);
}

// 작성자 본인 또는 보드 관리자(관리자·강사)만 수정할 수 있다 (RLS).
export async function updateCard(cardId: string, input: CardInput): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { error: DENIED };
  const supabase = await createClient();
  const { data: before } = await supabase.from("cards").select("board_id, attachment_path, attachment_thumb_path, link").eq("id", cardId).maybeSingle();
  if (!before || !ownUpload(before.board_id, user.id, input.attachment)) return { error: DENIED };

  const link = normalizeLink(input.link);
  const linkChanged = link !== before.link;
  const { data, error } = await supabase
    .from("cards")
    .update({
      title: input.title,
      content: input.content ?? "",
      link,
      ...(linkChanged ? { link_image: null } : {}),
      ...(input.attachment !== undefined ? attachmentColumns(input.attachment) : {}),
    })
    .eq("id", cardId)
    .select("id");
  if (error || !data?.length) {
    await removeFiles([input.attachment?.path, input.attachment?.thumbPath]);
    return { error: DENIED };
  }
  // 첨부를 바꾸거나 지웠으면 이전 파일을 지운다
  if (input.attachment !== undefined && before.attachment_path !== input.attachment?.path) {
    await removeFiles([before.attachment_path, before.attachment_thumb_path]);
  }
  if (linkChanged) fillLinkImage(cardId, before.board_id, link);
  return changed(before.board_id);
}

export async function deleteCard(cardId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cards").delete().eq("id", cardId).select("board_id, attachment_path, attachment_thumb_path");
  if (error || !data?.length) return { error: DENIED };
  await removeFiles(data.flatMap((c) => [c.attachment_path, c.attachment_thumb_path]));
  return changed(data[0].board_id);
}

// 여러 카드를 한 번에 지운다 (관리자·강사의 다중 선택). 지울 수 없는 카드는 RLS가 걸러낸다.
export async function deleteCards(cardIds: string[]): Promise<ActionResult> {
  if (!cardIds.length) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.from("cards").delete().in("id", cardIds).select("board_id, attachment_path, attachment_thumb_path");
  if (error || !data?.length) return { error: DENIED };
  await removeFiles(data.flatMap((c) => [c.attachment_path, c.attachment_thumb_path]));
  await notifyBoards([...new Set(data.map((c) => c.board_id))]);
  refresh();
  return data.length < cardIds.length ? { error: `${cardIds.length - data.length}개는 지우지 못했어요.` } : {};
}

// 카드를 상단에 고정하거나 고정을 푼다. 그 보드의 관리자·강사만 바꿀 수 있다 (DB 트리거가 확인하고, 아니면 그대로 둔다).
// 고정하면 섹션의 고정 카드 맨 뒤에 붙으므로, 넘겨준 순서대로 하나씩 바꾼다.
export async function setCardsPinned(cardIds: string[], pinned: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const boards = new Set<string>();
  let failed = 0;
  for (const id of cardIds) {
    const { data } = await supabase.from("cards").update({ pinned }).eq("id", id).select("board_id, pinned");
    if (data?.[0]?.pinned === pinned) boards.add(data[0].board_id);
    else failed++;
  }
  if (boards.size) {
    await notifyBoards([...boards]);
    refresh();
  }
  if (failed === cardIds.length) return { error: DENIED };
  return failed ? { error: `${failed}개는 바꾸지 못했어요.` } : {};
}

// 고정 카드(관리자·강사 카드)의 순서를 ids 순서로 바꾼다. 관리자·강사만 할 수 있다 (DB 함수가 확인).
export async function reorderPinnedCards(sectionId: string, ids: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: boardId, error } = await supabase.rpc("reorder_pinned_cards", { sid: sectionId, ids });
  if (error || !boardId) return { error: DENIED };
  return changed(boardId as string);
}

// 하트를 누르거나 취소한다. 누를 수 있는 사람은 카드를 올릴 수 있는 사람과 같다 (RLS).
export async function toggleLike(cardId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { error: DENIED };
  const supabase = await createClient();
  const { data: card } = await supabase.from("cards").select("board_id").eq("id", cardId).maybeSingle();
  if (!card) return { error: DENIED };

  const { data: removed, error } = await supabase
    .from("card_likes")
    .delete()
    .eq("card_id", cardId)
    .eq("user_id", user.id)
    .select("card_id");
  if (error) return { error: DENIED };
  if (!removed?.length) {
    const { error: insertError } = await supabase
      .from("card_likes")
      .insert({ card_id: cardId, board_id: card.board_id, user_id: user.id });
    if (insertError) return { error: DENIED };
  }
  return changed(card.board_id);
}

export async function addComment(cardId: string, content: string): Promise<ActionResult> {
  const text = content.trim();
  if (!text) return { error: "댓글 내용을 입력해 주세요." };
  if (text.length > COMMENT_MAX_LENGTH) return { error: `댓글은 ${COMMENT_MAX_LENGTH}자까지 쓸 수 있어요.` };
  const user = await getSessionUser();
  if (!user) return { error: DENIED };
  const supabase = await createClient();
  const { data: card } = await supabase.from("cards").select("board_id").eq("id", cardId).maybeSingle();
  if (!card) return { error: DENIED };
  const { error } = await supabase.from("card_comments").insert({
    card_id: cardId,
    board_id: card.board_id,
    content: text,
    author_id: user.id,
    author_name: user.name,
  });
  if (error) return { error: DENIED };
  return changed(card.board_id);
}

// 작성자 본인 또는 보드 관리자(관리자·강사)만 지울 수 있다 (RLS).
export async function deleteComment(commentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("card_comments").delete().eq("id", commentId).select("board_id");
  if (error || !data?.length) return { error: DENIED };
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
  const { data } = await createAdminClient().storage.from(CARD_IMAGE_BUCKET).createSignedUrl(card.attachment_path, 60);
  if (!data) return { error: DENIED };
  // supabase-js의 download 옵션은 이름을 두 번 인코딩해서, 한글·공백·괄호가 든 이름이 "%EC%8B%A4..."로 저장된다
  // (storage-js 2.112: URLSearchParams로 인코딩한 뒤 주소 전체를 encodeURI로 한 번 더 감싼다). 그래서 직접 한 번만 인코딩해 붙인다.
  const name = (card.attachment_name ?? "").normalize("NFC");
  return { url: `${data.signedUrl}&download=${encodeURIComponent(name)}` };
}

// 링크 미리보기 이미지는 응답을 보낸 뒤에 찾아 넣는다. 저장이 링크 사이트 응답을 기다리지 않게 하기 위함.
// 그 사이 링크가 또 바뀌었으면 넣지 않는다. 카드 권한은 저장할 때 이미 RLS로 확인했다.
function fillLinkImage(cardId: string, boardId: string, link: string | null) {
  if (!link) return;
  after(async () => {
    const image = await findLinkImage(link);
    if (!image) return;
    const { data } = await createAdminClient()
      .from("cards")
      .update({ link_image: image })
      .eq("id", cardId)
      .eq("link", link)
      .select("id");
    if (data?.length) await notifyBoards([boardId]);
  });
}

async function changed(boardId: string): Promise<ActionResult> {
  await notifyBoards([boardId]);
  refresh();
  return {};
}
