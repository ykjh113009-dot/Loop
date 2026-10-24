"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { fromLocalInput } from "@/lib/time";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

function readTimes(formData: FormData) {
  const starts = fromLocalInput(String(formData.get("starts_at") ?? ""));
  const endsRaw = String(formData.get("ends_at") ?? "");
  const ends = endsRaw ? fromLocalInput(endsRaw) : null;
  if (!starts) return { error: "Please choose when the event starts." } as const;
  if (starts.getTime() < Date.now()) return { error: "The start time must be in the future." } as const;
  if (ends && ends <= starts) return { error: "The end time must be after the start time." } as const;
  return { starts, ends } as const;
}

export async function createEvent(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  if (me.isSuspended) return { error: "You can't create events while suspended." };
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3) return { error: "Give the event a title." };
  const times = readTimes(formData);
  if ("error" in times) return { error: times.error };
  const clubId = String(formData.get("club_id") ?? "") || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: title.slice(0, 100),
      description: String(formData.get("description") ?? "").trim().slice(0, 1500),
      location: String(formData.get("location") ?? "").trim().slice(0, 100),
      starts_at: times.starts.toISOString(),
      ends_at: times.ends?.toISOString() ?? null,
      club_id: clubId,
      school_id: me.school_id,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  redirect(`/events/${data.id}`);
}

export async function cancelEvent(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_event", {
    p_event: String(formData.get("eventId")),
    p_reason: String(formData.get("reason") ?? "").trim().slice(0, 300),
  });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { message: "The event was cancelled and everyone going was told." };
}

export async function rescheduleEvent(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireMe();
  const times = readTimes(formData);
  if ("error" in times) return { error: times.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_event", {
    p_event: String(formData.get("eventId")),
    p_starts: times.starts.toISOString(),
    // Passing null keeps the event without an end time.
    p_ends: (times.ends?.toISOString() ?? null) as string,
  });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { message: "New time saved. Everyone going was told." };
}
