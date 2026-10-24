"use client";

import { useActionState, useRef } from "react";
import { replyCounselor, startCounselorRequest } from "@/app/actions/counselor";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export const TOPICS: Record<string, string> = {
  stress: "Stress or worry",
  friends: "Friends",
  family: "Family",
  school: "School work",
  future: "My future",
  other: "Something else",
};

export function CounselorRequestForm() {
  const [state, action] = useActionState(startCounselorRequest, null);
  return (
    <form action={action} className="card space-y-3 p-4">
      <label className="block text-sm">
        <span className="label">What is it about?</span>
        <select name="topic" className="input" defaultValue="stress">
          {Object.entries(TOPICS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <textarea name="message" required rows={4} maxLength={2000} placeholder="Write as much or as little as you like. You can also just ask for a time to talk." className="input resize-none" />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="urgent" className="mt-0.5 size-5 accent-red-600" />
        <span>It&apos;s urgent — I need to talk today</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Sending…">Send privately</SubmitButton>
    </form>
  );
}

export function ReplyForm({ requestId }: { requestId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof replyCounselor>>, fd: FormData) => {
    const result = await replyCounselor(prev, fd);
    if (!result?.error) form.current?.reset();
    return result;
  }, null);
  return (
    <form ref={form} action={action} className="space-y-2">
      <input type="hidden" name="requestId" value={requestId} />
      <textarea name="body" required rows={3} maxLength={2000} placeholder="Write a message…" className="input resize-none" />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Sending…">Send</SubmitButton>
    </form>
  );
}
