"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";

export async function startChat(formData: FormData) {
  await requireMe();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_direct_conversation", { p_other: String(formData.get("profileId")) });
  if (error || !data) redirect(`/profile/${formData.get("profileId")}?error=chat`);
  redirect(`/messages/${data}`);
}

export async function respondMessageRequest(formData: FormData) {
  await requireMe();
  const supabase = await createClient();
  const id = String(formData.get("conversationId"));
  const accept = formData.get("decision") === "accept";
  await supabase.rpc("respond_message_request", { p_conversation: id, p_accept: accept });
  redirect(accept ? `/messages/${id}` : "/messages");
}

export async function createGroup(_: { error?: string } | null, formData: FormData): Promise<{ error?: string } | null> {
  await requireMe();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group_conversation", {
    p_title: String(formData.get("title") ?? ""),
    p_members: formData.getAll("member").map(String).slice(0, 30),
  });
  if (error) return { error: error.code === "P0001" ? error.message.replace(/^[A-Z_]+: /, "") : "The group could not be created. Please try again." };
  redirect(`/messages/${data}`);
}

export async function leaveGroup(formData: FormData) {
  await requireMe();
  const supabase = await createClient();
  await supabase.rpc("leave_conversation", { p_conversation: String(formData.get("conversationId")) });
  redirect("/messages");
}
