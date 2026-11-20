"use client";

import { useActionState } from "react";
import { createGroup } from "@/app/actions/community";
import { SubmitButton } from "@/components/submit-button";
import { makeT, type Locale } from "@/lib/i18n";
import { IconPicker } from "@/components/icon-picker";

export function NewGroupForm({ official, locale }: { official: boolean; locale: Locale }) {
  const t = makeT(locale);
  const [state, action] = useActionState(createGroup, null);
  return (
    <form action={action} className="card space-y-4 p-4">
      <div className="space-y-4">
        <div><span className="label">{t("Icon")}</span><IconPicker defaultValue="👥" label={t("Icon")} /></div>
        <label className="block"><span className="label">{t("Group name")}</span><input name="name" required minLength={3} maxLength={60} className="input" placeholder={t("e.g. Photography lovers")} /></label>
      </div>
      <label className="block"><span className="label">{t("What is it about?")}</span><textarea name="description" maxLength={500} rows={3} className="input resize-none" /></label>
      <fieldset>
        <legend className="label">{t("Who can join?")}</legend>
        <label className="flex items-start gap-3 py-1 text-sm"><input type="radio" name="privacy" value="public" defaultChecked className="mt-0.5 size-5 accent-brand-700" /><span><strong>{t("Public")}</strong> <span className="block text-black/55">{t("Anyone at school can join and read the posts.")}</span></span></label>
        <label className="flex items-start gap-3 py-1 text-sm"><input type="radio" name="privacy" value="private" className="mt-0.5 size-5 accent-brand-700" /><span><strong>{t("Private")}</strong> <span className="block text-black/55">{t("People ask to join and you approve them. Only members read the posts.")}</span></span></label>
      </fieldset>
      {official && (
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="official" className="mt-0.5 size-5 accent-brand-700" /><span><strong>{t("Official school group")}</strong> <span className="block text-black/55">{t("Shown with an Official label. For admins, the student council and school staff.")}</span></span></label>
      )}
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <SubmitButton className="btn-primary w-full">{t("Create group")}</SubmitButton>
    </form>
  );
}
