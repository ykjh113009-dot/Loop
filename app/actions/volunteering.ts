"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { localDayKey } from "@/lib/time";
import { friendlyError, type ActionResult } from "@/lib/errors";

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
