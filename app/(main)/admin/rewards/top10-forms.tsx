"use client";

import { useActionState } from "react";
import { setTop10Prize, setTop10Settings } from "@/app/actions/study";
import type { ActionResult } from "@/lib/errors";
import { Glyph } from "@/components/glyph";

function Msg({ state }: { state: ActionResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-red-700">{state.error}</p>;
  if (state?.message) return <p className="text-sm text-brand-800">{state.message}</p>;
  return null;
}

function PrizeRow({ place, title, description }: { place: number; title: string; description: string }) {
  const [state, action, pending] = useActionState(setTop10Prize, null);
  return (
    <form action={action} className="space-y-1.5 py-2" data-place={place}>
      <input type="hidden" name="place" value={place} />
      <div className="flex items-center gap-2">
        <span className="w-6 text-center text-sm font-bold">{place}</span>
        <input name="title" maxLength={80} defaultValue={title} className="input py-1.5 text-sm" placeholder="Prize (empty = none)" aria-label={`Prize for place ${place}`} />
        <button disabled={pending} className="btn-secondary shrink-0 px-3 py-1.5 text-xs">{pending ? "…" : "Save"}</button>
      </div>
      <input name="description" maxLength={200} defaultValue={description} className="input ms-8 w-[calc(100%-2rem)] py-1.5 text-sm" placeholder="Details (optional)" aria-label={`Details for place ${place}`} />
      <div className="ms-8"><Msg state={state} /></div>
    </form>
  );
}

export function Top10Forms({ settings, prizes }: { settings: { period: string; rules: string } | null; prizes: { place: number; title: string; description: string }[] }) {
  const [state, action, pending] = useActionState(setTop10Settings, null);
  return (
    <section className="card space-y-3 p-4" id="top10">
      <h2 className="font-semibold"><Glyph e="🏆" /> Top 10 prizes</h2>
      <p className="text-xs text-black/55">Shown inside the Rewards Shop. The ranking is the normal student leaderboard, so there is nothing to keep in sync.</p>
      <form action={action} className="space-y-2">
        <label className="block text-sm"><span className="label">Ranking period</span>
          <select name="period" defaultValue={settings?.period ?? "week"} className="input"><option value="week">This week (resets every Sunday)</option><option value="all">All time</option></select>
        </label>
        <label className="block text-sm"><span className="label">How students qualify</span>
          <textarea name="rules" rows={2} maxLength={500} defaultValue={settings?.rules ?? ""} className="input resize-none" placeholder="e.g. The 10 students with the most points each week win a prize." />
        </label>
        <Msg state={state} />
        <button disabled={pending} className="btn-primary w-full">{pending ? "…" : "Save rules"}</button>
      </form>
      <div className="divide-y divide-black/5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const p = prizes.find((x) => x.place === n);
          return <PrizeRow key={n} place={n} title={p?.title ?? ""} description={p?.description ?? ""} />;
        })}
      </div>
    </section>
  );
}
