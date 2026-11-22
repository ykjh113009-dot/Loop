"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";

// Everything below is checked again by the database: who may do it, that the person is in the same school, and that it is
// written to the activity log. The buttons only ask.
const fail = (error: { message?: string; code?: string }): ActionResult => ({ error: error.code === "P0001" ? (error.message ?? "") : friendlyError(error) });
const kind = (fd: FormData) => String(fd.get("kind") ?? "");
const id = (fd: FormData) => String(fd.get("id") ?? "");

export async function hideContent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe("staff");
  const { error } = await (await createClient()).rpc("admin_hide_content", { p_kind: kind(fd), p_id: id(fd), p_reason: String(fd.get("reason") ?? "") });
  if (error) return fail(error);
  refresh();
  return { ok: true, message: "Hidden. You can restore it from Recently removed." };
}

export async function restoreContent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe("staff");
  const { error } = await (await createClient()).rpc("admin_restore_content", { p_kind: kind(fd), p_id: id(fd) });
  if (error) return fail(error);
  refresh();
  return { ok: true, message: "Restored." };
}

export async function editContent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe("admin");
  const { error } = await (await createClient()).rpc("admin_edit_content", { p_kind: kind(fd), p_id: id(fd), p_title: String(fd.get("title") ?? ""), p_detail: String(fd.get("detail") ?? "") });
  if (error) return fail(error);
  refresh();
  return { ok: true, message: "Saved." };
}

export async function closePoll(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe("admin");
  const { error } = await (await createClient()).rpc("admin_close_poll", { p_id: id(fd) });
  if (error) return fail(error);
  refresh();
  return { ok: true, message: "The poll is closed." };
}

export async function purgeContent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe("super");
  if (String(fd.get("confirm") ?? "").trim() !== "DELETE") return { error: "Type DELETE to confirm." };
  const { error } = await (await createClient()).rpc("admin_purge_content", { p_kind: kind(fd), p_id: id(fd), p_reason: String(fd.get("reason") ?? "") });
  if (error) return fail(error);
  refresh();
  return { ok: true, message: "Deleted for good." };
}

export type ConversationLine = { id: string; sender: string | null; body: string; created_at: string; reported: boolean };

// A Super Admin opens the few messages around ONE reported message, with a reason. The database records every opening.
export async function openReportedConversation(reportId: string, reason: string): Promise<{ error?: string; lines?: ConversationLine[] }> {
  await requireMe("super");
  const { data, error } = await (await createClient()).rpc("admin_review_reported_conversation", { p_report: reportId, p_reason: reason });
  if (error) return { error: error.code === "P0001" ? error.message : friendlyError(error) };
  return { lines: (data ?? []) as ConversationLine[] };
}
