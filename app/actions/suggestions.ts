"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

const CATEGORIES = ["activities", "facilities", "clubs", "events", "app", "other"];

export async function sendSuggestion(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "other");
  if (title.length < 3) return { error: "Give your idea a short title." };
  const supabase = await createClient();
  const { error } = await supabase.from("suggestions").insert({
    author_id: me.id,
    school_id: me.school_id,
    category: CATEGORIES.includes(category) ? category : "other",
    title: title.slice(0, 100),
    body: String(formData.get("body") ?? "").trim().slice(0, 1500),
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { message: "Thank you! The student council and school admins will read it." };
}

export async function respondSuggestion(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_suggestion", {
    p_suggestion: String(formData.get("id")),
    p_status: String(formData.get("status")),
    p_response: String(formData.get("response") ?? "").trim().slice(0, 1000),
  });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { message: "Sent to the student." };
}
