"use client";

import { useActionState } from "react";
import { askTutor, postStudyBuddy, submitTutorReview } from "@/app/actions/tutoring";
import { useState } from "react";
import { Star } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { SUBJECTS } from "@/lib/subjects";

// After a finished session: choose 1 to 5 stars and say how it went.
export function ReviewForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(submitTutorReview, null);
  const [stars, setStars] = useState(0);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-2 rounded-2xl bg-sage-soft/40 p-3" data-review-form>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="rating" value={stars} />
      <p className="text-sm font-semibold">How was your session?</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={stars === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => setStars(i)} className="rounded p-0.5">
            <Star className={`size-7 ${i <= stars ? "fill-amber-400 text-amber-500" : "text-black/25"}`} strokeWidth={1.6} aria-hidden="true" />
          </button>
        ))}
      </div>
      <textarea name="comment" rows={2} maxLength={500} placeholder="Say a few words about the session (optional)" className="input resize-none" />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary rounded-full px-5 py-2 text-sm" pendingText="Sending…">Send review</SubmitButton>
    </form>
  );
}

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
