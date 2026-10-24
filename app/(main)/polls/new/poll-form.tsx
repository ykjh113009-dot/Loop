"use client";

import { useActionState, useState } from "react";
import { createPoll } from "@/app/actions/polls";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function PollForm({ clubs, allowSchoolWide, minClose, defaultClose }: {
  clubs: { id: string; name: string; emoji: string }[];
  allowSchoolWide: boolean;
  minClose: string;
  defaultClose: string;
}) {
  const [state, action] = useActionState(createPoll, null);
  const [count, setCount] = useState(2);
  return (
    <form action={action} className="card space-y-4 p-4">
      <div>
        <label htmlFor="club_id" className="label">Who can vote?</label>
        <select id="club_id" name="club_id" className="input" defaultValue={allowSchoolWide ? "" : clubs[0]?.id}>
          {allowSchoolWide && <option value="">🏫 The whole school</option>}
          {clubs.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name} members</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="question" className="label">Question</label>
        <input id="question" name="question" required minLength={3} maxLength={200} className="input" placeholder="e.g. Which day is best for the trip?" />
      </div>
      <fieldset className="space-y-2">
        <legend className="label">Answers</legend>
        {Array.from({ length: count }, (_, i) => (
          <input key={i} name="option" required={i < 2} maxLength={80} placeholder={`Answer ${i + 1}`} className="input" />
        ))}
        {count < 6 && (
          <button type="button" onClick={() => setCount((c) => c + 1)} className="btn-ghost px-2 text-sm">+ Add answer</button>
        )}
      </fieldset>
      <div>
        <label htmlFor="closes_at" className="label">Closes</label>
        <input id="closes_at" name="closes_at" type="datetime-local" required min={minClose} defaultValue={defaultClose} className="input" />
      </div>
      <p className="text-xs text-black/50">Nobody can see who voted for what. Students see the totals after they vote.</p>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">Create poll</SubmitButton>
    </form>
  );
}
