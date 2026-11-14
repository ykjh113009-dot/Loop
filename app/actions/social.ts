"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { after } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getMe, requireMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";
import { LOCALE_COOKIE } from "@/lib/i18n";

const YEAR = 60 * 60 * 24 * 365;

export async function toggleFollow(formData: FormData) {
  const me = await requireMe();
  const other = String(formData.get("profileId"));
  const supabase = await createClient();
  if (formData.get("follow") === "true") {
    const { error } = await supabase.from("follows").insert({ follower_id: me.id, followed_id: other, school_id: me.school_id });
    if (!error) after(dispatchPush);
  } else {
    await supabase.from("follows").delete().eq("follower_id", me.id).eq("followed_id", other);
  }
  refresh();
}

async function rpcDone(fn: "send_friend_request" | "unfriend" | "cancel_friend_request", args: Record<string, unknown>): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args as never);
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { ok: true };
}

export async function sendFriendRequest(_: ActionResult, formData: FormData) {
  return rpcDone("send_friend_request", { p_to: String(formData.get("profileId")) });
}
export async function unfriend(_: ActionResult, formData: FormData) {
  return rpcDone("unfriend", { p_other: String(formData.get("profileId")) });
}
export async function cancelFriendRequest(_: ActionResult, formData: FormData) {
  return rpcDone("cancel_friend_request", { p_request: String(formData.get("requestId")) });
}
export async function respondFriendRequest(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_friend_request", {
    p_request: String(formData.get("requestId")),
    p_accept: formData.get("decision") === "accept",
  });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { ok: true };
}

const list = (formData: FormData, name: string, max: number) =>
  String(formData.get(name) ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim().slice(0, 30))
    .filter(Boolean)
    .slice(0, max);

// Skills, favourite subjects, class letter, accent colour, photo and cover.
export async function updateProfileExtras(input: {
  skills: string; subjects: string; section: string; accent: string;
  photoPath?: string | null; coverPath?: string | null;
}): Promise<ActionResult> {
  const me = await requireMe();
  const form = new FormData();
  form.set("skills", input.skills);
  form.set("subjects", input.subjects);
  const section = input.section.trim().toUpperCase();
  if (section && !/^[A-Z]$/.test(section)) return { error: "Your class is one letter, like A." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      skills: list(form, "skills", 12),
      favorite_subjects: list(form, "subjects", 8),
      section: section || null,
      accent: input.accent,
      ...(input.photoPath !== undefined ? { photo_path: input.photoPath } : {}),
      ...(input.coverPath !== undefined ? { cover_path: input.coverPath } : {}),
    })
    .eq("id", me.id);
  if (error) return { error: friendlyError(error) };
  refresh();
  return { message: "Saved!" };
}

export async function saveSettings(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  const who = String(formData.get("who_can_message"));
  const reduceMotion = formData.get("reduce_motion") === "on";
  const largeText = formData.get("large_text") === "on";
  const supabase = await createClient();
  const { error } = await supabase.from("profile_settings").upsert({
    profile_id: me.id,
    who_can_message: ["everyone", "friends", "nobody"].includes(who) ? who : "everyone",
    notifications_enabled: formData.get("notifications_enabled") === "on",
    locale,
    reduce_motion: reduceMotion,
    large_text: largeText,
    show_on_leaderboard: formData.get("show_on_leaderboard") === "on",
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: friendlyError(error) };
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  jar.set("loop_a11y", [reduceMotion && "calm", largeText && "large"].filter(Boolean).join(" "), { path: "/", maxAge: YEAR, sameSite: "lax" });
  refresh();
  return { ok: true, message: locale === "ar" ? "تم الحفظ." : "Saved." };
}

export async function unblock(formData: FormData) {
  const me = await requireMe();
  const supabase = await createClient();
  await supabase.from("blocks").delete().eq("blocker_id", me.id).eq("blocked_id", String(formData.get("profileId")));
  refresh();
}

export async function deactivateAccount(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireMe();
  if (formData.get("sure") !== "on") return { error: "Tick the box to confirm." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_my_account");
  if (error) return { error: friendlyError(error) };
  redirect("/removed");
}

export async function reactivateAccount() {
  const me = await getMe();
  if (!me) redirect("/login");
  const supabase = await createClient();
  await supabase.rpc("reactivate_my_account");
  redirect("/home");
}

export async function deleteAccount(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const supabase = await createClient();
  // Remove the student's own photos first; the database removes everything else.
  const { data: files } = await supabase.storage.from("post-images").list(`${me.school_id}/${me.id}`, { limit: 1000 });
  const { error } = await supabase.rpc("delete_my_account", { p_confirm: String(formData.get("confirm") ?? "").trim() });
  if (error) return { error: friendlyError(error) };
  if (files?.length) {
    await supabase.storage.from("post-images").remove(files.map((f) => `${me.school_id}/${me.id}/${f.name}`)).then(() => null, () => null);
  }
  await supabase.auth.signOut().then(() => null, () => null);
  redirect("/login");
}
