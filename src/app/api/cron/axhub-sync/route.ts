import { NextResponse, type NextRequest } from "next/server";
import { runAxhubSync } from "@/lib/axhub/sync";

// Vercel Cron이 1시간마다 부른다 (vercel.json). Vercel이 CRON_SECRET을 Bearer 토큰으로 보낸다.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runAxhubSync("cron"));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
