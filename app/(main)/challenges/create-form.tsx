"use client";

import { useActionState } from "react";
import { createChallenge } from "@/app/actions/challenges";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function CreateChallengeForm({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [state, action] = useActionState(createChallenge, null);
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-semibold">+ New challenge (moderators)</summary>
      <form action={action} className="mt-3 space-y-3">
        <div className="flex gap-2">
          <input name="emoji" defaultValue="🏁" maxLength={8} className="input w-16 text-center" aria-label="Emoji" />
          <input name="title" required minLength={3} maxLength={100} placeholder="e.g. Drink 6 glasses of water a day" className="input" />
        </div>
        <textarea name="description" rows={3} maxLength={1000} placeholder="What should students do, and how do they show it?" className="input resize-none" />
        <div className="grid grid-cols-3 gap-2">
          <label className="text-sm">
            <span className="label">Starts</span>
            <input type="date" name="starts" required defaultValue={defaultStart} className="input" />
          </label>
          <label className="text-sm">
            <span className="label">Last day</span>
            <input type="date" name="ends" required defaultValue={defaultEnd} className="input" />
          </label>
          <label className="text-sm">
            <span className="label">Points</span>
            <input type="number" name="points" min={5} max={100} defaultValue={20} className="input" />
          </label>
        </div>
        <FormMessage state={state} />
        <SubmitButton className="btn-primary w-full">Create challenge</SubmitButton>
      </form>
    </details>
  );
}
