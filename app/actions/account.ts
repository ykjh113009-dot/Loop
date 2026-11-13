"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

// Sends an admin application to the Super Admins. Nothing is granted here:
// the database only stores the request.
export async function submitAdminApplication(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_admin_application", {
    p_role: String(formData.get("role") ?? ""),
    p_position: String(formData.get("position") ?? ""),
    p_motivation: String(formData.get("motivation") ?? ""),
    p_contribution: String(formData.get("contribution") ?? ""),
    p_experience: String(formData.get("experience") ?? ""),
  });
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { ok: true, message: "Application sent. A Super Admin will review it." };
}

export async function requestLeadershipRole(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const kind = String(formData.get("kind") ?? "");
  const club = String(formData.get("clubId") ?? "");
  const { error } = await supabase.rpc("request_leadership_role", {
    p_kind: kind,
    p_scope: String(formData.get("scope") ?? "").trim().toUpperCase().replace(/\s+/g, ""),
    p_club: kind === "club_leader" && club ? club : (null as unknown as string),
    p_reason: String(formData.get("reason") ?? ""),
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message: "Request sent. An admin will review it." };
}

// Writes a sign-in or 2FA event to the security log, with the browser and
// address the request came from.
export async function recordSecurityEvent(kind: "sign_in" | "mfa_enabled" | "mfa_disabled" | "mfa_verified") {
  const supabase = await createClient();
  const h = await headers();
  await supabase.rpc("record_security_event", {
    p_kind: kind,
    p_ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim(),
    p_user_agent: h.get("user-agent") ?? "",
  });
  refresh();
}
