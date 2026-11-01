"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { connectRealtime, createClient } from "@/lib/supabase/client";
import type { Badges } from "@/lib/badges";

// The red counters on the bell and the chat icon. They refresh on every page
// change, and new notifications arrive live.
export function useBadges(userId: string | null, initial: Badges) {
  const pathname = usePathname();
  const [badges, setBadges] = useState(initial);

  useEffect(() => {
    if (!userId) return;
    createClient()
      .rpc("my_badges")
      .then(({ data }) => data && setBadges(data as Badges));
  }, [pathname, userId]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    connectRealtime().then(() => {
      if (stopped) return;
      channel = supabase
        .channel(`badges:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
          () => setBadges((b) => ({ ...b, notifications: b.notifications + 1 })),
        )
        .subscribe();
    });
    return () => {
      stopped = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  return badges;
}
