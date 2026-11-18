"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";

export async function requestClub(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  if (me.isSuspended) return { error: "You can't request clubs while suspended." };
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "⭐");
  const rawCategory = String(formData.get("category") ?? "other");
  const category = ["sports", "academics", "tech", "culture", "charity", "other"].includes(rawCategory) ? rawCategory : "other";
  if (name.length < 3) return { error: "The club name needs at least 3 letters." };
  if (description.length < 10) return { error: "Tell people a bit more about the club." };

  const supabase = await createClient();
  const { data: created, error } = await supabase.from("clubs").insert({
    name: name.slice(0, 60),
    description: description.slice(0, 500),
    emoji,
    category,
    school_id: me.school_id,
    requested_by: me.id,
    status: "pending",
  }).select("id").single();
  if (error?.code === "23505") return { error: "A club with that name already exists or is waiting for approval." };
  if (error) return { error: friendlyError(error) };
  // With a picture to upload, the page uploads it first and then goes to the list.
  if (formData.get("hasPicture") === "1" && created) return { ok: true, clubId: created.id };
  redirect("/clubs?requested=1");
}

export async function joinClub(formData: FormData) {
  const me = await requireMe();
  const supabase = await createClient();
  await supabase.from("club_members").insert({ club_id: String(formData.get("clubId")), profile_id: me.id, role: "member" });
  refresh();
}

export async function leaveClub(formData: FormData) {
  const me = await requireMe();
  const supabase = await createClient();
  await supabase.from("club_members").delete().eq("club_id", String(formData.get("clubId"))).eq("profile_id", me.id);
  refresh();
}
