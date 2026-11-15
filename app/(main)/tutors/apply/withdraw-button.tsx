"use client";

import { useActionState } from "react";
import { withdrawTutorApplication } from "@/app/actions/tutoring";
import { makeT, type Locale } from "@/lib/i18n";

export function WithdrawButton({ locale }: { locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(withdrawTutorApplication, null);
  return (
    <form action={action} className="space-y-1">
      <button disabled={pending} className="btn-secondary w-full">{pending ? "…" : t("Take it back to edit")}</button>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
