"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, FileText } from "lucide-react";

type R = { id: string; title: string; subject: string; rating: number; count: number; cover: string | null };

export function ResourceTabs({ top, recent, topLabel, recentLabel, empty }: { top: R[]; recent: R[]; topLabel: string; recentLabel: string; empty: string }) {
  const [tab, setTab] = useState<"top" | "recent">(top.length ? "top" : "recent");
  const rows = tab === "top" ? top : recent;
  return (
    <div>
      <div role="tablist" className="mb-3 flex gap-4 border-b border-brand-700/10 text-xs font-semibold">
        {([["top", topLabel], ["recent", recentLabel]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 pb-1.5 ${tab === k ? "border-brand-700 text-brand-900" : "border-transparent text-ink-2"}`}>{l}</button>
        ))}
      </div>
      {rows.length === 0 ? <p className="rounded-xl bg-sage-soft/40 px-4 py-5 text-center text-sm text-ink-2">{empty}</p> : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/academic-resources/${r.id}`} className="flex items-center gap-2.5 rounded-xl border border-brand-700/10 bg-white p-2 hover:bg-sage-soft/30">
                {r.cover
                  // eslint-disable-next-line @next/next/no-img-element -- signed cover
                  ? <img src={r.cover} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
                  : <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-sage-soft text-brand-700"><FileText className="size-5" aria-hidden="true" /></span>}
                <span className="min-w-0 text-xs">
                  <span className="block truncate font-semibold">{r.title}</span>
                  {r.count > 0 ? <span className="inline-flex items-center gap-1 text-ink-2"><Star className="size-3 fill-amber-400 text-amber-500" aria-hidden="true" />{r.rating.toFixed(1)} ({r.count})</span> : <span className="truncate text-ink-2">{r.subject}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
