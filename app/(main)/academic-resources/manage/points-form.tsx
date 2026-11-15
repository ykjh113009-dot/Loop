"use client";

import { useActionState } from "react";
import { setLibraryPoints } from "@/app/actions/library";
import { FormMessage } from "@/components/form-message";
import { makeT, type Locale } from "@/lib/i18n";

export function PointsForm({ current, locale }: { current: number; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(setLibraryPoints, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label" htmlFor="lib-points">{t("Points per approved resource")}</label>
        <input id="lib-points" name="points" type="number" min={0} max={200} defaultValue={current} className="input w-32" required />
      </div>
      <button disabled={pending} className="btn-primary">{t("Save")}</button>
      <div className="w-full"><FormMessage state={state} /></div>
    </form>
  );
}
