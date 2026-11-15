"use client";

import { useActionState } from "react";
import { addStudyCategory, addStudyResource, removeStudyResource } from "@/app/actions/study";
import { makeT, type Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/errors";

function Msg({ state }: { state: ActionResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-red-700">{state.error}</p>;
  if (state?.message) return <p className="text-sm text-brand-800">{state.message}</p>;
  return null;
}

export function AddCategoryForm({ locale }: { locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(addStudyCategory, null);
  return (
    <form action={action} className="flex flex-wrap gap-2">
      <input name="emoji" maxLength={4} defaultValue="📘" className="input w-16 text-center" aria-label={t("Icon")} />
      <input name="name" required minLength={2} maxLength={60} className="input min-w-0 flex-1" placeholder={t("e.g. AP Statistics")} aria-label={t("Subject name")} />
      <button disabled={pending} className="btn-primary">{pending ? "…" : t("Add")}</button>
      <Msg state={state} />
    </form>
  );
}

export function AddResourceForm({ categoryId, locale }: { categoryId: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(addStudyResource, null);
  return (
    <form action={action} key={state?.message ? "done" : "form"} className="space-y-2">
      <input type="hidden" name="category" value={categoryId} />
      <input name="title" required minLength={3} maxLength={100} className="input" placeholder={t("Title")} />
      <input name="url" type="url" required maxLength={500} className="input" placeholder="https://" aria-label={t("Link")} />
      <div className="flex gap-2">
        <select name="kind" defaultValue="link" className="input" aria-label={t("Type")}>
          {[["link", "Link"], ["pdf", "PDF"], ["video", "Video"], ["notes", "Notes"], ["practice", "Practice questions"], ["other", "Other"]].map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
        </select>
      </div>
      <textarea name="description" rows={2} maxLength={500} className="input resize-none" placeholder={t("What is it, and who is it for? (optional)")} />
      <Msg state={state} />
      <button disabled={pending} className="btn-primary w-full">{pending ? "…" : t("Add resource")}</button>
    </form>
  );
}

export function RemoveResource({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(removeStudyResource, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="text-xs text-black/40 hover:text-red-600" aria-label={label}>✕</button>
      {state?.error && <span className="text-xs text-red-700"> {state.error}</span>}
    </form>
  );
}
