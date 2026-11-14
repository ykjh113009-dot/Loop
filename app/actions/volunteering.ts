"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { localDayKey } from "@/lib/time";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { fromLocalInput } from "@/lib/time";
import { dispatchPush } from "@/lib/push";

export async function logHours(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const hours = Number(formData.get("hours"));
  const date = String(formData.get("activity_date") ?? "");
  const organization = String(formData.get("organization") ?? "").trim();
  if (organization.length < 2) return { error: "Where did you volunteer?" };
  if (!(hours > 0 && hours <= 12)) return { error: "Hours must be between 0.5 and 12 for one day." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Choose the date." };
  if (date > localDayKey(new Date())) return { error: "The date can't be in the future." };
  const supabase = await createClient();
  const { error } = await supabase.from("volunteer_entries").insert({
    profile_id: me.id,
    school_id: me.school_id,
    organization: organization.slice(0, 100),
    description: String(formData.get("description") ?? "").trim().slice(0, 500),
    activity_date: date,
    hours: Math.round(hours * 2) / 2,
    supervisor_name: String(formData.get("supervisor_name") ?? "").trim().slice(0, 80),
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { message: "Saved! A moderator will check your hours." };
}

export async function deleteHours(formData: FormData) {
  const me = await requireMe();
  const supabase = await createClient();
  await supabase.from("volunteer_entries").delete().eq("id", String(formData.get("id"))).eq("profile_id", me.id);
  refresh();
}

// ---- The volunteering hub ---------------------------------------------------------
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function call(fn: string, args: Record<string, unknown>, message?: string): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn as "my_points", args as never);
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { ok: true, message };
}

export async function publishOpportunity(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const starts = str(fd, "starts_at") ? fromLocalInput(str(fd, "starts_at")) : null;
  const ends = str(fd, "ends_at") ? fromLocalInput(str(fd, "ends_at")) : null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_opportunity", {
    p: {
      title: str(fd, "title"), description: str(fd, "description"), requirements: str(fd, "requirements"), location: str(fd, "location"),
      spots: str(fd, "spots"), event_id: str(fd, "event_id"), starts_at: starts?.toISOString() ?? "", ends_at: ends?.toISOString() ?? "",
    },
    p_id: (str(fd, "id") || null) as string,
  });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  redirect(`/volunteering/manage/${data}`);
}
export async function setOpportunityStatus(_: ActionResult, fd: FormData) {
  return call("set_opportunity_status", { p_id: str(fd, "id"), p_status: str(fd, "status") });
}
export async function applyVolunteer(_: ActionResult, fd: FormData) {
  return call("apply_volunteer", { p_opp: str(fd, "id"), p_message: str(fd, "message") }, "Sent! The organizers will answer here.");
}
export async function withdrawApplication(_: ActionResult, fd: FormData) {
  return call("withdraw_application", { p_app: str(fd, "id") }, "Withdrawn.");
}
export async function reviewApplication(_: ActionResult, fd: FormData) {
  const accept = fd.get("decision") === "accept";
  return call("review_volunteer_application", { p_app: str(fd, "id"), p_accept: accept, p_responsibility: str(fd, "responsibility"), p_note: str(fd, "note") },
    accept ? "Accepted." : "Declined.");
}
export async function setResponsibility(_: ActionResult, fd: FormData) {
  return call("set_responsibility", { p_app: str(fd, "id"), p_text: str(fd, "responsibility") }, "Saved.");
}
export async function completeVolunteering(_: ActionResult, fd: FormData) {
  return call("complete_volunteering", { p_app: str(fd, "id"), p_hours: Number(str(fd, "hours")) }, "Hours recorded.");
}
