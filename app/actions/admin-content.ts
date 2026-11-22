"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";

// Removes something people made (post, comment, club, group, listing, event, poll, library item). The database checks that the
// person is an admin, writes the activity log and tells the owner why.
export async function removeContent(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireMe("admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_content", {
    p_kind: String(formData.get("kind") ?? ""),
    p_id: String(formData.get("id") ?? ""),
    p_reason: String(formData.get("reason") ?? ""),
  });
  if (error) return { error: error.code === "P0001" ? error.message : friendlyError(error) };
  refresh();
  return { ok: true, message: "Removed." };
}
