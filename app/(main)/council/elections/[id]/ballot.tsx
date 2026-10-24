"use client";

import { useActionState } from "react";
import { castVote } from "@/app/actions/council";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function Ballot({ electionId, candidates }: { electionId: string; candidates: { id: string; name: string }[] }) {
  const [state, action] = useActionState(castVote, null);
  if (state?.message) return <FormMessage state={state} />;
  return (
    <form action={action} className="card space-y-2 p-4">
      <input type="hidden" name="electionId" value={electionId} />
      <p className="font-semibold">Your vote</p>
      {candidates.map((c) => (
        <label key={c.id} className="flex items-center gap-3 rounded-xl border border-black/10 px-3 py-2.5 text-sm has-checked:border-brand-600 has-checked:bg-brand-50">
          <input type="radio" name="candidate" value={c.id} required className="accent-brand-700" />
          {c.name}
        </label>
      ))}
      <p className="text-xs text-black/50">You can vote once. Nobody — not even admins — can see who you voted for.</p>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Voting…">Cast my vote</SubmitButton>
    </form>
  );
}
