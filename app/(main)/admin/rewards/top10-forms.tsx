"use client";

import { useActionState } from "react";
import { Trophy } from "lucide-react";
import { clearTop10Image, setTop10Prize, setTop10Settings } from "@/app/actions/study";
import { PhotoField } from "@/components/photo-field";
import { PrizeIcon } from "@/components/shop/art";
import type { ActionResult } from "@/lib/errors";

function Msg({ state }: { state: ActionResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-red-700">{state.error}</p>;
  if (state?.message) return <p className="text-sm text-brand-800">{state.message}</p>;
  return null;
}

type Prize = { place: number; title: string; description: string; value: string; special: boolean; image: string | null };

function PrizeRow({ prize, schoolId, userId }: { prize: Prize; schoolId: string; userId: string }) {
  const [state, action, pending] = useActionState(setTop10Prize, null);
  const [clearState, clearAction] = useActionState(clearTop10Image, null);
  return (
    <div className="space-y-2 py-3" data-place-row={prize.place}>
      <form action={action} className="space-y-2" data-place={prize.place}>
        <input type="hidden" name="place" value={prize.place} />
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-bold">{prize.place}</span>
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sage-soft/60 text-brand-800">
            {prize.image
              // eslint-disable-next-line @next/next/no-img-element -- private signed link
              ? <img src={prize.image} alt="" className="size-full object-cover" />
              : <PrizeIcon title={prize.title} className="size-5" />}
          </span>
          <input name="title" maxLength={80} defaultValue={prize.title} className="input py-1.5 text-sm" placeholder="Prize (empty = none)" aria-label={`Prize for place ${prize.place}`} />
        </div>
        <div className="grid gap-2 ps-10 sm:grid-cols-[1fr_9rem]">
          <input name="description" maxLength={200} defaultValue={prize.description} className="input py-1.5 text-sm" placeholder="Short description (optional)" aria-label={`Details for place ${prize.place}`} />
          <input name="value" maxLength={40} defaultValue={prize.value} className="input py-1.5 text-sm" placeholder="Value, e.g. $100" aria-label={`Value for place ${prize.place}`} />
        </div>
        <div className="flex flex-wrap items-center gap-3 ps-10">
          <PhotoField schoolId={schoolId} userId={userId} label={prize.image ? "Change picture" : "Add a picture"} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="special" defaultChecked={prize.special} className="size-4" /> Education reward (highlighted)</label>
          <button disabled={pending} className="btn-primary ms-auto px-4 py-1.5 text-sm">{pending ? "…" : "Save"}</button>
        </div>
        <div className="ps-10"><Msg state={state} /></div>
      </form>
      {prize.image && (
        <form action={clearAction} className="ps-10"><input type="hidden" name="place" value={prize.place} /><button className="text-xs text-black/55 underline">Remove picture</button><Msg state={clearState} /></form>
      )}
    </div>
  );
}

export function Top10Forms({ settings, prizes, schoolId, userId }: { settings: { period: string; rules: string } | null; prizes: Prize[]; schoolId: string; userId: string }) {
  const [state, action, pending] = useActionState(setTop10Settings, null);
  return (
    <section className="card space-y-3 p-4" id="top10">
      <h2 className="flex items-center gap-2 font-semibold"><Trophy className="size-5 text-gold" aria-hidden="true" /> Top 10 prizes</h2>
      <p className="text-xs text-black/55">Shown beside the Reward Shop. The ranking is the normal student leaderboard, so there is nothing to keep in sync.</p>
      <form action={action} className="space-y-2">
        <label className="block text-sm"><span className="label">Competition period</span>
          <select name="period" defaultValue={settings?.period ?? "month"} className="input">
            <option value="month">This month (resets on the 1st)</option><option value="week">This week (resets every Sunday)</option><option value="all">All time</option>
          </select>
        </label>
        <label className="block text-sm"><span className="label">How students qualify</span>
          <textarea name="rules" rows={2} maxLength={500} defaultValue={settings?.rules ?? ""} className="input resize-none" placeholder="e.g. The 10 students with the most points each month win a prize." />
        </label>
        <Msg state={state} />
        <button disabled={pending} className="btn-primary w-full">{pending ? "…" : "Save rules"}</button>
      </form>
      <div className="divide-y divide-black/5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const p = prizes.find((x) => x.place === n);
          return <PrizeRow key={n} schoolId={schoolId} userId={userId} prize={p ?? { place: n, title: "", description: "", value: "", special: false, image: null }} />;
        })}
      </div>
    </section>
  );
}
