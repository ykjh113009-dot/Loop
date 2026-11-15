"use client";

import { useActionState } from "react";
import { askTutor, postStudyBuddy } from "@/app/actions/tutoring";
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
