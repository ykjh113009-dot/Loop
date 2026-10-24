"use client";

import { useActionState } from "react";
import { vote } from "@/app/actions/polls";
import { SubmitButton } from "@/components/submit-button";

export function VoteForm({ pollId, options }: { pollId: string; options: string[] }) {
  const [state, action] = useActionState(vote, null);
  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="pollId" value={pollId} />
      {options.map((option, i) => (
        <label key={i} className="flex items-center gap-3 rounded-xl border border-black/10 px-3 py-2 text-sm has-checked:border-brand-600 has-checked:bg-brand-50">
          <input type="radio" name="option" value={i} required className="accent-brand-700" />
          {option}
        </label>
      ))}
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <SubmitButton className="btn-primary w-full" pendingText="Voting…">Vote</SubmitButton>
    </form>
  );
}
