"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

async function done(error: { message?: string; code?: string } | null, message?: string): Promise<ActionResult> {
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message };
}

export async function updateMember(_: ActionResult, formData: FormData) {
  await requireMe("admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_member", {
    p_user: String(formData.get("profileId")),
    p_grade: Number(formData.get("grade")),
    p_role: String(formData.get("role")),
  });
  return done(error, "Saved.");
}

export async function unsuspendMember(_: ActionResult, formData: FormData) {
  await requireMe("admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("unsuspend_user", { p_user: String(formData.get("profileId")) });
  return done(error, "Suspension lifted.");
}

export async function setDeactivated(_: ActionResult, formData: FormData) {
  await requireMe("admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_deactivated", {
    p_user: String(formData.get("profileId")),
    p_deactivated: formData.get("deactivate") === "true",
  });
  return done(error);
}

export async function postAnnouncement(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe("admin");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return { error: "Write a title and a message." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .insert({ title: title.slice(0, 120), body: body.slice(0, 3000), author_id: me.id, school_id: me.school_id });
  if (!error) after(dispatchPush);
  return done(error, "Posted! Every student got a notification.");
}

export async function deleteAnnouncement(_: ActionResult, formData: FormData) {
  await requireMe("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", String(formData.get("id")));
  return done(error);
}

export async function updateSchool(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe("admin");
  const grades = String(formData.get("grades") ?? "")
    .split(/[\s,]+/)
    .map(Number)
    .filter((g) => Number.isInteger(g) && g >= 1 && g <= 12);
  if (grades.length === 0) return { error: "Add at least one grade, e.g. 9, 10, 11, 12." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({
      name: String(formData.get("name") ?? "").trim().slice(0, 100) || me.school.name,
      grades: [...new Set(grades)].sort((a, b) => a - b),
      roster_required: formData.get("roster_required") === "on",
    })
    .eq("id", me.school_id);
  return done(error, "School settings saved.");
}

export async function addToRoster(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe("admin");
  const domain = (await (await createClient()).from("schools").select("email_domain").eq("id", me.school_id).single()).data?.email_domain;
  const emails = [...new Set(String(formData.get("emails") ?? "").toLowerCase().split(/[\s,;]+/).filter(Boolean))];
  const bad = emails.filter((e) => !e.endsWith(`@${domain}`));
  if (emails.length === 0) return { error: "Paste at least one email." };
  if (bad.length) return { error: `These are not @${domain} emails: ${bad.slice(0, 5).join(", ")}` };
  const kind = String(formData.get("kind") ?? "student");
  const alumniYear = kind === "alumni" ? Number(formData.get("alumni_year")) : null;
  if (kind === "alumni" && !(alumniYear && alumniYear >= 1990 && alumniYear <= 2100)) return { error: "Enter the graduation year for alumni." };
  const grade = kind === "student" ? Number(formData.get("grade")) || null : null;
  const supabase = await createClient();
  const { error } = await supabase.from("roster").upsert(
    emails.map((email) => ({
      school_id: me.school_id,
      email,
      grade,
      role: kind === "counselor" ? "counselor" : "student",
      alumni_year: alumniYear,
      added_by: me.id,
    })),
  );
  return done(error, `Added ${emails.length} email(s).`);
}

export async function removeFromRoster(_: ActionResult, formData: FormData) {
  const me = await requireMe("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("roster").delete().eq("school_id", me.school_id).eq("email", String(formData.get("email")));
  return done(error);
}

export async function addBlockedWord(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe("admin");
  const word = String(formData.get("word") ?? "").trim().toLowerCase();
  if (word.length < 2) return { error: "Words need at least 2 letters." };
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_words").insert({ school_id: me.school_id, word: word.slice(0, 60) });
  return done(error, `"${word}" will now be held for review.`);
}

export async function removeBlockedWord(_: ActionResult, formData: FormData) {
  await requireMe("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_words").delete().eq("id", Number(formData.get("id")));
  return done(error);
}

export async function setAlumni(_: ActionResult, formData: FormData) {
  await requireMe("admin");
  const raw = String(formData.get("alumni_year") ?? "").trim();
  const year = raw ? Number(raw) : null;
  if (year !== null && !(Number.isInteger(year) && year >= 1990 && year <= 2100)) return { error: "Enter a graduation year like 2024." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_alumni", { p_user: String(formData.get("profileId")), p_year: year as number });
  return done(error, year ? `Now an alumni mentor (class of ${year}).` : "Now a current student again.");
}
