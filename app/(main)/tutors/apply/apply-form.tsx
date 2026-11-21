"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addTutorDocument, removeTutorDocument, saveTutorApplication } from "@/app/actions/tutoring";
import { Avatar } from "@/components/avatar";
import { Briefcase, CalendarDays, Camera, Check, FileText, Heart, MessageSquare, Send, UserRound, BookOpen } from "lucide-react";
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

const GRADES = ["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

function RemoveDoc({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(removeTutorDocument, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="rounded-full p-1 text-black/45 hover:bg-red-50 hover:text-red-600" aria-label={label}><Glyph e="✕" /></button>
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

// A card for one part of the application: a line icon, a title and a hint, then the fields.
function Section({ icon: Icon, title, hint, children }: { icon: typeof UserRound; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft text-brand-800"><Icon className="size-5" strokeWidth={1.7} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] leading-tight font-semibold text-brand-900">{title}</h2>
          {hint && <p className="text-sm text-ink-2">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// A text area with a live "0 / 300" count.
function Counted({ name, max, rows = 3, defaultValue, placeholder, label }: { name: string; max: number; rows?: number; defaultValue: string; placeholder?: string; label: string }) {
  const [n, setN] = useState(defaultValue.length);
  return (
    <div className="relative">
      <textarea name={name} rows={rows} maxLength={max} defaultValue={defaultValue} placeholder={placeholder} aria-label={label} onChange={(e) => setN(e.target.value.length)} className="input resize-none pb-7" />
      <span className="pointer-events-none absolute end-3 bottom-2 text-xs text-ink-2 tabular-nums">{n} / {max}</span>
    </div>
  );
}

export function ApplyForm({ initial, docs, user, locale, schoolId, userId, feedback }: {
  initial: AppDraft; docs: DocRow[]; user: { name: string; email: string; avatar: string }; locale: Locale; schoolId: string; userId: string; feedback?: string | null;
}) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(saveTutorApplication, null);
  const [, start] = useTransition();
  const grades = GRADES.includes(initial.grade) || !initial.grade ? GRADES : [initial.grade, ...GRADES];
  const readOnly = "input bg-black/[0.03] text-ink-2";

  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter); start(() => action(fd)); }} className="space-y-4">
      {initial.photo_path && <input type="hidden" name="keep_photo" value={initial.photo_path} />}
      {feedback && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><strong>{t("Feedback from the reviewers")}:</strong> {feedback}</p>}

      <Section icon={UserRound} title={t("Your Information")} hint={t("We take your name and school email from your Loop account. Change them in Edit profile.")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="ta-name">{t("Full Name")}</label><input id="ta-name" value={user.name} readOnly className={readOnly} /></div>
          <div><label className="label" htmlFor="ta-grade">{t("Grade")} *</label>
            <select id="ta-grade" name="grade" defaultValue={initial.grade} required className="input">
              <option value="" disabled>{t("Select your grade")}</option>
              {grades.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div><label className="label" htmlFor="ta-email">{t("School Email")}</label><input id="ta-email" value={user.email} readOnly className={readOnly} /></div>
      </Section>

      <Section icon={BookOpen} title={t("Subjects You Can Tutor")} hint={t("Select all subjects you feel confident in:")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {TUTOR_SUBJECTS.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink transition-colors hover:border-brand-700/30 hover:bg-sage-soft/50 has-checked:border-brand-700 has-checked:bg-brand-700 has-checked:text-white has-checked:hover:bg-brand-800 has-focus-visible:ring-2 has-focus-visible:ring-brand-600">
              <input type="checkbox" name="subject" value={s} defaultChecked={initial.subjects.includes(s)} className="peer sr-only" />
              <span className="grid size-[18px] shrink-0 place-items-center rounded-md border border-black/25 bg-white text-transparent peer-checked:border-white peer-checked:text-brand-700"><Check className="size-3.5" strokeWidth={3} aria-hidden="true" /></span>
              <span className="min-w-0 truncate">{s}</span>
            </label>
          ))}
        </div>
        <div><label className="label" htmlFor="ta-other">{t("Other subjects (separate with commas)")}</label><input id="ta-other" name="other_subjects" maxLength={200} defaultValue={initial.other_subjects} className="input" /></div>
      </Section>

      <Section icon={Camera} title={t("Profile Photo")} hint={t("Upload a clear photo of yourself (optional but recommended).")}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1 rounded-2xl border-2 border-dashed border-brand-700/20 bg-sage-soft/20 p-4 text-center">
            <div className="flex justify-center"><PhotoField schoolId={schoolId} userId={userId} label={initial.photo_path ? t("Change tutor photo") : t("Upload a photo")} /></div>
            <p className="mt-2 text-xs text-ink-2">{t("This only changes your tutor profile, not your account.")}</p>
          </div>
          <Avatar avatar={user.avatar} size="lg" />
        </div>
      </Section>

      <Section icon={MessageSquare} title={t("About Me / Tutor Bio")} hint={t("Write a short introduction about yourself. This will appear on your tutor profile.")}>
        <Counted name="intro" max={300} rows={3} defaultValue={initial.intro} label={t("Short introduction")} placeholder={t("e.g. I'm a Grade 11 student who loves math and has helped many classmates...")} />
        <div>
          <label className="label" htmlFor="ta-topics">{t("Subjects and topics you feel confident teaching")}</label>
          <textarea id="ta-topics" name="topics" rows={2} maxLength={600} defaultValue={initial.topics} className="input resize-none" />
        </div>
        <fieldset><legend className="label">{t("Preferred tutoring format")}</legend>
          <div className="flex flex-wrap gap-2">{FORMATS.map((f) => (
            <label key={f.id} className="opt cursor-pointer has-checked:border-brand-700 has-checked:bg-brand-700 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-brand-600"><input type="radio" name="format" value={f.id} defaultChecked={initial.format === f.id} className="sr-only" />{t(f.label)}</label>
          ))}</div>
        </fieldset>
      </Section>

      <Section icon={Briefcase} title={t("Your Experience")} hint={t("Tell us about your tutoring experience, relevant skills, or any past teaching.")}>
        <Counted name="experience" max={600} rows={3} defaultValue={initial.experience} label={t("Tutoring or teaching experience")} placeholder={t("e.g. I've tutored math before, or I'm great at explaining concepts...")} />
        <div><label className="label" htmlFor="ta-ach">{t("Relevant grades or achievements")}</label><textarea id="ta-ach" name="achievements" rows={2} maxLength={1000} defaultValue={initial.achievements} className="input resize-none" placeholder={t("e.g. Chemistry 96, SAT practice score 1480")} /></div>
        <div><label className="label" htmlFor="ta-qual">{t("Qualifications and certificates")} <span className="font-normal text-black/45">({t("if you have any")})</span></label><textarea id="ta-qual" name="qualifications" rows={2} maxLength={600} defaultValue={initial.qualifications} className="input resize-none" /></div>
      </Section>

      <Section icon={Heart} title={t("Why do you want to be a Loop Tutor?")} hint={t("Share your motivation and what you hope to achieve.")}>
        <Counted name="motivation" max={600} rows={3} defaultValue={initial.motivation} label={t("Why do you want to become a tutor?")} placeholder={t("e.g. I want to help students and be part of the Loop community...")} />
      </Section>

      <Section icon={CalendarDays} title={t("Availability")} hint={t("Days you are free")}>
        <fieldset>
          <legend className="sr-only">{t("Days you are free")}</legend>
          <div className="flex flex-wrap gap-2">{DAYS.map((d) => (
            <label key={d.id} className="opt cursor-pointer has-checked:border-brand-700 has-checked:bg-brand-700 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-brand-600"><input type="checkbox" name="day" value={d.id} defaultChecked={initial.days.includes(d.id)} className="sr-only" /> {t(d.label)}</label>
          ))}</div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="ta-hours">{t("Hours")}</label><input id="ta-hours" name="hours" maxLength={100} defaultValue={initial.hours} className="input" placeholder="15:00–17:00" /></div>
          <div><label className="label" htmlFor="ta-times">{t("Preferred times")}</label><input id="ta-times" name="preferred_times" maxLength={100} defaultValue={initial.preferred_times} className="input" placeholder={t("e.g. After school, weekends")} /></div>
        </div>
        <div><label className="label" htmlFor="ta-notes">{t("Anything else about your availability?")}</label><textarea id="ta-notes" name="availability_notes" rows={2} maxLength={300} defaultValue={initial.availability_notes} className="input resize-none" /></div>
      </Section>

      <Section icon={FileText} title={t("Supporting documents")} hint={t("A CV, certificates or academic records help the reviewers. Only you and the reviewers can open them. PDF, JPG, PNG or Word, up to {n} MB each.", { n: MAX_DOC_MB })}>
        <ul className="divide-y divide-black/5 text-sm">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 py-2"><FileText className="size-4 shrink-0 text-ink-2" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{d.name}</span><span className="chip">{t(DOC_KINDS.find((k) => k.id === d.kind)?.label ?? d.kind)}</span><RemoveDoc id={d.id} label={t("Remove")} /></li>
          ))}
          {docs.length === 0 && <li className="py-2 text-black/45">{t("No documents yet.")}</li>}
        </ul>
        {docs.length < 8 && <Uploader schoolId={schoolId} userId={userId} locale={locale} />}
      </Section>

      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.message && <p className="text-sm text-brand-800">{state.message}</p>}

      <div className="card space-y-3 p-5">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" name="agree" required className="mt-0.5 size-4" />
          <span>{t("I agree to the Loop Tutor Guidelines.")}</span>
        </label>
        <button name="intent" value="submit" disabled={pending} className="btn-primary w-full rounded-full py-3 text-[15px]">
          <Send className="size-4" aria-hidden="true" />{pending ? "…" : t("Submit application")}
        </button>
        <button name="intent" value="draft" formNoValidate disabled={pending} className="btn-secondary w-full rounded-full">{t("Save draft")}</button>
      </div>
    </form>
  );
}
