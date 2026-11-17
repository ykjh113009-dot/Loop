"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function rpc(fn: string, args: Record<string, unknown>, message?: string): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn as "my_points", args as never);
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message };
}

export async function pinBadges(codes: string[]) {
  return rpc("set_pinned_badges", { p_codes: codes }, "Saved.");
}
export async function adjustPoints(_: ActionResult, fd: FormData) {
  return rpc("admin_adjust_points", { p_profile: s(fd, "profile"), p_points: Number(s(fd, "points")), p_reason: s(fd, "reason") }, "Done. It is in the history.");
}
export async function reversePoints(_: ActionResult, fd: FormData) {
  return rpc("admin_reverse_entry", { p_entry: Number(s(fd, "entry")), p_reason: s(fd, "reason") }, "Reversed. The original entry is kept.");
}
export async function setAchievement(_: ActionResult, fd: FormData) {
  return rpc("admin_set_achievement", { p_code: s(fd, "code"), p_points: Number(s(fd, "points")), p_active: fd.get("active") === "on" }, "Saved.");
}
