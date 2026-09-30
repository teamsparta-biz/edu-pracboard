"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { runAxhubSync } from "@/lib/axhub/sync";

// 관리자 화면의 "지금 동기화" 버튼
export async function syncNow(): Promise<{ error?: string; message?: string }> {
  await requireAdmin();
  try {
    const s = await runAxhubSync("manual");
    refresh();
    if (s.skipped) return { message: s.skipped };
    return { message: `교육 ${s.courses}개 · 보드 ${s.boards}개 동기화 (새 보드 ${s.created.boards}개)` };
  } catch (e) {
    refresh();
    return { error: `동기화하지 못했어요: ${e instanceof Error ? e.message : String(e)}` };
  }
}
