"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { SUBJECTS } from "@/lib/subjects";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

export async function saveTutorProfile(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const subjects = formData.getAll("subject").map(String).filter((s) => SUBJECTS.includes(s)).slice(0, 8);
  if (subjects.length === 0) return { error: "Pick at least one subject you can help with." };
  const row = {
    subjects,
    about: String(formData.get("about") ?? "").trim().slice(0, 300),
    availability: String(formData.get("availability") ?? "").trim().slice(0, 100),
    active: formData.get("active") !== "off",
  };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("tutor_profiles").select("profile_id").eq("profile_id", me.id).maybeSingle();
  const { error } = existing
    ? await supabase.from("tutor_profiles").update(row).eq("profile_id", me.id)
    : await supabase.from("tutor_profiles").insert({ ...row, profile_id: me.id, school_id: me.school_id });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { message: existing ? "Saved." : "You're now listed as a tutor. Thank you! 🤝" };
}

export async function stopTutoring() {
  const me = await requireMe();
  const supabase = await createClient();
  await supabase.from("tutor_profiles").delete().eq("profile_id", me.id);
  refresh();
}

export async function askTutor(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_tutoring", {
    p_tutor: String(formData.get("tutorId")),
    p_subject: String(formData.get("subject") ?? ""),
    p_message: String(formData.get("message") ?? "").trim(),
  });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { message: "Request sent! You'll get a notification when they answer." };
}

export async function respondTutoring(formData: FormData) {
  await requireMe();
  const supabase = await createClient();
  const accept = formData.get("accept") === "true";
  const { data } = await supabase.rpc("respond_tutoring", { p_request: String(formData.get("id")), p_accept: accept });
  after(dispatchPush);
  if (accept && data) redirect(`/messages/${data}`);
  refresh();
}

export async function finishTutoring(formData: FormData) {
  await requireMe();
  const supabase = await createClient();
  await supabase.rpc("finish_tutoring", { p_request: String(formData.get("id")), p_completed: formData.get("done") === "true" });
  after(dispatchPush);
  refresh();
}

export async function postStudyBuddy(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const subject = String(formData.get("subject") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!SUBJECTS.includes(subject)) return { error: "Pick a subject." };
  if (note.length < 3) return { error: "Say a bit about what you're looking for." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("study_buddy_posts")
    .insert({ author_id: me.id, school_id: me.school_id, subject, note: note.slice(0, 300) });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { message: "Posted!" };
}

export async function closeStudyBuddy(formData: FormData) {
  const me = await requireMe();
  const supabase = await createClient();
  await supabase.from("study_buddy_posts").delete().eq("id", String(formData.get("id"))).eq("author_id", me.id);
  refresh();
}
