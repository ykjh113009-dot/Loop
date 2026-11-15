"use client";

import { useActionState } from "react";
import { addStudyCategory } from "@/app/actions/study";
import { FormMessage } from "@/components/form-message";
import { makeT, type Locale } from "@/lib/i18n";

export function AddCategoryForm({ locale }: { locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(addStudyCategory, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input name="emoji" className="input w-16 text-center" placeholder="📘" maxLength={8} aria-label={t("Emoji")} />
        <input name="name" className="input flex-1" placeholder={t("Subject name")} required minLength={2} maxLength={60} aria-label={t("Subject name")} />
      </div>
      <button disabled={pending} className="btn-primary">{t("Add")}</button>
      <FormMessage state={state} />
    </form>
  );
}
