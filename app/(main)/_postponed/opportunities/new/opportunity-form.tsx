"use client";

import { useActionState, useTransition } from "react";
import { saveStudyOpportunity } from "@/app/actions/study";
import { OPP_CATEGORIES } from "@/lib/opportunities";
import { makeT, type Locale } from "@/lib/i18n";

export type OppDraft = {
  id?: string; category: string; title: string; organization: string; description: string; eligibility: string; deadline: string; link: string;
  instructions: string; extra_info: string; docs: { label: string; url: string }[]; is_sample: boolean; hidden: boolean;
};

export function OpportunityForm({ draft, locale }: { draft: OppDraft; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(saveStudyOpportunity, null);
  const [, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(() => action(fd)); }} className="card space-y-4 p-4">
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      <label className="block"><span className="label">{t("Category")}</span>
        <select name="category" defaultValue={draft.category} className="input">{OPP_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{t(c.label)}</option>)}</select>
      </label>
      <label className="block"><span className="label">{t("Title")}</span><input name="title" required minLength={3} maxLength={120} defaultValue={draft.title} className="input" /></label>
      <label className="block"><span className="label">{t("Organization or university")}</span><input name="organization" maxLength={120} defaultValue={draft.organization} className="input" /></label>
      <label className="block"><span className="label">{t("Description")}</span><textarea name="description" rows={4} maxLength={2000} defaultValue={draft.description} className="input resize-none" /></label>
      <label className="block"><span className="label">{t("Eligibility requirements")}</span><textarea name="eligibility" rows={2} maxLength={1000} defaultValue={draft.eligibility} className="input resize-none" /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">{t("Deadline")} <span className="font-normal text-black/45">({t("optional")})</span></span><input name="deadline" type="date" defaultValue={draft.deadline} className="input" /></label>
        <label className="block"><span className="label">{t("Application link")}</span><input name="link" type="url" maxLength={500} defaultValue={draft.link} className="input" placeholder="https://" /></label>
      </div>
      <label className="block"><span className="label">{t("How to apply")}</span><textarea name="instructions" rows={2} maxLength={1000} defaultValue={draft.instructions} className="input resize-none" /></label>
      <label className="block"><span className="label">{t("More information")}</span><textarea name="extra_info" rows={2} maxLength={1000} defaultValue={draft.extra_info} className="input resize-none" /></label>
      <fieldset className="space-y-2"><legend className="label">{t("Documents (links)")}</legend>
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <input name={`doc_label${i + 1}`} maxLength={80} defaultValue={draft.docs[i]?.label ?? ""} className="input" placeholder={t("Name")} aria-label={t("Document name")} />
            <input name={`doc_url${i + 1}`} type="url" maxLength={500} defaultValue={draft.docs[i]?.url ?? ""} className="input" placeholder="https://" aria-label={t("Document link")} />
          </div>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_sample" defaultChecked={draft.is_sample} className="size-5 accent-brand-700" /> {t("This is sample data (show a “Sample” label)")}</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="hidden" defaultChecked={draft.hidden} className="size-5 accent-brand-700" /> {t("Hide from students for now")}</label>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "…" : draft.id ? t("Save changes") : t("Publish")}</button>
    </form>
  );
}
