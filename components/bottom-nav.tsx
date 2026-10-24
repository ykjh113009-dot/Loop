"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { connectRealtime, createClient } from "@/lib/supabase/client";
import { Icon, type IconName } from "@/components/icons";

export type Badges = { notifications: number; messages: number; moderation: number };

const TABS: { href: string; label: string; icon: IconName; badge?: keyof Badges }[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/clubs", label: "Clubs", icon: "clubs" },
  { href: "/events", label: "Events", icon: "calendar" },
  { href: "/messages", label: "Chats", icon: "chat", badge: "messages" },
  { href: "/notifications", label: "Alerts", icon: "bell", badge: "notifications" },
];

export function BottomNav({ userId, initial }: { userId: string | null; initial: Badges }) {
  const pathname = usePathname();
  const [badges, setBadges] = useState(initial);

  // Refresh the counts on every page change (cheap: one small request).
  useEffect(() => {
    if (!userId) return;
    createClient()
      .rpc("my_badges")
      .then(({ data }) => data && setBadges(data as Badges));
  }, [pathname, userId]);

  // New notifications arrive live, so the bell updates without reloading.
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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          const count = tab.badge ? badges[tab.badge] : 0;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  active ? "text-brand-700" : "text-black/50"
                }`}
              >
                <Icon name={tab.icon} className="size-6" />
                {tab.label}
                {count > 0 && (
                  <span className="absolute top-1 left-1/2 ml-2 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-bold text-white">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
