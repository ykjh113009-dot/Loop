"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { SUBJECTS } from "@/lib/subjects";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

// ---- Becoming a tutor: an application that admins or the Student Council review ------------
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function rpc(fn: string, args: Record<string, unknown>, message?: string): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn as "my_points", args as never);
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { ok: true, message };
}

export async function saveTutorApplication(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const submit = str(fd, "intent") === "submit";
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_tutor_application", {
    p: {
      grade: str(fd, "grade"), subjects: fd.getAll("subject").map(String), other_subjects: str(fd, "other_subjects"),
      achievements: str(fd, "achievements"), experience: str(fd, "experience"), qualifications: str(fd, "qualifications"),
      intro: str(fd, "intro"), motivation: str(fd, "motivation"), topics: str(fd, "topics"), format: str(fd, "format"),
      days: fd.getAll("day").map(String), hours: str(fd, "hours"), preferred_times: str(fd, "preferred_times"),
      availability_notes: str(fd, "availability_notes"), photo_path: str(fd, "image_path") || str(fd, "keep_photo"),
    },
    p_submit: submit,
  });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  if (submit) redirect("/tutors/apply");
  return { ok: true, message: "Draft saved. You can finish it later." };
}
export async function withdrawTutorApplication() {
  return rpc("withdraw_tutor_application", {}, "Taken back. You can edit it again.");
}
export async function addTutorDocument(path: string, name: string, kind: string, size: number): Promise<ActionResult> {
  return rpc("add_tutor_document", { p_path: path, p_name: name, p_kind: kind, p_size: size });
}
export async function removeTutorDocument(_: ActionResult, fd: FormData) {
  return rpc("remove_tutor_document", { p_id: str(fd, "id") });
}
export async function reviewTutorApplication(_: ActionResult, fd: FormData) {
  const approve = fd.get("decision") === "approve";
  const result = await rpc("review_tutor_application", { p_app: str(fd, "id"), p_approve: approve, p_note: str(fd, "note") },
    approve ? "Approved. The tutor is now in the directory." : "Sent back to the student with your feedback.");
  return result;
}
export async function updateMyTutorProfile(_: ActionResult, fd: FormData) {
  return rpc("update_tutor_profile", {
    p: {
      intro: str(fd, "intro"), qualifications: str(fd, "qualifications"), experience: str(fd, "experience"), format: str(fd, "format"),
      days: fd.getAll("day").map(String), hours: str(fd, "hours"), preferred_times: str(fd, "preferred_times"),
      photo_path: str(fd, "image_path"), active: fd.get("active") === "on",
    },
  }, "Saved.");
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

export async function submitTutorReview(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_tutor_review", {
    p_request: String(formData.get("requestId") ?? ""),
    p_rating: Number(formData.get("rating") ?? 0),
    p_comment: String(formData.get("comment") ?? ""),
  });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { ok: true, message: "Thanks for your review!" };
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
