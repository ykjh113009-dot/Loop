"use client";

import { useActionState, useRef } from "react";
import { logHours } from "@/app/actions/volunteering";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function LogHoursForm({ today }: { today: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof logHours>>, fd: FormData) => {
    const result = await logHours(prev, fd);
    if (result?.message) form.current?.reset();
    return result;
  }, null);
  return (
    <form ref={form} action={action} className="card space-y-3 p-4">
      <h2 className="font-semibold">Log volunteering hours</h2>
      <input name="organization" required minLength={2} maxLength={100} placeholder="Where? e.g. Red Crescent, public library" className="input" />
      <textarea name="description" rows={2} maxLength={500} placeholder="What did you do?" className="input resize-none" />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          <span className="label">Date</span>
          <input type="date" name="activity_date" required max={today} defaultValue={today} className="input" />
        </label>
        <label className="text-sm">
          <span className="label">Hours</span>
          <input type="number" name="hours" required min={0.5} max={12} step={0.5} defaultValue={2} className="input" />
        </label>
      </div>
      <input name="supervisor_name" maxLength={80} placeholder="Supervisor's name (who can confirm it)" className="input" />
      <p className="text-xs text-black/50">Don&apos;t write phone numbers. A moderator checks your hours before they count.</p>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">Save hours</SubmitButton>
    </form>
  );
}
