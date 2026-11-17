"use client";

import { useState, useTransition } from "react";
import { pinBadges } from "@/app/actions/rewards";
import { makeT, type Locale } from "@/lib/i18n";

export type Ach = {
  code: string; name: string; emoji: string; description: string; category: string; tier: string; threshold: number; points_reward: number;
  progress: number; unlocked: boolean; earned_at: string | null; pinned: boolean;
};
const TIER: Record<string, string> = { bronze: "bg-amber-50 text-amber-900", silver: "bg-slate-100 text-slate-700", gold: "bg-yellow-100 text-yellow-900" };

// Achievements: earned ones can be shown on your profile (up to 6); locked ones show how close you are.
export function AchievementGrid({ items, locale }: { items: Ach[]; locale: Locale }) {
  const t = makeT(locale);
  const [pinned, setPinned] = useState(() => items.filter((a) => a.pinned).map((a) => a.code));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(code: string) {
    setMsg(null);
    const next = pinned.includes(code) ? pinned.filter((c) => c !== code) : pinned.length >= 6 ? pinned : [...pinned, code];
    if (next.length === pinned.length && !pinned.includes(code)) return setMsg(t("Show up to 6 badges on your profile."));
    setPinned(next);
    start(async () => { const r = await pinBadges(next); setMsg(r?.error ?? null); });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-black/50">{t("Tap ☆ on an earned badge to show it on your profile ({n}/6).", { n: pinned.length })}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-achievements>
        {items.map((a) => (
          <div key={a.code} className={`card relative space-y-1 p-3 ${a.unlocked ? "" : "opacity-60"}`} data-achievement={a.code} data-unlocked={a.unlocked}>
            <div className="flex items-start justify-between gap-1">
              <span className={`text-3xl ${a.unlocked ? "" : "grayscale"}`}>{a.emoji}</span>
              {a.unlocked
                ? <button type="button" onClick={() => toggle(a.code)} disabled={pending} aria-pressed={pinned.includes(a.code)} aria-label={t("Show on my profile")} className={`text-lg leading-none ${pinned.includes(a.code) ? "text-amber-500" : "text-black/25"}`}>{pinned.includes(a.code) ? "★" : "☆"}</button>
                : <span aria-hidden="true">🔒</span>}
            </div>
            <p className="text-sm leading-tight font-semibold">{t(a.name)}</p>
            <p className="text-[11px] leading-tight text-black/55">{t(a.description)}</p>
            <div className="flex flex-wrap items-center gap-1">
              <span className={`chip text-[10px] ${TIER[a.tier]}`}>{t(a.tier === "gold" ? "Gold" : a.tier === "silver" ? "Silver" : "Bronze")}</span>
              {a.points_reward > 0 && <span className="text-[10px] text-black/45">+{a.points_reward}</span>}
            </div>
            {!a.unlocked && (
              <div>
                <div className="h-1.5 rounded-full bg-black/10"><div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${Math.max(3, Math.round((a.progress / a.threshold) * 100))}%` }} /></div>
                <p className="mt-0.5 text-[10px] text-black/45 tabular-nums">{Math.floor(a.progress)}/{a.threshold}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
    </div>
  );
}
