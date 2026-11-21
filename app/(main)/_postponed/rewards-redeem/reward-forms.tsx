// POSTPONED: the Reward Shop where students spend points. Not routed. See ../README.md.
"use client";

import { useActionState } from "react";
import { removeRewardImage, setRewardActive, updateReward } from "@/app/actions/community";
import { PhotoField } from "@/components/photo-field";
import { CATEGORIES, CATEGORY_LABEL, PrizeIcon } from "@/components/shop/art";
import type { ActionResult } from "@/lib/errors";

function Msg({ state }: { state: ActionResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-red-700">{state.error}</p>;
  if (state?.message) return <p className="text-sm text-brand-800">{state.message}</p>;
  return null;
}

export function CategorySelect({ defaultValue = "other" }: { defaultValue?: string }) {
  return (
    <select name="category" defaultValue={defaultValue} className="input" aria-label="Category">
      {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
      <option value="other">Other</option>
    </select>
  );
}

export type AdminReward = { id: string; name: string; description: string; cost: number; kind: string; stock: number | null; active: boolean; per_student_limit: number; category: string; image: string | null };

// One reward: its status, a switch to show or hide it, and an editor.
export function RewardRow({ reward: r, schoolId, userId }: { reward: AdminReward; schoolId: string; userId: string }) {
  const [state, action, pending] = useActionState(updateReward, null);
  const [activeState, activeAction, activePending] = useActionState(setRewardActive, null);
  const [imgState, imgAction] = useActionState(removeRewardImage, null);
  return (
    <li className="py-3" data-reward-row={r.id}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sage-soft/60 text-brand-800">
          {r.image
            // eslint-disable-next-line @next/next/no-img-element -- private signed link
            ? <img src={r.image} alt="" className="size-full object-cover" />
            : <PrizeIcon title={r.name} category={r.category} className="size-6" />}
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <strong>{r.name}</strong>
          <span className="block text-xs text-black/55">{r.cost} LP · {CATEGORY_LABEL[r.category] ?? "Other"} · {r.kind === "unlockable" ? "profile unlock" : r.stock !== null ? `${r.stock} left` : "no limit"}{!r.active && " · hidden"}</span>
        </span>
        <form action={activeAction}>
          <input type="hidden" name="rewardId" value={r.id} /><input type="hidden" name="active" value={String(!r.active)} />
          <button disabled={activePending} className={r.active ? "btn-secondary px-3 py-1 text-xs" : "btn-primary px-3 py-1 text-xs"}>{r.active ? "Hide from shop" : "Show in shop"}</button>
        </form>
      </div>
      <Msg state={activeState} />
      <details className="mt-2 ps-0 sm:ps-[3.75rem]">
        <summary className="cursor-pointer text-sm font-medium text-brand-700">Edit</summary>
        <form action={action} className="mt-2 space-y-2" data-edit-reward={r.id}>
          <input type="hidden" name="rewardId" value={r.id} />
          <input name="name" required minLength={2} maxLength={80} defaultValue={r.name} aria-label="Name" className="input" />
          <input name="description" maxLength={300} defaultValue={r.description} aria-label="Description" placeholder="Short description" className="input" />
          <div className="grid gap-2 sm:grid-cols-4">
            <label className="text-sm"><span className="label">Cost (LP)</span><input name="cost" type="number" min={1} required defaultValue={r.cost} className="input" /></label>
            <label className="text-sm"><span className="label">How many (empty = no limit)</span><input name="stock" type="number" min={0} defaultValue={r.stock ?? ""} className="input" /></label>
            <label className="text-sm"><span className="label">Per student</span><input name="limit" type="number" min={1} max={10} defaultValue={r.per_student_limit} className="input" /></label>
            <label className="text-sm"><span className="label">Category</span><CategorySelect defaultValue={r.category} /></label>
          </div>
          <PhotoField schoolId={schoolId} userId={userId} label={r.image ? "Change picture" : "Add a picture"} />
          <Msg state={state} />
          <button disabled={pending} className="btn-primary px-4 py-1.5 text-sm">{pending ? "…" : "Save changes"}</button>
        </form>
        {r.image && <form action={imgAction} className="mt-1"><input type="hidden" name="rewardId" value={r.id} /><button className="text-xs text-black/55 underline">Remove picture</button><Msg state={imgState} /></form>}
      </details>
    </li>
  );
}
