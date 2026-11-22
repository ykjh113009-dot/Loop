"use client";

import { useActionState } from "react";
import { reviewTutorApplication } from "@/app/actions/tutoring";
import { makeT, type Locale } from "@/lib/i18n";

export function DecisionForm({ id, locale }: { id: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(reviewTutorApplication, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <textarea name="note" rows={2} maxLength={500} className="input resize-none text-sm" placeholder={t("Feedback for the student (needed to reject)")} aria-label={t("Feedback for the student (needed to reject)")} />
      <div className="flex gap-2">
        <button name="decision" value="reject" disabled={pending} className="btn-danger flex-1">{t("Reject")}</button>
        <button name="decision" value="approve" disabled={pending} className="btn-primary flex-1">{t("Approve")}</button>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.message && <p className="text-sm text-brand-800">{state.message}</p>}
    </form>
  );
}
