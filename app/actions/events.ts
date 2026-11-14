"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { fromLocalInput } from "@/lib/time";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function eventBody(fd: FormData) {
  const starts = fromLocalInput(s(fd, "starts_at"));
  const ends = s(fd, "ends_at") ? fromLocalInput(s(fd, "ends_at")) : null;
  if (!starts) return { error: "Please choose when the event starts." } as const;
  return {
    body: {
      title: s(fd, "title"),
      description: s(fd, "description"),
      location: s(fd, "location"),
      category: s(fd, "category"),
      club_id: s(fd, "club_id"),
      capacity: s(fd, "capacity"),
      starts_at: starts.toISOString(),
      ends_at: ends?.toISOString() ?? "",
      cover_path: s(fd, "image_path") || s(fd, "keep_cover"),
      organizers: fd.getAll("organizers").map(String),
    },
  } as const;
}

// Calls a database function. The database checks who may do it, again, inside.
async function call(fn: string, args: Record<string, unknown>, message?: string): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn as "my_points", args as never);
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { ok: true, message };
}

// Admins, the Student Council and club leaders publish at once; any other student sends a proposal.
export async function createEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireMe();
  if (me.isSuspended) return { error: "You can't create events while suspended." };
  const parsed = eventBody(fd);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_event", { p: parsed.body });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  redirect(`/events/${data}`);
}

export async function updateEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const parsed = eventBody(fd);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_event", { p_event: s(fd, "id"), p: parsed.body });
  if (error) return { error: friendlyError(error) };
  if (fd.has("organizers_present")) {
    const { error: teamError } = await supabase.rpc("set_event_organizers", { p_event: s(fd, "id"), p_ids: fd.getAll("organizers").map(String) });
    if (teamError && teamError.code !== "P0001") return { error: friendlyError(teamError) };
  }
  after(dispatchPush);
  redirect(`/events/${s(fd, "id")}`);
}

export async function cancelEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return call("cancel_event", { p_event: s(fd, "eventId"), p_reason: s(fd, "reason").slice(0, 300) }, "The event was cancelled and everyone involved was told.");
}

export async function rescheduleEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const starts = fromLocalInput(s(fd, "starts_at"));
  const ends = s(fd, "ends_at") ? fromLocalInput(s(fd, "ends_at")) : null;
  if (!starts) return { error: "Please choose when the event starts." };
  return call("reschedule_event", { p_event: s(fd, "eventId"), p_starts: starts.toISOString(), p_ends: (ends?.toISOString() ?? null) as string }, "New time saved. Everyone going was told.");
}

export async function joinEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_event", { p_event: s(fd, "id") });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message: data === "waitlist" ? "The event is full, so you are on the waiting list. We will tell you if a spot opens." : "You're going!" };
}
export async function leaveEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return call("leave_event", { p_event: s(fd, "id") });
}
export async function manageAttendee(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return call("manage_attendee", { p_event: s(fd, "id"), p_profile: s(fd, "profile"), p_action: s(fd, "action") });
}
export async function postEventUpdate(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return call("post_event_update", { p_event: s(fd, "id"), p_title: s(fd, "title"), p_body: s(fd, "body") }, "Posted. Everyone involved was told.");
}
export async function addEventAttachment(path: string, name: string, eventId: string): Promise<ActionResult> {
  return call("add_event_attachment", { p_event: eventId, p_path: path, p_name: name });
}
export async function removeEventAttachment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return call("remove_event_attachment", { p_id: s(fd, "id") });
}
export async function reviewEventProposal(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const approve = fd.get("decision") === "approve";
  return call("review_event", { p_event: s(fd, "id"), p_approve: approve, p_note: s(fd, "note") }, approve ? "Approved and published." : "Sent back to the student.");
}
