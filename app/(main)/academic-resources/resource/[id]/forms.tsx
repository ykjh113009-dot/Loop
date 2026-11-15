"use client";

import { useActionState, useState } from "react";
import { deleteLibraryResource, flagLibrary, rateLibrary, resolveLibraryFlag, restoreLibrary, saveToLibrary } from "@/app/actions/library";
import { FormMessage } from "@/components/form-message";
import { LineIcon } from "@/components/line-icon";
import { makeT, type Locale } from "@/lib/i18n";

export function SaveButton({ id, saved, locale }: { id: string; saved: boolean; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(saveToLibrary, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="on" value={saved ? "0" : "1"} />
      <button disabled={pending} className={saved ? "btn-secondary" : "btn-ghost border border-black/10"} data-save aria-pressed={saved}>
        <span className="inline-flex items-center gap-1.5"><LineIcon name="bookmark" className="size-4" />{saved ? t("Saved to My Library") : t("Save to My Library")}</span>
      </button>
      {state?.error && <p className="mt-1 text-xs text-red-700">{state.error}</p>}
    </form>
  );
}

export function RateForm({ id, mine, locale }: { id: string; mine: { stars: number; review: string | null } | null; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(rateLibrary, null);
  const [stars, setStars] = useState(mine?.stars ?? 0);
  return (
    <form action={action} className="space-y-3" data-rate-form>
      <input type="hidden" name="id" value={id} />
      <div className="flex items-center gap-1" role="radiogroup" aria-label={t("Your rating")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name="stars" value={n} checked={stars === n} onChange={() => setStars(n)} className="sr-only" aria-label={`${n}`} required />
            <svg viewBox="0 0 24 24" className={`size-8 ${n <= stars ? "text-amber-500" : "text-black/20"}`} fill={n <= stars ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4l2.5 5.2 5.7.8-4.1 4 1 5.7L12 17l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />
            </svg>
          </label>
        ))}
      </div>
      <textarea name="review" className="input min-h-20" maxLength={1000} defaultValue={mine?.review ?? ""} placeholder={t("Write a short review (optional)")} aria-label={t("Review")} />
      <div className="flex flex-wrap gap-2">
        <button disabled={pending || stars === 0} className="btn-primary">{mine ? t("Update my rating") : t("Submit rating")}</button>
        {mine && <button name="remove" value="1" formNoValidate disabled={pending} className="btn-ghost text-sm">{t("Remove my rating")}</button>}
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function FlagForm({ id, locale }: { id: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(flagLibrary, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <textarea name="reason" className="input min-h-16" minLength={3} maxLength={500} required placeholder={t("Internal reason for the flag (only reviewers see this)")} aria-label={t("Reason")} />
      <button disabled={pending} className="btn-secondary text-sm">🚩 {t("Flag for review")}</button>
      <FormMessage state={state} />
    </form>
  );
}

export function ResolveFlagForm({ id, locale }: { id: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(resolveLibraryFlag, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input name="note" className="input" maxLength={500} placeholder={t("Note (internal)")} aria-label={t("Note")} />
      <div className="flex flex-wrap gap-2">
        <button name="outcome" value="kept" disabled={pending} className="btn-secondary text-sm">{t("Keep it")}</button>
        <button name="outcome" value="hidden" disabled={pending} className="btn-secondary text-sm">{t("Hide it")}</button>
        <button name="outcome" value="removed" disabled={pending} className="btn-danger text-sm">{t("Remove it")}</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function RestoreButton({ id, locale }: { id: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(restoreLibrary, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="btn-secondary text-sm">{t("Show it again")}</button>
      <FormMessage state={state} />
    </form>
  );
}

export function DeleteButton({ id, locale, warn }: { id: string; locale: Locale; warn: string }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(deleteLibraryResource, null);
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(warn)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="btn-ghost text-sm text-red-700" data-delete>{t("Delete")}</button>
      {state?.error && <p className="mt-1 text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
