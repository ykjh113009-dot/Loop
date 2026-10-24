"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { fromLocalInput } from "@/lib/time";
import { friendlyError, type ActionResult } from "@/lib/errors";

export async function vote(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const option = Number(formData.get("option"));
  if (!Number.isInteger(option)) return { error: "Choose an answer first." };
  const supabase = await createClient();
  const { error } = await supabase.from("poll_votes").insert({
    poll_id: String(formData.get("pollId")),
    profile_id: me.id,
    school_id: me.school_id,
    option_index: option,
  });
  if (error?.code === "23505") return { error: "You already voted." };
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true };
}

export async function createPoll(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const question = String(formData.get("question") ?? "").trim();
  const options = formData
    .getAll("option")
    .map((o) => String(o).trim().slice(0, 80))
    .filter(Boolean);
  const closes = fromLocalInput(String(formData.get("closes_at") ?? ""));
  if (question.length < 3) return { error: "Write a question." };
  if (options.length < 2) return { error: "Add at least 2 answers." };
  if (!closes || closes <= new Date()) return { error: "Choose when the poll closes (in the future)." };
  const supabase = await createClient();
  const { error } = await supabase.from("polls").insert({
    question: question.slice(0, 200),
    options: options.slice(0, 6),
    closes_at: closes.toISOString(),
    club_id: String(formData.get("club_id") ?? "") || null,
    created_by: me.id,
    school_id: me.school_id,
  });
  if (error) return { error: friendlyError(error) };
  redirect("/polls");
}

export async function deletePoll(formData: FormData) {
  await requireMe();
  const supabase = await createClient();
  await supabase.from("polls").delete().eq("id", String(formData.get("id")));
  refresh();
}
