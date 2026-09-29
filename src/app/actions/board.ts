"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_IMAGE_BUCKET } from "@/lib/storage";
import { getSessionUser } from "@/lib/auth";

// 권한은 RLS가 판단한다. 여기서는 RLS가 거부하면 에러를 돌려줄 뿐이다.

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
  refresh();
  return {};
}

export async function deleteSection(sectionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: images } = await supabase.from("cards").select("image").eq("section_id", sectionId);
  const { data, error } = await supabase.from("sections").delete().eq("id", sectionId).select("id");
  if (error || !data?.length) return { error: DENIED };
  await removeImages(images?.map((c) => c.image));
  refresh();
  return {};
}

// 이미지는 브라우저에서 Storage로 바로 올린다. 서버 액션 본문 크기 제한(1MB)을 피하기 위함.
// 올릴 권한(can_post)을 확인한 뒤에만 업로드 URL을 발급한다.
export async function createImageUpload(boardId: string, fileName: string) {
  const user = await getSessionUser();
  if (!user) return { error: DENIED };
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_post", { bid: boardId });
  if (!allowed) return { error: DENIED };

  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const path = `${boardId}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
  const { data, error } = await createAdminClient().storage.from(CARD_IMAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "이미지를 올릴 준비를 하지 못했어요." };
  return { path: data.path, token: data.token };
}

type CardInput = {
  title: string;
  content?: string;
  link?: string;
  imagePath?: string;
};

export async function addCard(boardId: string, sectionId: string, input: CardInput): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { error: DENIED };
  // 다른 보드용으로 발급된 이미지 경로는 받지 않는다
  if (input.imagePath && !input.imagePath.startsWith(`${boardId}/`)) return { error: DENIED };

  const supabase = await createClient();
  const { error } = await supabase.from("cards").insert({
    board_id: boardId,
    section_id: sectionId,
    title: input.title,
    content: input.content ?? "",
    link: input.link || null,
    image: input.imagePath || null,
    author_id: user.id,
    author_name: user.name,
  });
  if (error) {
    await removeImages([input.imagePath]);
    return { error: DENIED };
  }
  refresh();
  return {};
}

export async function deleteCard(cardId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cards").delete().eq("id", cardId).select("image");
  if (error || !data?.length) return { error: DENIED };
  await removeImages(data.map((c) => c.image));
  refresh();
  return {};
}

async function removeImages(paths: (string | null | undefined)[] | undefined) {
  const list = (paths ?? []).filter(Boolean) as string[];
  if (list.length) await createAdminClient().storage.from(CARD_IMAGE_BUCKET).remove(list);
}
