"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addTutorDocument, removeTutorDocument, saveTutorApplication } from "@/app/actions/tutoring";
import { Avatar } from "@/components/avatar";
import { PhotoField } from "@/components/photo-field";
import { createClient } from "@/lib/supabase/client";
import { DAYS, DOC_KINDS, DOC_TYPES, FORMATS, MAX_DOC_MB, TUTOR_SUBJECTS } from "@/lib/tutor";
import { makeT, type Locale } from "@/lib/i18n";
import { Glyph } from "@/components/glyph";

export type AppDraft = {
  grade: string; subjects: string[]; other_subjects: string; achievements: string; experience: string; qualifications: string;
  intro: string; motivation: string; topics: string; format: string; days: string[]; hours: string; preferred_times: string;
  availability_notes: string; photo_path: string | null;
};
export type DocRow = { id: string; name: string; kind: string; size: number };

const STEPS = ["Personal", "Academic", "About you", "Availability", "Documents", "Review"] as const;

function RemoveDoc({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(removeTutorDocument, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="text-xs text-black/45 hover:text-red-600" aria-label={label}><Glyph e="✕" /></button>
      {state?.error && <span className="text-xs text-red-700"> {state.error}</span>}
    </form>
  );
}

function Uploader({ schoolId, userId, locale }: { schoolId: string; userId: string; locale: Locale }) {
  const t = makeT(locale);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("cv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    const ext = DOC_TYPES[file.type];
    if (!ext) return setError(t("Use a PDF, a JPG or PNG picture, or a Word (.docx) file."));
    if (file.size > MAX_DOC_MB * 1024 * 1024) return setError(t("Keep each file under {n} MB.", { n: MAX_DOC_MB }));
    setBusy(true);
    const path = `${schoolId}/${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: up } = await createClient().storage.from("tutor-docs").upload(path, file, { contentType: file.type });
    if (up) { setBusy(false); return setError(t("The file didn't upload. Try again.")); }
    const result = await addTutorDocument(path, file.name.slice(0, 120), kind, file.size);
    setBusy(false);
    if (result?.error) return setError(result.error);
    if (input.current) input.current.value = "";
    router.refresh();
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="input" aria-label={t("Document type")}>
          {DOC_KINDS.map((k) => <option key={k.id} value={k.id}>{t(k.label)}</option>)}
        </select>
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn-secondary shrink-0">{busy ? "…" : `${t("Add file")}`}</button>
      </div>
      <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function ApplyForm({ initial, docs, user, locale, schoolId, userId, feedback }: {
  initial: AppDraft; docs: DocRow[]; user: { name: string; email: string; avatar: string }; locale: Locale; schoolId: string; userId: string; feedback?: string | null;
}) {
  const t = makeT(locale);
  const form = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState<Record<string, string | string[]> | null>(null);
  const [state, action, pending] = useActionState(saveTutorApplication, null);
  const [, start] = useTransition();

  function goTo(n: number) {
    if (n === 5 && form.current) {
      const fd = new FormData(form.current);
      const one = (k: string) => String(fd.get(k) ?? "").trim();
      setSummary({
        grade: one("grade"), subjects: [...fd.getAll("subject").map(String), ...one("other_subjects").split(/[,\n;]/).map((x) => x.trim()).filter(Boolean)],
        achievements: one("achievements"), experience: one("experience"), qualifications: one("qualifications"), intro: one("intro"),
        motivation: one("motivation"), topics: one("topics"), format: one("format"), days: fd.getAll("day").map(String), hours: one("hours"),
        preferred_times: one("preferred_times"), availability_notes: one("availability_notes"),
      });
    }
    setStep(n);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const field = "input";
  const row = (label: string, value: string | string[] | undefined) => (
    <div className="py-2"><dt className="text-xs text-black/45">{label}</dt><dd className="text-sm whitespace-pre-wrap">{(Array.isArray(value) ? value.join(", ") : value) || <span className="text-black/35">—</span>}</dd></div>
  );

  return (
    <form ref={form} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter); start(() => action(fd)); }} className="space-y-4">
      {initial.photo_path && <input type="hidden" name="keep_photo" value={initial.photo_path} />}
      {feedback && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><strong>{t("Feedback from the reviewers")}:</strong> {feedback}</p>}

      <ol className="flex gap-1" aria-label={t("Steps")}>
        {STEPS.map((s, i) => (
          <li key={s} className="min-w-0 flex-1">
            <button type="button" onClick={() => goTo(i)} aria-current={step === i ? "step" : undefined}
              className={`w-full rounded-lg px-1 py-1.5 text-center text-[11px] font-medium sm:text-xs ${step === i ? "bg-brand-700 text-white" : i < step ? "bg-brand-50 text-brand-800" : "bg-black/5 text-black/50"}`}>
              <span className="block truncate">{i + 1}. {t(s)}</span>
            </button>
          </li>
        ))}
      </ol>

      {/* A. Personal information, taken from the Loop account */}
      <section hidden={step !== 0} className="card space-y-4 p-4">
        <h2 className="section-title">{t("A. Personal information")}</h2>
        <div className="flex items-center gap-3">
          <Avatar avatar={user.avatar} size="lg" />
          <div className="min-w-0"><p className="font-semibold">{user.name}</p><p className="truncate text-sm text-black/55">{user.email}</p></div>
        </div>
        <p className="text-xs text-black/50">{t("We take your name, picture and school email from your Loop account. Change them in Edit profile.")}</p>
        <div>
          <p className="label">{t("Tutor photo (optional)")}</p>
          <PhotoField schoolId={schoolId} userId={userId} label={initial.photo_path ? t("Change tutor photo") : t("Use a different photo for tutoring")} />
          <p className="mt-1 text-xs text-black/45">{t("This only changes your tutor profile, not your account.")}</p>
        </div>
      </section>

      {/* B. Academic information */}
      <section hidden={step !== 1} className="card space-y-4 p-4">
        <h2 className="section-title">{t("B. Academic information")}</h2>
        <label className="block"><span className="label">{t("Current grade")}</span><input name="grade" maxLength={40} defaultValue={initial.grade} className={field} placeholder={t("e.g. Grade 11")} /></label>
        <fieldset><legend className="label">{t("Subjects you want to tutor")}</legend>
          <div className="flex flex-wrap gap-2">
            {TUTOR_SUBJECTS.map((s) => (
              <label key={s} className="rounded-full border border-black/10 px-3 py-1.5 text-sm has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:text-brand-900">
                <input type="checkbox" name="subject" value={s} defaultChecked={initial.subjects.includes(s)} className="sr-only" /> {s}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block"><span className="label">{t("Other subjects (separate with commas)")}</span><input name="other_subjects" maxLength={200} defaultValue={initial.other_subjects} className={field} /></label>
        <label className="block"><span className="label">{t("Relevant grades or achievements")}</span><textarea name="achievements" rows={3} maxLength={1000} defaultValue={initial.achievements} className={`${field} resize-none`} placeholder={t("e.g. Chemistry 96, SAT practice score 1480")} /></label>
        <label className="block"><span className="label">{t("Tutoring or teaching experience")} <span className="font-normal text-black/45">({t("optional")})</span></span><textarea name="experience" rows={2} maxLength={600} defaultValue={initial.experience} className={`${field} resize-none`} /></label>
        <label className="block"><span className="label">{t("Qualifications and certificates")} <span className="font-normal text-black/45">({t("if you have any")})</span></span><textarea name="qualifications" rows={2} maxLength={600} defaultValue={initial.qualifications} className={`${field} resize-none`} /></label>
      </section>

      {/* C. Tutor information */}
      <section hidden={step !== 2} className="card space-y-4 p-4">
        <h2 className="section-title">{t("C. About you as a tutor")}</h2>
        <label className="block"><span className="label">{t("Short introduction")} <span className="font-normal text-black/45">({t("shown on your profile")})</span></span><textarea name="intro" rows={3} maxLength={300} defaultValue={initial.intro} className={`${field} resize-none`} /></label>
        <label className="block"><span className="label">{t("Why do you want to become a tutor?")}</span><textarea name="motivation" rows={3} maxLength={600} defaultValue={initial.motivation} className={`${field} resize-none`} /></label>
        <label className="block"><span className="label">{t("Subjects and topics you feel confident teaching")}</span><textarea name="topics" rows={2} maxLength={600} defaultValue={initial.topics} className={`${field} resize-none`} /></label>
        <fieldset><legend className="label">{t("Preferred tutoring format")}</legend>
          <div className="flex flex-wrap gap-2">{FORMATS.map((f) => (
            <label key={f.id} className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm has-checked:border-brand-600 has-checked:bg-brand-50"><input type="radio" name="format" value={f.id} defaultChecked={initial.format === f.id} className="accent-brand-700" /> {t(f.label)}</label>
          ))}</div>
        </fieldset>
      </section>

      {/* D. Availability */}
      <section hidden={step !== 3} className="card space-y-4 p-4">
        <h2 className="section-title">{t("D. Availability")}</h2>
        <fieldset><legend className="label">{t("Days you are free")}</legend>
          <div className="flex flex-wrap gap-2">{DAYS.map((d) => (
            <label key={d.id} className="rounded-full border border-black/10 px-3.5 py-2 text-sm has-checked:border-brand-600 has-checked:bg-brand-700 has-checked:text-white"><input type="checkbox" name="day" value={d.id} defaultChecked={initial.days.includes(d.id)} className="sr-only" /> {t(d.label)}</label>
          ))}</div>
        </fieldset>
        <label className="block"><span className="label">{t("Hours")}</span><input name="hours" maxLength={100} defaultValue={initial.hours} className={field} placeholder="15:00–17:00" /></label>
        <label className="block"><span className="label">{t("Preferred times")}</span><input name="preferred_times" maxLength={100} defaultValue={initial.preferred_times} className={field} placeholder={t("e.g. After school, weekends")} /></label>
        <label className="block"><span className="label">{t("Anything else about your availability?")}</span><textarea name="availability_notes" rows={2} maxLength={300} defaultValue={initial.availability_notes} className={`${field} resize-none`} /></label>
      </section>

      {/* E. Supporting documents */}
      <section hidden={step !== 4} className="card space-y-3 p-4">
        <h2 className="section-title">{t("E. Supporting documents")}</h2>
        <p className="text-sm text-black/60">{t("A CV, certificates or academic records help the reviewers. Only you and the reviewers can open them. PDF, JPG, PNG or Word, up to {n} MB each.", { n: MAX_DOC_MB })}</p>
        <ul className="divide-y divide-black/5 text-sm">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 py-2"><span><Glyph e="📄" /></span><span className="min-w-0 flex-1 truncate">{d.name}</span><span className="chip bg-black/5">{t(DOC_KINDS.find((k) => k.id === d.kind)?.label ?? d.kind)}</span><RemoveDoc id={d.id} label={t("Remove")} /></li>
          ))}
          {docs.length === 0 && <li className="py-2 text-black/45">{t("No documents yet.")}</li>}
        </ul>
        {docs.length < 8 && <Uploader schoolId={schoolId} userId={userId} locale={locale} />}
      </section>

      {/* Review */}
      <section hidden={step !== 5} className="card space-y-2 p-4">
        <h2 className="section-title">{t("Review your application")}</h2>
        <p className="text-sm text-black/60">{t("Check everything. Reviewers will see all of this and your documents. Only your introduction, subjects, qualifications, experience and availability will be public.")}</p>
        <dl className="divide-y divide-black/5">
          {row(t("Name"), user.name)}{row(t("School email"), user.email)}
          {row(t("Grade"), summary?.grade)}{row(t("Subjects"), summary?.subjects)}{row(t("Grades and achievements"), summary?.achievements)}
          {row(t("Experience"), summary?.experience)}{row(t("Qualifications"), summary?.qualifications)}
          {row(t("Introduction"), summary?.intro)}{row(t("Why a tutor"), summary?.motivation)}{row(t("Topics"), summary?.topics)}
          {row(t("Format"), FORMATS.filter((f) => f.id === summary?.format).map((f) => t(f.label)))}
          {row(t("Days"), (summary?.days as string[] | undefined)?.map((d) => t(DAYS.find((x) => x.id === d)?.label ?? d)))}
          {row(t("Hours"), [summary?.hours, summary?.preferred_times].filter(Boolean) as string[])}{row(t("Availability notes"), summary?.availability_notes)}
          {row(t("Documents"), docs.map((d) => d.name))}
        </dl>
      </section>

      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.message && <p className="text-sm text-brand-800">{state.message}</p>}
      <div className="sticky bottom-16 z-10 flex gap-2 rounded-2xl bg-cream/90 p-2 backdrop-blur lg:bottom-4">
        {step > 0 && <button type="button" onClick={() => goTo(step - 1)} className="btn-secondary">‹ {t("Back")}</button>}
        <button name="intent" value="draft" disabled={pending} className="btn-ghost">{t("Save draft")}</button>
        {step < 5 ? (
          <button type="button" onClick={() => goTo(step + 1)} className="btn-primary ms-auto">{t("Next")} ›</button>
        ) : (
          <button name="intent" value="submit" disabled={pending} className="btn-primary ms-auto">{pending ? "…" : t("Submit application")}</button>
        )}
      </div>
    </form>
  );
}
