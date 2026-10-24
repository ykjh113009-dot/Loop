import { NextResponse, type NextRequest } from "next/server";
import { dispatchPush } from "@/lib/push";

// Sends waiting phone notifications (e.g. event reminders). Called every few
// minutes by a scheduled job in Supabase, protected by CRON_SECRET.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  return NextResponse.json(await dispatchPush());
}
