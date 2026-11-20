"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { connectRealtime, createClient } from "@/lib/supabase/client";
import { Glyph } from "@/components/glyph";
import { splitTitle } from "@/lib/notif-title";

type Toast = { id: string; title: string; body?: string; link: string; big?: boolean };
const KINDS = new Set(["points", "badge", "level_up", "streak"]);

// Opens the day (one reward per school day, decided by the database) and shows small live messages
// when the student earns something. Bigger moments (levels, long streaks) stay a little longer.
export function RewardToasts({ userId }: { userId: string }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef(new Set<string>());

  function push(t: Toast) {
    if (seen.current.has(t.id)) return;
    seen.current.add(t.id);
    setToasts((all) => [...all.slice(-2), t]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== t.id)), t.big ? 7000 : 4500);
  }

  useEffect(() => {
    const supabase = createClient();
    // Once per browser tab per day; the database still decides whether anything is paid.
    const key = `loop_login_${userId}_${new Date().toISOString().slice(0, 10)}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* private mode: still safe, the database dedupes */ }
    supabase.rpc("record_login").then(({ data }) => {
      const r = data as { first_today?: boolean; points?: number } | null;
      if (r?.first_today && (r.points ?? 0) > 0) push({ id: `login-${key}`, title: `+${r.points} Loop Points`, body: "Daily login", link: "/points" });
    }, () => {});
  }, [userId]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    connectRealtime().then(() => {
      if (stopped) return;
      channel = supabase
        .channel(`rewards:${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, (payload) => {
          const n = payload.new as { id: string; kind: string; title: string; body: string; link: string | null };
          if (KINDS.has(n.kind)) push({ id: n.id, title: n.title, body: n.body, link: n.link ?? "/points", big: n.kind === "level_up" || n.kind === "badge" || n.kind === "streak" });
        })
        .subscribe();
    });
    return () => { stopped = true; if (channel) supabase.removeChannel(channel); };
  }, [userId]);

  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pe-6" aria-live="polite" data-reward-toasts>
      {toasts.map((t) => (
        <Link key={t.id} href={t.link} className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border border-brand-700/10 bg-white px-4 py-3 shadow-lg ${t.big ? "ring-2 ring-sage" : ""}`} data-reward-toast>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold">{splitTitle(t.title).emoji && <Glyph e={splitTitle(t.title).emoji} />}{splitTitle(t.title).text}</span>
            {t.body && <span className="block truncate text-xs text-black/55">{t.body}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}
