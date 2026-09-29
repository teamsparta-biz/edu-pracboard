"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOARD_CHANGED, boardChannel } from "@/lib/storage";

// 같은 보드에서 누군가 카드·섹션을 바꾸면 서버가 신호를 보낸다(notifyBoards).
// 신호를 받으면 서버 컴포넌트를 다시 읽는다. 데이터는 신호로 오지 않고 항상 RLS를 거쳐 읽힌다.
export function useBoardRealtime(boardId: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // 여러 사람이 동시에 올리면 신호가 몰리므로 짧게 모아서 한 번만 다시 읽는다
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    let connectedOnce = false;
    const channel = supabase
      .channel(boardChannel(boardId))
      .on("broadcast", { event: BOARD_CHANGED }, scheduleRefresh)
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // 연결이 끊겼다 다시 붙으면 그 사이 바뀐 내용을 놓쳤을 수 있다
        if (connectedOnce) scheduleRefresh();
        connectedOnce = true;
      });

    // 탭을 오래 비웠다 돌아오면 서명 URL 만료·놓친 신호에 대비해 다시 읽는다
    const onVisible = () => document.visibilityState === "visible" && scheduleRefresh();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [boardId, router]);
}
