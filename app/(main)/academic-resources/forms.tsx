"use client";

import { useActionState } from "react";
import { useState, useTransition } from "react";
import { addStudyCategory, setSubjectImage } from "@/app/actions/study";
import { uploadPhoto } from "@/lib/upload";
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

// Admins: a picture for each subject card.
export function SubjectPhotos({ subjects, schoolId, userId, locale }: { subjects: { id: string; name: string; url: string | null }[]; schoolId: string; userId: string; locale: Locale }) {
  const t = makeT(locale);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  function pick(id: string, file: File | undefined) {
    if (!file) return;
    setMsg(null);
    start(async () => {
      const up = await uploadPhoto(file, schoolId, userId);
      if (up.error) return setMsg(up.error);
      const r = await setSubjectImage(id, up.path!);
      setMsg(r?.error ?? t("Picture saved."));
    });
  }
  return (
    <ul className="space-y-2" data-subject-photos>
      {subjects.map((s) => (
        <li key={s.id} className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sage-soft/50">
            {s.url
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
              ? <img src={s.url} alt="" className="size-full object-cover" />
              : <span className="text-xs text-black/40">{t("none")}</span>}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
          <label className="btn-secondary cursor-pointer text-xs">
            {s.url ? t("Change") : t("Add picture")}
            <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => pick(s.id, e.target.files?.[0])} aria-label={`${t("Picture for")} ${s.name}`} data-subject-file={s.name} />
          </label>
          {s.url && <button type="button" disabled={busy} onClick={() => start(async () => { const r = await setSubjectImage(s.id, null); setMsg(r?.error ?? t("Picture removed.")); })} className="text-xs text-black/50 underline">{t("Remove")}</button>}
        </li>
      ))}
      {msg && <li role="status" className="text-sm text-brand-800">{msg}</li>}
    </ul>
  );
}
