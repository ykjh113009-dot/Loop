"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { AVATARS } from "@/lib/avatars";
import { friendlyError, type ActionResult } from "@/lib/errors";

function readInterests(formData: FormData) {
  return formData.getAll("interest").map(Number).filter(Number.isInteger).slice(0, 10);
}

export async function completeOnboarding(_: ActionResult, formData: FormData): Promise<ActionResult> {
  if (formData.get("rules") !== "on") return { error: "Please agree to the community rules." };
  const avatar = String(formData.get("avatar") ?? "");
  if (!AVATARS.includes(avatar)) return { error: "Please choose an avatar." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_grade: Number(formData.get("grade")) || 0,
    p_avatar: avatar,
    p_bio: String(formData.get("bio") ?? "").trim().slice(0, 200),
    p_interests: readInterests(formData),
  });
  if (error) return { error: friendlyError(error) };
  redirect("/home");
}

export async function updateProfile(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const avatar = String(formData.get("avatar") ?? "");
  if (!AVATARS.includes(avatar)) return { error: "Please choose an avatar." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar, bio: String(formData.get("bio") ?? "").trim().slice(0, 200) })
    .eq("id", me.id);
  if (error) return { error: friendlyError(error) };

  const { error: interestsError } = await supabase.rpc("set_my_interests", { p_interests: readInterests(formData) });
  if (interestsError) return { error: friendlyError(interestsError) };

  refresh();
  return { message: "Saved!" };
}

export async function toggleBlock(formData: FormData) {
  const me = await requireMe();
  const other = String(formData.get("profileId"));
  const supabase = await createClient();
  if (formData.get("block") === "true") {
    await supabase.from("blocks").insert({ blocker_id: me.id, blocked_id: other });
  } else {
    await supabase.from("blocks").delete().eq("blocker_id", me.id).eq("blocked_id", other);
  }
  refresh();
}
