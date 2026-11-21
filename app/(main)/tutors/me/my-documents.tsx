"use client";

import { useActionState } from "react";
import { FileText, Eye, EyeOff } from "lucide-react";
import { setTutorDocPublic } from "@/app/actions/tutoring";
import { RemoveDoc, Uploader } from "../apply/apply-form";
import { DOC_KINDS } from "@/lib/tutor";
import { makeT, type Locale } from "@/lib/i18n";

type Doc = { id: string; name: string; kind: string; public_on_profile: boolean };

function ShareToggle({ doc, locale }: { doc: Doc; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(setTutorDocPublic, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={doc.id} />
      <input type="hidden" name="public" value={doc.public_on_profile ? "false" : "true"} />
      <button disabled={pending} aria-pressed={doc.public_on_profile} className={`opt px-3 py-1 text-xs ${doc.public_on_profile ? "opt-on" : ""}`} data-share-doc>
        {doc.public_on_profile ? <Eye className="size-3.5" aria-hidden="true" /> : <EyeOff className="size-3.5" aria-hidden="true" />}
        {doc.public_on_profile ? t("Shown on my profile") : t("Only me and reviewers")}
      </button>
      {state?.error && <span className="text-xs text-red-700"> {state.error}</span>}
    </form>
  );
}

// Approved tutors choose which documents (for example a CV) students can open from their tutor profile.
export function MyDocuments({ docs, locale, schoolId, userId }: { docs: Doc[]; locale: Locale; schoolId: string; userId: string }) {
  const t = makeT(locale);
  return (
    <section className="card mt-4 space-y-3 p-4" data-my-documents>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft text-brand-800"><FileText className="size-5" strokeWidth={1.7} aria-hidden="true" /></span>
        <div>
          <h2 className="font-heading text-[19px] leading-tight font-semibold text-brand-900">{t("CV and documents")}</h2>
          <p className="text-sm text-ink-2">{t("Add your CV or certificates, then choose which ones students can open from your tutor profile. Everything starts private.")}</p>
        </div>
      </div>
      <ul className="divide-y divide-black/5 text-sm">
        {docs.length === 0 && <li className="py-2 text-black/45">{t("No documents yet.")}</li>}
        {docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
            <FileText className="size-4 shrink-0 text-ink-2" aria-hidden="true" />
            <a href={`/api/tutor-doc/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-brand-700 underline">{d.name}</a>
            <span className="chip">{t(DOC_KINDS.find((k) => k.id === d.kind)?.label ?? d.kind)}</span>
            <ShareToggle doc={d} locale={locale} />
            <RemoveDoc id={d.id} label={t("Remove")} />
          </li>
        ))}
      </ul>
      {docs.length < 8 && <Uploader schoolId={schoolId} userId={userId} locale={locale} />}
    </section>
  );
}
