"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { TAWJIHI_TOPICS } from "@/lib/subjects";
import { friendlyError, type ActionResult } from "@/lib/errors";

export async function askQuestion(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const subject = String(formData.get("subject") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!TAWJIHI_TOPICS.includes(subject)) return { error: "Pick a topic." };
  if (title.length < 5) return { error: "Write your question (at least 5 letters)." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tawjihi_questions")
    .insert({ author_id: me.id, school_id: me.school_id, subject, title: title.slice(0, 150), body: String(formData.get("body") ?? "").trim().slice(0, 2000) })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error) };
  redirect(`/tawjihi/${data.id}`);
}

export async function answerQuestion(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write your answer first." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tawjihi_answers")
    .insert({ question_id: String(formData.get("questionId")), author_id: me.id, school_id: me.school_id, body: body.slice(0, 2000) })
    .select("status")
    .single();
  if (error) return { error: friendlyError(error) };
  refresh();
  return data.status === "held"
    ? { message: "Your answer is waiting for a moderator, because it may contain words that aren't allowed." }
    : { ok: true };
}

export async function deleteQuestion(formData: FormData) {
  const me = await requireMe();
  const supabase = await createClient();
  await supabase.from("tawjihi_questions").delete().eq("id", String(formData.get("id"))).eq("author_id", me.id);
  redirect("/tawjihi");
}

export async function deleteAnswer(formData: FormData) {
  const me = await requireMe();
  const supabase = await createClient();
  await supabase.from("tawjihi_answers").delete().eq("id", String(formData.get("id"))).eq("author_id", me.id);
  refresh();
}
