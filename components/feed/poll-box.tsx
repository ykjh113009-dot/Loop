"use client";

import { useTransition } from "react";
import { votePoll } from "@/app/actions/feed";
import { makeT, type Locale } from "@/lib/i18n";

type Option = { idx: number; label: string; votes: number; mine: boolean };

// A poll inside a post. Totals show after you vote; votes stay secret.
export function PollBox({ postId, options, locale, wide = false }: { postId: string; options: Option[]; locale: Locale; wide?: boolean }) {
  const t = makeT(locale);
  const [pending, start] = useTransition();
  const total = options.reduce((n, o) => n + o.votes, 0);
  const voted = options.some((o) => o.mine);
  return (
    <div className="mt-2.5 space-y-1.5">
      {options.map((o) => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        return (
          <button
            key={o.idx}
            type="button"
            disabled={pending}
            onClick={() => start(async () => { await votePoll(postId, o.idx); })}
            aria-pressed={o.mine}
            className={`relative block w-full overflow-hidden ${wide ? "rounded-full border-0 px-4 py-2.5" : "rounded-xl border px-3 py-2"} text-start text-sm ${o.mine ? "border-brand-700 bg-brand-700 font-semibold text-white" : wide ? "bg-white/80" : "border-brand-700/15"} hover:border-brand-600 disabled:opacity-60`}
          >
            {voted && <span className={`absolute inset-y-0 start-0 ${o.mine ? "bg-white/20" : wide ? "bg-gradient-to-r from-sage-soft to-[#9db98a]" : "bg-brand-100"}`} style={{ width: `${pct}%` }} aria-hidden="true" />}
            <span className="relative flex justify-between gap-3">
              <span className="min-w-0 break-words">{o.label}</span>
              {voted && <span className={`shrink-0 tabular-nums ${o.mine ? "text-white" : "text-ink-2"}`}>{pct}%</span>}
            </span>
          </button>
        );
      })}
      <p className="text-[11px] text-ink-2">
        {total === 1 ? t("1 vote") : t("{n} votes", { n: total })} · {voted ? t("Tap another choice to change your vote") : t("Vote to see the results")}
      </p>
    </div>
  );
}
