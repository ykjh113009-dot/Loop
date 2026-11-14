"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { fromLocalInput } from "@/lib/time";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// Calls a database function. The database checks who is allowed to do it, again, inside.
async function call(fn: string, args: Record<string, unknown>, message?: string): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn as "my_points", args as never);
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { ok: true, message };
}

// ---- Creating a challenge --------------------------------------------------------
export async function saveChallenge(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const starts = fromLocalInput(s(fd, "starts"));
  const ends = fromLocalInput(s(fd, "ends"));
  if (!starts || !ends) return { error: "Choose when the challenge starts and when it ends." };
  const prizes = [1, 2, 3, 4, 5].map((n) => Number(s(fd, `prize${n}`))).filter((n) => n > 0);
  const [attempts, rewards] = s(fd, "repeat").split(":").map(Number);
  const mode = s(fd, "reward_mode") === "ranked" ? "ranked" : "fixed";
  const body = {
    title: s(fd, "title"),
    description: s(fd, "description"),
    instructions: s(fd, "instructions"),
    rules: s(fd, "rules"),
    emoji: s(fd, "emoji"),
    category: s(fd, "category"),
    kind: s(fd, "kind"),
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    points: mode === "ranked" ? Number(s(fd, "participation_points") || 0) : Number(s(fd, "points") || 0),
    reward_mode: mode,
    prizes: prizes.map((points) => ({ points })),
    audience: s(fd, "audience"),
    audience_grade: s(fd, "audience_grade"),
    audience_section: s(fd, "audience_section"),
    proof_kinds: fd.getAll("proof").map(String),
    questions: s(fd, "questions").split("\n").map((q) => q.trim()).filter(Boolean),
    max_participants: s(fd, "max_participants"),
    attempts_per_student: attempts || 1,
    rewards_per_student: rewards || 1,
    cover_path: s(fd, "image_path") || s(fd, "keep_cover"),
    safety_confirmed: fd.get("safe") === "on",
  };
  await requireMe();
  const supabase = await createClient();
  const send = s(fd, "intent") === "send";
  const { data, error } = await supabase.rpc("save_challenge", { p_id: (s(fd, "id") || null) as string, p: body, p_submit: send });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  redirect(`/challenges/${data}`);
}

export async function withdrawChallenge(_: ActionResult, fd: FormData) {
  return call("withdraw_challenge", { p_id: s(fd, "id") }, "Taken back. You can edit it again.");
}
export async function deleteChallengeDraft(fd: FormData) {
  await call("delete_challenge_draft", { p_id: s(fd, "id") });
  redirect("/challenges?tab=created");
}
export async function cancelChallenge(_: ActionResult, fd: FormData) {
  return call("cancel_challenge", { p_challenge: s(fd, "id"), p_note: s(fd, "note") }, "The challenge was cancelled.");
}
export async function reviewChallengeIdea(_: ActionResult, fd: FormData) {
  const approve = fd.get("decision") === "approve";
  return call("review_challenge_idea", { p_challenge: s(fd, "id"), p_approve: approve, p_note: s(fd, "note"), p_safe: fd.get("safe") === "on" },
    approve ? "Approved. Students can join it now." : "Sent back to the creator.");
}

// ---- Taking part -----------------------------------------------------------------
export async function joinChallenge(_: ActionResult, fd: FormData) {
  return call("join_challenge", { p_challenge: s(fd, "id") }, "You joined! Now do the challenge and send your proof.");
}
export async function submitEntry(_: ActionResult, fd: FormData) {
  return call("submit_challenge", {
    p_challenge: s(fd, "id"),
    p_note: s(fd, "note"),
    p_photo: s(fd, "photo_path"),
    p_video: s(fd, "video_path"),
    p_answers: fd.getAll("answer").map((a) => String(a)),
  }, "Sent! You will see the result here.");
}
export async function withdrawEntry(_: ActionResult, fd: FormData) {
  return call("withdraw_challenge_submission", { p_id: s(fd, "id") }, "Taken back.");
}

// ---- Checking proof --------------------------------------------------------------
export async function claimEntry(_: ActionResult, fd: FormData) {
  return call("claim_challenge_submission", { p_id: s(fd, "id") });
}
export async function reviewEntry(_: ActionResult, fd: FormData) {
  const approve = fd.get("decision") === "approve";
  return call("review_challenge_submission", { p_submission: s(fd, "id"), p_approve: approve, p_note: s(fd, "note") },
    approve ? "Approved." : "Rejected. The student can see your note.");
}
export async function rankChallenge(_: ActionResult, fd: FormData) {
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => s(fd, `place${n}`)).filter(Boolean);
  return call("rank_challenge", { p_challenge: s(fd, "id"), p_order: order }, "Winners chosen and points paid.");
}
