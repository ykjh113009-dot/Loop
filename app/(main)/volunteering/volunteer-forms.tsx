"use client";

import { useActionState } from "react";
import { applyVolunteer, completeVolunteering, reviewApplication, setOpportunityStatus, setResponsibility, withdrawApplication } from "@/app/actions/volunteering";
import { makeT, type Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/errors";

function Msg({ state }: { state: ActionResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-red-700">{state.error}</p>;
  if (state?.message) return <p className="text-sm text-brand-800">{state.message}</p>;
  return null;
}

export function ApplyForm({ id, locale }: { id: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(applyVolunteer, null);
  if (state?.message) return <Msg state={state} />;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input name="message" maxLength={300} className="input text-sm" placeholder={t("Why would you like to help? (optional)")} aria-label={t("Why would you like to help? (optional)")} />
      <button disabled={pending} className="btn-primary w-full">{pending ? "…" : t("Apply to volunteer")}</button>
      <Msg state={state} />
    </form>
  );
}

export function WithdrawButton({ id, locale }: { id: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(withdrawApplication, null);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="text-xs text-black/45 hover:text-red-600">{pending ? "…" : t("Withdraw")}</button>
      <Msg state={state} />
    </form>
  );
}

// Accept (with a role) or decline an applicant.
export function ReviewApplication({ id, locale, current }: { id: string; locale: Locale; current: string }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(reviewApplication, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input name="responsibility" maxLength={200} defaultValue={current} className="input text-sm" placeholder={t("Their role, e.g. Hand out water")} aria-label={t("Their role, e.g. Hand out water")} />
      <input name="note" maxLength={300} className="input text-sm" placeholder={t("A note for the student (needed to decline)")} aria-label={t("A note for the student (needed to decline)")} />
      <div className="flex gap-2">
        <button name="decision" value="decline" disabled={pending} className="btn-ghost flex-1 text-red-700">{t("Decline")}</button>
        <button name="decision" value="accept" disabled={pending} className="btn-primary flex-1">{t("Accept")}</button>
      </div>
      <Msg state={state} />
    </form>
  );
}

export function AssignmentForm({ id, locale, current }: { id: string; locale: Locale; current: string }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(setResponsibility, null);
  return (
    <form action={action} className="flex gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="responsibility" maxLength={200} defaultValue={current} className="input text-sm" aria-label={t("Role")} />
      <button disabled={pending} className="btn-secondary shrink-0 px-3">{pending ? "…" : t("Save role")}</button>
      <Msg state={state} />
    </form>
  );
}

export function CompleteForm({ id, locale }: { id: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(completeVolunteering, null);
  return (
    <form action={action} className="flex gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="hours" type="number" step="0.5" min="0.5" max="12" required className="input w-24 text-sm" placeholder={t("Hours")} aria-label={t("Hours")} />
      <button disabled={pending} className="btn-primary shrink-0 px-3">{pending ? "…" : t("Done: record hours")}</button>
      <Msg state={state} />
    </form>
  );
}

export function StatusButtons({ id, status, locale }: { id: string; status: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(setOpportunityStatus, null);
  return (
    <form action={action} className="flex flex-wrap gap-2">
      <input type="hidden" name="id" value={id} />
      {status === "open" && <button name="status" value="closed" disabled={pending} className="btn-secondary">{t("Close applications")}</button>}
      {status === "closed" && <button name="status" value="open" disabled={pending} className="btn-secondary">{t("Reopen applications")}</button>}
      {status !== "cancelled" && <button name="status" value="cancelled" disabled={pending} className="btn-ghost text-red-700">{t("Cancel this opportunity")}</button>}
      <Msg state={state} />
    </form>
  );
}
