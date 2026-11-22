"use client";

import { useState, useTransition } from "react";
import { changeVote } from "@/app/actions/polls";
import { Glyph } from "@/components/glyph";

// The bars of a poll you voted in. While the poll is open, tap another answer to change your vote.
export function PollResults({ pollId, options, counts, total, mine, canChange }: { pollId: string; options: string[]; counts: number[]; total: number; mine: number | null; canChange: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <ul className="space-y-2">
        {options.map((option, i) => {
          const n = counts[i] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          const selected = mine === i;
          const body = (
            <>
              <span className="flex justify-between">
                <span className={selected ? "font-semibold" : ""}>{option}{selected && <Glyph e="✓" className="ms-1" />}</span>
                <span className="tabular-nums text-black/60">{pct}% ({n})</span>
              </span>
              <span className="mt-1 block h-2.5 rounded-full bg-black/[0.06]">
                <span className={`block h-2.5 rounded-full ${selected ? "bg-brand-700" : "bg-brand-500/60"}`} style={{ width: `${Math.max(1, pct)}%` }} />
              </span>
            </>
          );
          return (
            <li key={i} className="text-sm">
              {canChange && !selected ? (
                <button type="button" disabled={pending} aria-label={option} onClick={() => start(async () => { setError(null); const r = await changeVote(pollId, i); if (r && "error" in r && r.error) setError(r.error); })} className="-mx-2 block w-[calc(100%+1rem)] rounded-xl px-2 py-1 text-start hover:bg-brand-50 disabled:opacity-60" data-change-vote>{body}</button>
              ) : body}
            </li>
          );
        })}
      </ul>
      {canChange && <p className="mt-2 text-xs text-black/45">Tap another answer to change your vote.</p>}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
