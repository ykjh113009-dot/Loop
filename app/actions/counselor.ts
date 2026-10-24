"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

const TOPICS = ["stress", "friends", "family", "school", "future", "other"];

// Suspended students can still reach the counselor, so this uses getMe, not requireMe.
async function signedIn() {
  const me = await getMe();
  if (!me || !me.onboarded_at || me.deactivated_at) redirect("/login");
  return me;
}

export async function startCounselorRequest(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await signedIn();
  const topic = String(formData.get("topic") ?? "other");
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: "Please write a few words, so the counselor knows how to help." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_counselor_request", {
    p_topic: TOPICS.includes(topic) ? topic : "other",
    p_urgent: formData.get("urgent") === "on",
    p_message: message.slice(0, 2000),
  });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  redirect(`/counselor/${data}`);
}

export async function replyCounselor(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await signedIn();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write a message first." };
  const supabase = await createClient();
  const { error } = await supabase.from("counselor_messages").insert({
    request_id: String(formData.get("requestId")),
    sender_id: me.id,
    school_id: me.school_id,
    body: body.slice(0, 2000),
  });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { ok: true };
}

export async function setCounselorStatus(formData: FormData) {
  await signedIn();
  const supabase = await createClient();
  await supabase.rpc("set_counselor_status", { p_request: String(formData.get("id")), p_status: String(formData.get("status")) });
  refresh();
}
