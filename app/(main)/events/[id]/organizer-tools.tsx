"use client";

import { useActionState } from "react";
import { manageAttendee, postEventUpdate, reviewEventProposal } from "@/app/actions/events";
import { makeT, type Locale } from "@/lib/i18n";

export function PostUpdateForm({ eventId, locale }: { eventId: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(postEventUpdate, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={eventId} />
      <input name="title" required maxLength={100} className="input" placeholder={t("Title, e.g. Bring a jacket")} aria-label={t("Title, e.g. Bring a jacket")} />
      <textarea name="body" rows={2} maxLength={1000} className="input resize-none" placeholder={t("Details (optional)")} aria-label={t("Details (optional)")} />
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.message && <p className="text-sm text-brand-800">{state.message}</p>}
      <button disabled={pending} className="btn-secondary w-full">{pending ? "…" : t("Tell everyone involved")}</button>
    </form>
  );
}

export function AttendeeActions({ eventId, profileId, status, locale }: { eventId: string; profileId: string; status: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(manageAttendee, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="id" value={eventId} />
      <input type="hidden" name="profile" value={profileId} />
      {status === "waitlist" ? (
        <button name="action" value="promote" disabled={pending} className="btn-secondary px-2 py-1 text-xs">{t("Let in")}</button>
      ) : (
        <button name="action" value="waitlist" disabled={pending} className="btn-ghost px-2 py-1 text-xs">{t("Move to waiting list")}</button>
      )}
      <button name="action" value="remove" disabled={pending} className="btn-ghost px-2 py-1 text-xs text-red-700">{t("Remove")}</button>
      {state?.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}

export function ProposalDecision({ eventId, locale }: { eventId: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(reviewEventProposal, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={eventId} />
      <input name="note" maxLength={300} className="input text-sm" placeholder={t("Feedback for the student (needed to reject)")} aria-label={t("Feedback for the student (needed to reject)")} />
      <div className="flex gap-2">
        <button name="decision" value="reject" disabled={pending} className="btn-danger flex-1">{t("Reject")}</button>
        <button name="decision" value="approve" disabled={pending} className="btn-primary flex-1">{t("Approve and publish")}</button>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.message && <p className="text-sm text-brand-800">{state.message}</p>}
    </form>
  );
}
