"use client";

import { useActionState, useTransition } from "react";
import { updateMyTutorProfile } from "@/app/actions/tutoring";
import { PhotoField } from "@/components/photo-field";
import { DAYS, FORMATS } from "@/lib/tutor";
import { makeT, type Locale } from "@/lib/i18n";

type Current = { subjects: string[]; about: string; qualifications: string; experience: string; format: string; days: string[]; hours: string; preferred_times: string; photo_path: string | null; active: boolean };

export function MyProfileForm({ current, locale, schoolId, userId }: { current: Current; locale: Locale; schoolId: string; userId: string }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(updateMyTutorProfile, null);
  const [, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(() => action(fd)); }} className="card space-y-4 p-4">
      <p className="text-sm text-black/60">{t("Your approved subjects")}: <strong>{current.subjects.join(", ")}</strong>. {t("To teach a new subject, ask an admin.")}</p>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={current.active} className="size-5 accent-brand-700" /> {t("Show me in the Tutors Directory")}</label>
      <label className="block"><span className="label">{t("About me")}</span><textarea name="intro" rows={3} maxLength={300} defaultValue={current.about} className="input resize-none" /></label>
      <label className="block"><span className="label">{t("Qualifications")}</span><textarea name="qualifications" rows={2} maxLength={600} defaultValue={current.qualifications} className="input resize-none" /></label>
      <label className="block"><span className="label">{t("Experience")}</span><textarea name="experience" rows={2} maxLength={600} defaultValue={current.experience} className="input resize-none" /></label>
      <fieldset><legend className="label">{t("Format")}</legend>
        <div className="flex flex-wrap gap-2">{FORMATS.map((f) => (
          <label key={f.id} className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm has-checked:border-brand-600 has-checked:bg-brand-50"><input type="radio" name="format" value={f.id} defaultChecked={current.format === f.id} className="accent-brand-700" /> {t(f.label)}</label>
        ))}</div>
      </fieldset>
      <fieldset><legend className="label">{t("Days I am free")}</legend>
        <div className="flex flex-wrap gap-2">{DAYS.map((d) => (
          <label key={d.id} className="rounded-full border border-black/10 px-3 py-1.5 text-sm has-checked:border-brand-600 has-checked:bg-brand-700 has-checked:text-white"><input type="checkbox" name="day" value={d.id} defaultChecked={current.days.includes(d.id)} className="sr-only" /> {t(d.label)}</label>
        ))}</div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">{t("Hours")}</span><input name="hours" maxLength={100} defaultValue={current.hours} className="input" placeholder="15:00–17:00" /></label>
        <label className="block"><span className="label">{t("Preferred times")}</span><input name="preferred_times" maxLength={100} defaultValue={current.preferred_times} className="input" /></label>
      </div>
      <PhotoField schoolId={schoolId} userId={userId} label={current.photo_path ? t("Change tutor photo") : t("Use a different photo for tutoring")} />
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.message && <p className="text-sm text-brand-800">{state.message}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "…" : t("Save")}</button>
    </form>
  );
}
