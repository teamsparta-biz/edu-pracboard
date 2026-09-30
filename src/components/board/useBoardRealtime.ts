"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOARD_CHANGED, boardChannel } from "@/lib/storage";

// 같은 보드에서 누군가 카드·섹션을 바꾸면 서버가 신호를 보낸다(notifyBoards).
// 신호를 받으면 서버 컴포넌트를 다시 읽는다. 데이터는 신호로 오지 않고 항상 RLS를 거쳐 읽힌다.
//
// 수업 중에는 여러 명이 연달아 올려 신호가 몰린다. 보드를 보는 모두가 같은 순간에 서버를 부르지 않도록
//   - 짧은 사이에 온 신호는 한 번의 다시 읽기로 합치고
//   - 사람마다 다시 읽는 시점을 조금씩 흩고
//   - 보이지 않는 탭은 다시 보일 때까지 미룬다.
const SETTLE_MS = 400;
const JITTER_MS = 800;

export function useBoardRealtime(boardId: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pendingWhileHidden = false;

    const refreshSoon = () => {
      if (document.visibilityState === "hidden") {
        pendingWhileHidden = true;
        return;
      }
      // 이미 예약돼 있으면 그 한 번에 합친다. 다시 미루지 않으므로 신호가 계속 와도 1초 남짓마다는 반영된다.
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        router.refresh();
      }, SETTLE_MS + Math.random() * JITTER_MS);
    };

    let connectedOnce = false;
    const channel = supabase
      .channel(boardChannel(boardId))
      .on("broadcast", { event: BOARD_CHANGED }, refreshSoon)
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // 연결이 끊겼다 다시 붙으면 그 사이 바뀐 내용을 놓쳤을 수 있다
        if (connectedOnce) refreshSoon();
        connectedOnce = true;
      });

    // 숨어 있는 동안 신호가 왔거나, 오래 비웠다 돌아오면(놓친 신호·서명 URL 만료 대비) 다시 읽는다
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (pendingWhileHidden || Date.now() - hiddenAt > 10 * 60 * 1000) {
        pendingWhileHidden = false;
        refreshSoon();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [boardId, router]);
}
