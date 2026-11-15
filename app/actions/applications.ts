"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = ["/home", "/apply-admin", "/leadership", "/leadership/dashboard", "/moderation", "/admin"];

// The person has seen their decision: mark it seen (so the full screen is not shown again), then continue.
export async function acknowledgeApplication(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "/home");
  const supabase = await createClient();
  if ((kind === "admin" || kind === "leadership") && /^[0-9a-f-]{36}$/.test(id)) {
    await supabase.rpc("ack_application_decision", { p_kind: kind, p_id: id });
  }
  redirect(ALLOWED.includes(to) ? to : "/home");
}
