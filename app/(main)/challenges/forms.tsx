"use client";
import { Place } from "@/components/glyph";

import { useActionState } from "react";
import {
  cancelChallenge, claimEntry, joinChallenge, rankChallenge, reviewChallengeIdea, reviewEntry, withdrawChallenge, withdrawEntry,
} from "@/app/actions/challenges";
import { makeT, type Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/errors";

function Msg({ state }: { state: ActionResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-red-700">{state.error}</p>;
  if (state?.message) return <p className="text-sm text-brand-800">{state.message}</p>;
  return null;
}

export function JoinButton({ id, locale }: { id: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(joinChallenge, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="btn-primary w-full">{pending ? "…" : t("Join this challenge")}</button>
      <Msg state={state} />
    </form>
  );
}

// A one-button form for actions that need no typing (take back, start checking).
export function QuickButton({ action, id, label, className = "btn-secondary", locale }: {
  action: "withdrawEntry" | "claimEntry" | "withdrawChallenge"; id: string; label: string; className?: string; locale: Locale;
}) {
  void locale;
  const fn = action === "withdrawEntry" ? withdrawEntry : action === "claimEntry" ? claimEntry : withdrawChallenge;
  const [state, formAction, pending] = useActionState(fn, null);
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className={className}>{pending ? "…" : label}</button>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

// Approve or reject proof, with a note the student sees.
export function EntryDecision({ id, locale, changing = false }: { id: string; locale: Locale; changing?: boolean }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(reviewEntry, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input name="note" maxLength={300} required={changing} placeholder={changing ? t("Why are you changing the decision?") : t("Feedback for the student (needed to reject)")} className="input text-sm" />
      <div className="flex gap-2">
        <button name="decision" value="reject" disabled={pending} className="btn-danger flex-1">{t("Reject")}</button>
        <button name="decision" value="approve" disabled={pending} className="btn-primary flex-1">{t("Approve")}</button>
      </div>
      <Msg state={state} />
    </form>
  );
}

// The Council or an admin approves a challenge idea.
export function IdeaDecision({ id, locale }: { id: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(reviewChallengeIdea, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="safe" className="mt-0.5 size-5 shrink-0 accent-brand-700" /><span>{t("I checked it is safe, private and inside school rules.")}</span></label>
      <input name="note" maxLength={300} placeholder={t("Feedback for the creator (needed to reject)")} className="input text-sm" />
      <div className="flex gap-2">
        <button name="decision" value="reject" disabled={pending} className="btn-danger flex-1">{t("Send back")}</button>
        <button name="decision" value="approve" disabled={pending} className="btn-primary flex-1">{t("Approve")}</button>
      </div>
      <Msg state={state} />
    </form>
  );
}

export function CancelForm({ id, locale }: { id: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(cancelChallenge, null);
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-semibold text-red-700">{t("Cancel this challenge")}</summary>
      <form action={action} className="mt-3 space-y-2">
        <input type="hidden" name="id" value={id} />
        <input name="note" required maxLength={300} placeholder={t("Why are you cancelling it?")} className="input text-sm" />
        <button disabled={pending} className="btn-danger w-full">{pending ? "…" : t("Cancel challenge")}</button>
        <Msg state={state} />
      </form>
    </details>
  );
}

// Choose the winners of a ranked challenge: pick one approved entry per place.
export function RankForm({ id, places, entries, locale }: { id: string; places: number; entries: { id: string; name: string }[]; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(rankChallenge, null);
  return (
    <form action={action} className="card space-y-2 p-4">
      <input type="hidden" name="id" value={id} />
      <h2 className="font-bold">{t("Choose the winners")}</h2>
      <p className="text-xs text-black/55">{t("Points are paid once. Check the entries carefully first.")}</p>
      {Array.from({ length: places }, (_, i) => i + 1).map((n) => (
        <label key={n} className="flex items-center gap-2 text-sm">
          <Place n={n} />
          <select name={`place${n}`} defaultValue="" className="input">
            <option value="">–</option>
            {entries.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
      ))}
      <button disabled={pending} className="btn-primary w-full">{pending ? "…" : t("Pay the prizes")}</button>
      <Msg state={state} />
    </form>
  );
}
