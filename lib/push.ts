import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export const pushEnabled = () =>
  !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_SECRET_KEY);

// Sends new notifications to students' phones (if they turned this on).
// Safe to call often: each notification is only ever sent once.
export async function dispatchPush() {
  if (!pushEnabled()) return { sent: 0 };
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const admin = createAdminClient();
  const { data: batch } = await admin.rpc("claim_push_batch", { p_limit: 300 });
  if (!batch?.length) return { sent: 0 };

  const recipients = [...new Set(batch.map((n) => n.recipient_id))];
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, profile_id, endpoint, p256dh, auth")
    .in("profile_id", recipients);
  if (!subscriptions?.length) return { sent: 0 };

  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    batch.flatMap((n) =>
      subscriptions
        .filter((s) => s.profile_id === n.recipient_id)
        .map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ title: n.title, body: n.body, url: n.link ?? "/notifications" }),
              { TTL: 60 * 60 * 12 },
            );
            sent++;
          } catch (error) {
            // 404/410 means the phone unsubscribed: forget it.
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) dead.push(s.id);
          }
        }),
    ),
  );
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  return { sent };
}
