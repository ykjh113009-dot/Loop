"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";

export async function startChat(formData: FormData) {
  await requireMe();
  const supabase = await createClient();
  const other = String(formData.get("profileId"));
  // Only a real profile id goes into the address we send people to.
  if (!/^[0-9a-f-]{36}$/i.test(other)) redirect("/messages");
  const { data, error } = await supabase.rpc("start_direct_conversation", { p_other: other });
  if (error || !data) redirect(`/profile/${other}?error=chat`);
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

export async function createGroup(_: { error?: string; id?: string } | null, formData: FormData): Promise<{ error?: string; id?: string } | null> {
  await requireMe();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group_conversation", {
    p_title: String(formData.get("title") ?? ""),
    p_members: formData.getAll("member").map(String).slice(0, 30),
  });
  if (error) return { error: error.code === "P0001" ? error.message.replace(/^[A-Z_]+: /, "") : "The group could not be created. Please try again." };
  return { id: String(data) };
}

export async function leaveGroup(formData: FormData) {
  await requireMe();
  const supabase = await createClient();
  await supabase.rpc("leave_conversation", { p_conversation: String(formData.get("conversationId")) });
  redirect("/messages");
}
