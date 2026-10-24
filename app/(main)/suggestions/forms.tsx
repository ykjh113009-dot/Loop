"use client";

import { useActionState, useRef } from "react";
import { respondSuggestion, sendSuggestion } from "@/app/actions/suggestions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export const SUGGESTION_CATEGORIES: Record<string, string> = {
  activities: "🎉 Activities",
  facilities: "🏫 Buildings & facilities",
  clubs: "🧩 Clubs",
  events: "📅 Events",
  app: "📱 Pbs Go app",
  other: "💬 Other",
};

export function SuggestionForm() {
  const form = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof sendSuggestion>>, fd: FormData) => {
    const result = await sendSuggestion(prev, fd);
    if (result?.message) form.current?.reset();
    return result;
  }, null);
  return (
    <form ref={form} action={action} className="card space-y-3 p-4">
      <p className="font-semibold">Got an idea for the school?</p>
      <select name="category" className="input" aria-label="Category" defaultValue="activities">
        {Object.entries(SUGGESTION_CATEGORIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
      <input name="title" required minLength={3} maxLength={100} placeholder="Your idea in a few words" className="input" />
      <textarea name="body" rows={3} maxLength={1500} placeholder="Explain it (optional)" className="input resize-none" />
      <p className="text-xs text-black/50">Only you, the student council and school admins can see your suggestion.</p>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Sending…">Send</SubmitButton>
    </form>
  );
}

export function RespondForm({ id, status, response }: { id: string; status: string; response: string | null }) {
  const [state, action] = useActionState(respondSuggestion, null);
  return (
    <form action={action} className="mt-2 space-y-2 border-t border-black/5 pt-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-2">
        <select name="status" defaultValue={status === "new" ? "reviewing" : status} className="input w-auto text-sm" aria-label="Status">
          <option value="reviewing">Looking at it</option>
          <option value="planned">Planned</option>
          <option value="done">Done</option>
          <option value="declined">Not this time</option>
        </select>
        <SubmitButton className="btn-primary shrink-0 px-3" pendingText="…">Update</SubmitButton>
      </div>
      <textarea name="response" rows={2} maxLength={1000} defaultValue={response ?? ""} placeholder="Reply to the student (optional)" className="input resize-none text-sm" />
      <FormMessage state={state} />
    </form>
  );
}
