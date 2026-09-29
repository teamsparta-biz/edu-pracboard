import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOARD_CHANGED, CARD_IMAGE_BUCKET, boardChannel } from "@/lib/storage";

// 서버 액션에서만 쓰는 service role 작업. "use server" 파일에 두면 브라우저에서 호출할 수 있게 되므로 따로 둔다.

// 같은 보드를 보고 있는 화면에 "바뀌었다"는 신호만 보낸다. 내용은 보내지 않는다.
export async function notifyBoards(boardIds: string[]) {
  const admin = createAdminClient();
  await Promise.all(
    [...new Set(boardIds)].map(async (id) => {
      try {
        await admin.channel(boardChannel(id)).httpSend(BOARD_CHANGED, {});
      } catch {
        // 실시간 신호가 실패해도 저장은 끝났다. 다른 사람은 새로고침하면 보인다.
      }
    }),
  );
}

export async function removeFiles(paths: (string | null | undefined)[] | undefined) {
  const list = (paths ?? []).filter(Boolean) as string[];
  if (list.length) await createAdminClient().storage.from(CARD_IMAGE_BUCKET).remove(list);
}
