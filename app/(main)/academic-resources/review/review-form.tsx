"use client";

import { useState, useTransition } from "react";
import { reviewLibrary } from "@/app/actions/library";
import { FormMessage } from "@/components/form-message";
import { makeT, type Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/errors";

export function ReviewForm({ id, hasFile, locale }: { id: string; hasFile: boolean; locale: Locale }) {
  const t = makeT(locale);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        start(async () => { const r = await reviewLibrary(null, fd); if (r) setResult(r); });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label" htmlFor="rv-note">{t("Message to the student")}</label>
        <textarea id="rv-note" name="note" className="input min-h-24" maxLength={500} placeholder={t("Required if you do not approve. Explain what to fix.")} />
      </div>
      {hasFile && (
        <div>
          <label className="label" htmlFor="rv-dl">{t("Downloads")}</label>
          <select id="rv-dl" name="downloadable" className="input" defaultValue="">
            <option value="">{t("Keep the student's choice")}</option>
            <option value="yes">{t("Allow downloads")}</option>
            <option value="no">{t("Read only (no download)")}</option>
          </select>
        </div>
      )}
      <FormMessage state={result} />
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="approve" disabled={pending} className="btn-primary" data-approve>✓ {t("Approve")}</button>
        <button name="decision" value="reject" disabled={pending} className="btn-danger" data-reject>✕ {t("Reject")}</button>
      </div>
    </form>
  );
}
