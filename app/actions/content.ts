"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMe, requireMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

export async function createPost(input: { clubId: string; body: string; imagePath: string | null }): Promise<ActionResult> {
  const me = await requireMe();
  const body = input.body.trim();
  if (!body) return { error: "Write something first." };
  if (body.length > 2000) return { error: "That's too long (2000 characters max)." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({ club_id: input.clubId, author_id: me.id, body, image_path: input.imagePath, school_id: me.school_id })
    .select("status")
    .single();
  if (error) return { error: friendlyError(error) };

  refresh();
  if (data.status === "held") {
    return { message: "Your post is waiting for a moderator to check it, because it may contain words that aren't allowed." };
  }
  return { ok: true };
}

export async function deletePost(formData: FormData) {
  await requireMe();
  const supabase = await createClient();
  const { data } = await supabase.from("posts").delete().eq("id", String(formData.get("postId"))).select("image_path");
  const path = data?.[0]?.image_path;
  if (path) await supabase.storage.from("post-images").remove([path]);
  refresh();
}

const REASONS = ["bullying", "harassment", "inappropriate", "spam", "self_harm", "other"] as const;
const TARGETS = ["post", "message", "profile", "club", "event"] as const;

export async function sendReport(input: {
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
}): Promise<ActionResult> {
  // Suspended students can still report things, so this doesn't use requireMe.
  const me = await getMe();
  if (!me || !me.onboarded_at) return { error: "Please sign in again." };
  const reason = REASONS.find((r) => r === input.reason);
  const targetType = TARGETS.find((t) => t === input.targetType);
  if (!reason || !targetType) return { error: "Please choose a reason." };

  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: me.id,
    target_type: targetType,
    target_id: input.targetId,
    reason,
    details: input.details.trim().slice(0, 1000),
    school_id: me.school_id,
  });
  if (error?.code === "23505") return { message: "You already reported this. A moderator will look at it soon." };
  if (error) return { error: friendlyError(error) };
  if (reason === "self_harm") after(dispatchPush);
  return { message: "Thank you. A moderator will look at this. The person won't know you reported them." };
}
