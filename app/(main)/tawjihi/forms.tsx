"use client";

import { useActionState, useRef } from "react";
import { answerQuestion, askQuestion } from "@/app/actions/tawjihi";
import { TAWJIHI_TOPICS } from "@/lib/subjects";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function AskForm() {
  const [state, action] = useActionState(askQuestion, null);
  return (
    <form action={action} className="card space-y-3 p-4">
      <select name="subject" required defaultValue="" className="input" aria-label="Topic">
        <option value="" disabled>Topic…</option>
        {TAWJIHI_TOPICS.map((t) => <option key={t}>{t}</option>)}
      </select>
      <input name="title" required minLength={5} maxLength={150} placeholder="Your question, e.g. How should I plan the last month?" className="input" />
      <textarea name="body" rows={4} maxLength={2000} placeholder="More details (optional)" className="input resize-none" />
      <p className="text-xs text-black/50">Your name is shown with your question. Classmates and alumni mentors can answer.</p>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Posting…">Ask</SubmitButton>
    </form>
  );
}

export function AnswerForm({ questionId }: { questionId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof answerQuestion>>, fd: FormData) => {
    const result = await answerQuestion(prev, fd);
    if (!result?.error) form.current?.reset();
    return result;
  }, null);
  return (
    <form ref={form} action={action} className="card space-y-2 p-4">
      <input type="hidden" name="questionId" value={questionId} />
      <textarea name="body" required rows={3} maxLength={2000} placeholder="Share what worked for you…" className="input resize-none" />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Posting…">Answer</SubmitButton>
    </form>
  );
}
