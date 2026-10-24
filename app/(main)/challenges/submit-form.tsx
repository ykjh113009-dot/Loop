"use client";

import { useActionState } from "react";
import { submitChallenge } from "@/app/actions/challenges";
import { FormMessage } from "@/components/form-message";
import { PhotoField } from "@/components/photo-field";
import { SubmitButton } from "@/components/submit-button";

export function SubmitChallengeForm({ challengeId, schoolId, userId }: { challengeId: string; schoolId: string; userId: string }) {
  const [state, action] = useActionState(submitChallenge, null);
  if (state?.message) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="challengeId" value={challengeId} />
      <textarea name="note" required maxLength={1000} rows={2} placeholder="What did you do?" className="input resize-none" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PhotoField schoolId={schoolId} userId={userId} label="Photo (optional)" />
        <SubmitButton className="btn-primary" pendingText="Sending…">I did it!</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
