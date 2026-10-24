"use client";

import { useActionState } from "react";
import { cancelEvent, rescheduleEvent } from "@/app/actions/events";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";

// Cancel or move an event. Everyone who said they're going gets a notification.
export function ManageEvent({ eventId, startsAt, endsAt, minStart }: { eventId: string; startsAt: string; endsAt: string; minStart: string }) {
  const [moveState, move] = useActionState(rescheduleEvent, null);
  const [cancelState, cancel] = useActionState(cancelEvent, null);
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-semibold">Manage this event</summary>
      <form action={move} className="mt-4 space-y-3">
        <input type="hidden" name="eventId" value={eventId} />
        <p className="text-sm font-medium">Change the time</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input name="starts_at" type="datetime-local" required defaultValue={startsAt} min={minStart} className="input" aria-label="New start" />
          <input name="ends_at" type="datetime-local" defaultValue={endsAt} min={minStart} className="input" aria-label="New end" />
        </div>
        <FormMessage state={moveState} />
        <SubmitButton className="btn-secondary w-full">Save new time</SubmitButton>
      </form>
      <form action={cancel} className="mt-6 space-y-3 border-t border-black/5 pt-4">
        <input type="hidden" name="eventId" value={eventId} />
        <p className="text-sm font-medium">Cancel the event</p>
        <input name="reason" maxLength={300} className="input" placeholder="Why? (shown to everyone going)" />
        <FormMessage state={cancelState} />
        <SubmitButton className="btn-danger w-full" pendingText="Cancelling…">Cancel event</SubmitButton>
      </form>
    </details>
  );
}
