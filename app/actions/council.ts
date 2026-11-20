"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { fromLocalInput } from "@/lib/time";
import { friendlyError, type ActionResult } from "@/lib/errors";

const done = (error: { message?: string; code?: string } | null, message?: string): ActionResult => {
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message };
};

export async function addCouncilMember(_: ActionResult, formData: FormData) {
  const me = await requireMe("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("council_members").upsert({
    school_id: me.school_id,
    profile_id: String(formData.get("profileId")),
    position: String(formData.get("position") ?? "").trim().slice(0, 60) || "Member",
    sort: Number(formData.get("sort")) || 0,
  });
  return done(error, "Added to the council.");
}

export async function removeCouncilMember(_: ActionResult, formData: FormData) {
  const me = await requireMe("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("council_members").delete().eq("school_id", me.school_id).eq("profile_id", String(formData.get("profileId")));
  return done(error);
}

export async function createElection(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe("admin");
  const title = String(formData.get("title") ?? "").trim();
  const opens = fromLocalInput(String(formData.get("opens_at") ?? ""));
  const closes = fromLocalInput(String(formData.get("closes_at") ?? ""));
  if (title.length < 3) return { error: "Give the election a title." };
  if (!opens || !closes || closes <= opens) return { error: "Voting must close after it opens." };
  const grades = formData.getAll("grade").map(Number).filter((g) => me.school.grades.includes(g));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("elections")
    .insert({
      title: title.slice(0, 100),
      description: String(formData.get("description") ?? "").trim().slice(0, 1000),
      opens_at: opens.toISOString(),
      closes_at: closes.toISOString(),
      eligible_grades: grades.length && grades.length < me.school.grades.length ? grades : null,
      created_by: me.id,
      school_id: me.school_id,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error) };
  redirect(`/council/elections/${data.id}`);
}

export async function deleteElection(formData: FormData) {
  await requireMe("admin");
  const supabase = await createClient();
  await supabase.from("elections").delete().eq("id", String(formData.get("id")));
  redirect("/council");
}

export async function addCandidate(_: ActionResult, formData: FormData) {
  await requireMe("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("election_candidates").insert({
    election_id: String(formData.get("electionId")),
    profile_id: String(formData.get("profileId")),
    statement: String(formData.get("statement") ?? "").trim().slice(0, 500),
  });
  if (error?.code === "23505") return { error: "Already a candidate." };
  return done(error, "Candidate added.");
}

export async function removeCandidate(_: ActionResult, formData: FormData) {
  await requireMe("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("election_candidates").delete().eq("id", String(formData.get("id")));
  return done(error);
}

export async function updateStatement(_: ActionResult, formData: FormData) {
  const me = await requireMe();
  const supabase = await createClient();
  const { error } = await supabase
    .from("election_candidates")
    .update({ statement: String(formData.get("statement") ?? "").trim().slice(0, 500) })
    .eq("id", String(formData.get("id")))
    .eq("profile_id", me.id);
  return done(error, "Saved.");
}

export async function castVote(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const candidate = String(formData.get("candidate") ?? "");
  if (!candidate) return { error: "Choose a candidate first." };
  const supabase = await createClient();
  const { error } = await supabase.from("election_votes").insert({
    election_id: String(formData.get("electionId")),
    voter_id: me.id,
    candidate_id: candidate,
    school_id: me.school_id,
  });
  if (error?.code === "23505") return { error: "You already voted." };
  if (error) return { error: "You can't vote in this election (it may be closed or for other grades)." };
  refresh();
  return { message: "Thank you for voting! Your vote is secret." };
}

// ---- Council hub: posts, contact info, messages from students ------------------------
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function rpc(fn: string, args: Record<string, unknown>, message?: string): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn as "my_points", args as never);
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message };
}

export async function postCouncil(_: ActionResult, fd: FormData) {
  return rpc("post_council", {
    p_id: (str(fd, "id") || null) as string,
    p: { kind: str(fd, "kind"), title: str(fd, "title"), body: str(fd, "body"), status: str(fd, "status"), pinned: fd.get("pinned") === "on", event_id: str(fd, "event_id") },
  }, "Posted.");
}
export async function deleteCouncilPost(_: ActionResult, fd: FormData) {
  return rpc("delete_council_post", { p_id: str(fd, "id") });
}
export async function setCouncilInfo(_: ActionResult, fd: FormData) {
  return rpc("set_council_info", { p: { about: str(fd, "about"), contact_email: str(fd, "contact_email"), office: str(fd, "office"), meeting_info: str(fd, "meeting_info") } }, "Saved.");
}
export async function contactCouncil(_: ActionResult, fd: FormData) {
  return rpc("contact_council", { p_subject: str(fd, "subject"), p_body: str(fd, "body") }, "Sent! The council will reply here.");
}
export async function replyCouncilMessage(_: ActionResult, fd: FormData) {
  return rpc("reply_council_message", { p_id: str(fd, "id"), p_reply: str(fd, "reply"), p_close: fd.get("close") === "1" }, "Sent.");
}
