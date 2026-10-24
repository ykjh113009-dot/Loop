"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";

export async function markAllNotificationsRead() {
  const me = await requireMe();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", me.id).is("read_at", null);
}

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }) {
  const me = await requireMe();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({ profile_id: me.id, ...sub });
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string) {
  await requireMe();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
