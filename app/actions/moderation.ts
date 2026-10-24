"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

async function run(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  await requireMe("staff");
  const supabase = await createClient();
  // The database checks the caller's role again inside each of these.
  const { error } = await supabase.rpc(fn as "review_club", args as never);
  if (error) return { error: friendlyError(error) };
  refresh();
  after(dispatchPush);
  return { ok: true };
}

export async function moderateReport(_: ActionResult, formData: FormData) {
  return run("moderate_report", {
    p_report: String(formData.get("reportId")),
    p_action: String(formData.get("action")),
    p_note: String(formData.get("note") ?? ""),
  });
}

export async function suspendStudent(_: ActionResult, formData: FormData) {
  const days = String(formData.get("days"));
  return run("suspend_user", {
    p_user: String(formData.get("profileId")),
    p_days: days === "permanent" ? null : Number(days),
    p_reason: String(formData.get("reason") ?? ""),
  });
}

export async function reviewClub(_: ActionResult, formData: FormData) {
  return run("review_club", {
    p_club: String(formData.get("clubId")),
    p_approve: formData.get("decision") === "approve",
    p_note: String(formData.get("note") ?? ""),
  });
}

export async function reviewEvent(_: ActionResult, formData: FormData) {
  return run("review_event", {
    p_event: String(formData.get("eventId")),
    p_approve: formData.get("decision") === "approve",
    p_note: String(formData.get("note") ?? ""),
  });
}

export async function reviewChallenge(_: ActionResult, formData: FormData) {
  return run("review_challenge_submission", {
    p_submission: String(formData.get("id")),
    p_approve: formData.get("decision") === "approve",
    p_note: String(formData.get("note") ?? ""),
  });
}

export async function reviewHours(_: ActionResult, formData: FormData) {
  return run("review_volunteer", {
    p_entry: String(formData.get("id")),
    p_approve: formData.get("decision") === "approve",
    p_note: String(formData.get("note") ?? ""),
  });
}
