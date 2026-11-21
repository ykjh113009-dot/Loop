"use client";

import { useActionState, useRef } from "react";
import { Check, Star, X } from "lucide-react";
import { redeemReward } from "@/app/actions/community";
import { PrizeIcon } from "@/components/shop/art";
import { makeT, type Locale } from "@/lib/i18n";

export type RedeemReward = { id: string; name: string; description: string; cost: number; category: string; image: string | null };

// "Redeem" opens a confirmation. Nothing is spent until the student confirms, and the database checks the balance again.
export function RedeemButton({ reward, balance, blocked, locale }: { reward: RedeemReward; balance: number; blocked: string | null; locale: Locale }) {
  const t = makeT(locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(redeemReward, null);
  const after = balance - reward.cost;
  const done = !!state?.ok;
  return (
    <>
      <button type="button" disabled={!!blocked} onClick={() => dialog.current?.showModal()} className="btn-primary w-full rounded-full" data-redeem={reward.id}>
        {blocked ?? t("Redeem")}
      </button>
      <dialog ref={dialog} className="m-auto w-[min(92vw,26rem)] rounded-3xl border border-brand-700/10 bg-cream p-0 text-ink shadow-2xl backdrop:bg-black/40" aria-labelledby={`rd-${reward.id}`} data-redeem-dialog>
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id={`rd-${reward.id}`} className="font-heading text-xl font-semibold text-brand-900">{done ? t("Reward requested") : t("Redeem this reward?")}</h2>
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-full p-1.5 text-ink-2 hover:bg-black/5" aria-label={t("Close")}><X className="size-5" aria-hidden="true" /></button>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
            <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand text-brand-800">
              {reward.image
                // eslint-disable-next-line @next/next/no-img-element -- private signed link
                ? <img src={reward.image} alt="" className="size-full object-cover" />
                : <PrizeIcon title={reward.name} category={reward.category} className="size-7" />}
            </span>
            <div className="min-w-0"><p className="truncate font-semibold">{reward.name}</p>{reward.description && <p className="line-clamp-2 text-xs text-ink-2">{reward.description}</p>}</div>
          </div>
          {done ? (
            <p className="flex items-start gap-2 rounded-2xl bg-sage-soft/60 p-3 text-sm text-brand-900"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{t("Done! Check your points.")} {t("You can follow its status under My rewards.")}</p>
          ) : (
            <dl className="divide-y divide-black/5 rounded-2xl bg-white px-4 text-sm shadow-sm">
              <div className="flex justify-between py-2.5"><dt className="text-ink-2">{t("Cost")}</dt><dd className="font-semibold tabular-nums">{reward.cost.toLocaleString("en")} LP</dd></div>
              <div className="flex justify-between py-2.5"><dt className="text-ink-2">{t("Your points")}</dt><dd className="font-semibold tabular-nums">{balance.toLocaleString("en")} LP</dd></div>
              <div className="flex justify-between py-2.5"><dt className="text-ink-2">{t("After redeeming")}</dt><dd className={`font-semibold tabular-nums ${after < 0 ? "text-red-700" : "text-brand-800"}`} data-after>{after.toLocaleString("en")} LP</dd></div>
            </dl>
          )}
          {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="btn-secondary flex-1 rounded-full">{done ? t("Close") : t("Cancel")}</button>
            {!done && (
              <form action={action} className="flex-1">
                <input type="hidden" name="rewardId" value={reward.id} />
                <button disabled={pending || after < 0} className="btn-primary w-full rounded-full" data-confirm-redeem>
                  <Star className="size-4" aria-hidden="true" />{pending ? "…" : t("Confirm")}
                </button>
              </form>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
