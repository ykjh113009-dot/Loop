"use client";

import { useState } from "react";
import Link from "next/link";

export type LeaderRow = { id: string; name: string; value: number; color?: string | null; badge?: string; me?: boolean };

// Houses, students or grades: one small card with tabs.
export function LeaderTabs({ tabs, labels }: { tabs: { key: string; label: string; rows: LeaderRow[]; unit: string }[]; labels: { title: string; all: string; empty: string } }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const tab = tabs.find((x) => x.key === active) ?? tabs[0];
  return (
    <section className="rounded-2xl border border-brand-700/10 bg-white/80 p-4 lg:p-5" data-card="leaderboard">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">{labels.title}</h2>
        <Link href="/leaderboard" className="text-xs font-medium text-brand-700 hover:underline">{labels.all} →</Link>
      </header>
      <div role="tablist" className="mb-3 inline-flex rounded-full bg-sage-soft/50 p-0.5 text-xs font-semibold">
        {tabs.map((x) => (
          <button key={x.key} role="tab" aria-selected={x.key === tab.key} onClick={() => setActive(x.key)} className={`rounded-full px-3.5 py-1.5 ${x.key === tab.key ? "bg-brand-700 text-white" : "text-ink-2"}`}>{x.label}</button>
        ))}
      </div>
      {tab.rows.length === 0 ? <p className="rounded-xl bg-sage-soft/40 px-4 py-5 text-center text-sm text-ink-2">{labels.empty}</p> : (
        <ol className="space-y-1" data-leader-list={tab.key}>
          {tab.rows.map((r, i) => (
            <li key={r.id} className={`flex items-center gap-3 rounded-xl px-2 py-2 text-sm ${r.me ? "bg-sage-soft/50" : ""}`}>
              <span className="w-4 text-xs font-semibold text-ink-2">{i + 1}</span>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg text-sm" style={{ background: r.color ? r.color + "26" : "#e9efe0" }} aria-hidden="true">{r.badge ?? "•"}</span>
              <span className="flex-1 truncate font-medium">{r.name}</span>
              <span className="font-semibold tabular-nums">{r.value.toLocaleString("en")}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[11px] text-ink-2">{tab.unit}</p>
    </section>
  );
}
