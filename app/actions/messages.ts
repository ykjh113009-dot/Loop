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
