"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { fromLocalInput } from "@/lib/time";
import { friendlyError, type ActionResult } from "@/lib/errors";

export async function submitChallenge(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "Tell us what you did." };
  const supabase = await createClient();
  const { error } = await supabase.from("challenge_submissions").insert({
    challenge_id: String(formData.get("challengeId")),
    profile_id: me.id,
    school_id: me.school_id,
    note: note.slice(0, 1000),
    image_path: String(formData.get("image_path") ?? "") || null,
  });
  if (error?.code === "23505") return { error: "You already sent this challenge." };
  if (error) return { error: friendlyError(error) };
  refresh();
  return { message: "Sent! A moderator will check it soon." };
}

export async function withdrawSubmission(formData: FormData) {
  const me = await requireMe();
  const supabase = await createClient();
  await supabase.from("challenge_submissions").delete().eq("id", String(formData.get("id"))).eq("profile_id", me.id);
  refresh();
}

export async function createChallenge(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe("staff");
  const title = String(formData.get("title") ?? "").trim();
  const starts = fromLocalInput(`${formData.get("starts")}T00:00`);
  const endsDay = fromLocalInput(`${formData.get("ends")}T00:00`);
  if (title.length < 3) return { error: "Give the challenge a title." };
  if (!starts || !endsDay) return { error: "Choose the start and end days." };
  // The challenge runs until the end of the last day.
  const ends = new Date(endsDay.getTime() + 24 * 3600 * 1000);
  if (ends <= starts) return { error: "The end day must be after the start day." };
  const supabase = await createClient();
  const { error } = await supabase.from("challenges").insert({
    title: title.slice(0, 100),
    description: String(formData.get("description") ?? "").trim().slice(0, 1000),
    emoji: String(formData.get("emoji") ?? "🏁").slice(0, 8) || "🏁",
    points: Math.min(100, Math.max(5, Number(formData.get("points")) || 20)),
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    created_by: me.id,
    school_id: me.school_id,
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { message: "Challenge created!" };
}

export async function deleteChallenge(formData: FormData) {
  await requireMe("staff");
  const supabase = await createClient();
  await supabase.from("challenges").delete().eq("id", String(formData.get("id")));
  refresh();
}
