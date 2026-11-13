"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

const KINDS = ["text", "question", "achievement", "poll", "repost"] as const;
const REACTIONS = ["like", "love", "laugh", "wow", "sad", "clap"] as const;

export async function createFeedPost(input: {
  body: string;
  kind: string;
  clubId: string | null;
  imagePath: string | null;
  options?: string[];
  repostOf?: string | null;
}): Promise<ActionResult> {
  await requireMe();
  const kind = KINDS.find((k) => k === input.kind) ?? "text";
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_post", {
    p_body: input.body,
    p_kind: kind,
    p_club: (input.clubId || null) as unknown as string,
    p_image: (input.imagePath || null) as unknown as string,
    p_options: (kind === "poll" ? (input.options ?? []) : null) as unknown as string[],
    p_repost_of: (input.repostOf || null) as unknown as string,
  });
  if (error) return { error: friendlyError(error) };
  const { data: post } = await supabase.from("posts").select("status").eq("id", id).maybeSingle();
  after(dispatchPush);
  refresh();
  if (post?.status === "held") {
    return { message: "Your post is waiting for a moderator to check it, because it may contain words that aren't allowed." };
  }
  return { ok: true, message: kind === "repost" ? "Shared to your school." : undefined };
}

// kind = null removes the reaction.
export async function reactToPost(postId: string, kind: string | null): Promise<ActionResult> {
  const me = await requireMe();
  const supabase = await createClient();
  if (!kind) {
    const { error } = await supabase.from("post_reactions").delete().eq("post_id", postId).eq("profile_id", me.id);
    return error ? { error: friendlyError(error) } : { ok: true };
  }
  const reaction = REACTIONS.find((r) => r === kind);
  if (!reaction) return { error: "Unknown reaction." };
  const { data: existing } = await supabase.from("post_reactions").select("kind").eq("post_id", postId).eq("profile_id", me.id).maybeSingle();
  const { error } = existing
    ? await supabase.from("post_reactions").update({ kind: reaction }).eq("post_id", postId).eq("profile_id", me.id)
    : await supabase.from("post_reactions").insert({ post_id: postId, profile_id: me.id, kind: reaction });
  if (error) return { error: friendlyError(error) };
  if (!existing) after(dispatchPush);
  return { ok: true };
}

export async function toggleSave(postId: string, save: boolean): Promise<ActionResult> {
  const me = await requireMe();
  const supabase = await createClient();
  const { error } = save
    ? await supabase.from("post_saves").upsert({ post_id: postId, profile_id: me.id })
    : await supabase.from("post_saves").delete().eq("post_id", postId).eq("profile_id", me.id);
  return error ? { error: friendlyError(error) } : { ok: true };
}

export async function votePoll(postId: string, idx: number): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc("vote_post_poll", { p_post: postId, p_idx: idx });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true };
}

export async function addComment(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: String(formData.get("postId")),
      parent_id: (String(formData.get("parentId") ?? "") || null) as string | null,
      author_id: me.id,
      body: body.slice(0, 1000),
      school_id: me.school_id,
    })
    .select("status")
    .single();
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  if (data.status === "held") return { message: "Your comment is waiting for a moderator to check it." };
  return { ok: true };
}

export async function deleteComment(formData: FormData) {
  await requireMe();
  const supabase = await createClient();
  await supabase.from("post_comments").delete().eq("id", String(formData.get("commentId")));
  refresh();
}
