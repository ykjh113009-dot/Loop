"use client";

import { useActionState } from "react";
import { createEvent } from "@/app/actions/events";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";

export function EventForm({
  clubs,
  allowSchoolWide,
  defaultClub,
  minStart,
}: {
  clubs: { id: string; name: string; emoji: string }[];
  allowSchoolWide: boolean;
  defaultClub?: string;
  minStart: string;
}) {
  const [state, action] = useActionState(createEvent, null);
  return (
    <form action={action} className="card space-y-4 p-4">
      <div>
        <label htmlFor="club_id" className="label">Who is it for?</label>
        <select id="club_id" name="club_id" defaultValue={defaultClub ?? (allowSchoolWide ? "" : clubs[0]?.id)} className="input">
          {allowSchoolWide && <option value="">🏫 The whole school</option>}
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="title" className="label">Title</label>
        <input id="title" name="title" required minLength={3} maxLength={100} className="input" placeholder="e.g. Arduino workshop" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="starts_at" className="label">Starts</label>
          <input id="starts_at" name="starts_at" type="datetime-local" required min={minStart} className="input" />
        </div>
        <div>
          <label htmlFor="ends_at" className="label">Ends <span className="font-normal text-black/45">(optional)</span></label>
          <input id="ends_at" name="ends_at" type="datetime-local" min={minStart} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="location" className="label">Where?</label>
        <input id="location" name="location" maxLength={100} className="input" placeholder="e.g. Computer lab 2" />
      </div>
      <div>
        <label htmlFor="description" className="label">Details</label>
        <textarea id="description" name="description" rows={4} maxLength={1500} className="input resize-none" placeholder="What will happen? What should people bring?" />
      </div>
      {!allowSchoolWide && <p className="text-xs text-black/50">A moderator will approve the event before it shows on the calendar.</p>}
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Saving…">
        {allowSchoolWide ? "Create event" : "Send for approval"}
      </SubmitButton>
    </form>
  );
}
