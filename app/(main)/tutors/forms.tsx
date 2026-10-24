"use client";

import { useActionState } from "react";
import { askTutor, postStudyBuddy, saveTutorProfile } from "@/app/actions/tutoring";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { SUBJECTS } from "@/lib/subjects";

export function AskTutorForm({ tutorId, subjects }: { tutorId: string; subjects: string[] }) {
  const [state, action] = useActionState(askTutor, null);
  if (state?.message) return <FormMessage state={state} />;
  return (
    <details className="text-sm">
      <summary className="btn-primary inline-flex cursor-pointer list-none px-3 py-2">Ask for help</summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="tutorId" value={tutorId} />
        <select name="subject" className="input" aria-label="Subject">
          {subjects.map((s) => <option key={s}>{s}</option>)}
        </select>
        <textarea name="message" rows={2} maxLength={500} placeholder="What do you need help with?" className="input resize-none" />
        <FormMessage state={state} />
        <SubmitButton className="btn-primary w-full" pendingText="Sending…">Send request</SubmitButton>
      </form>
    </details>
  );
}

export function StudyBuddyForm() {
  const [state, action] = useActionState(postStudyBuddy, null);
  return (
    <form action={action} className="card space-y-2 p-4">
      <p className="font-semibold">Looking for a study buddy?</p>
      <select name="subject" className="input" aria-label="Subject" defaultValue="">
        <option value="" disabled>Subject…</option>
        {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
      </select>
      <textarea name="note" required minLength={3} maxLength={300} rows={2} placeholder="e.g. Solving past math exams on Tuesdays after school" className="input resize-none" />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Posting…">Post</SubmitButton>
    </form>
  );
}

export function TutorProfileForm({ current }: { current: { subjects: string[]; about: string; availability: string; active: boolean } | null }) {
  const [state, action] = useActionState(saveTutorProfile, null);
  return (
    <form action={action} className="card space-y-4 p-4">
      <fieldset>
        <legend className="label">Subjects I can help with</legend>
        <div className="flex flex-wrap gap-1.5">
          {SUBJECTS.filter((s) => s !== "Other").map((s) => (
            <label key={s} className="cursor-pointer">
              <input type="checkbox" name="subject" value={s} defaultChecked={current?.subjects.includes(s)} className="peer sr-only" />
              <span className="block rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:font-semibold peer-checked:text-brand-800">
                {s}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <textarea name="about" rows={2} maxLength={300} defaultValue={current?.about} placeholder="How do you like to help? e.g. step by step, with past exams…" className="input resize-none" />
      <input name="availability" maxLength={100} defaultValue={current?.availability} placeholder="When? e.g. Mon & Wed after school, library" className="input" />
      {current && (
        <label className="block text-sm">
          <span className="label">Taking new requests?</span>
          <select name="active" defaultValue={current.active ? "on" : "off"} className="input">
            <option value="on">Yes — show me in the tutor list</option>
            <option value="off">No — hide me for now</option>
          </select>
        </label>
      )}
      <p className="text-xs text-black/50">You always meet at school. You get 15 points for your grade each time you help someone.</p>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">{current ? "Save" : "Become a tutor"}</SubmitButton>
    </form>
  );
}
