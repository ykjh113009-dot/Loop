import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dispatchPush } from "@/lib/push";

// Sends waiting phone notifications (e.g. event reminders). Called every few
// minutes by a scheduled job in Supabase, protected by CRON_SECRET.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const sent = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  if (!secret || sent.length !== wanted.length || !timingSafeEqual(sent, wanted)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  return NextResponse.json(await dispatchPush());
}
