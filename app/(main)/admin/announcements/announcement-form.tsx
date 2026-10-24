"use client";

import { useActionState, useRef } from "react";
import { postAnnouncement } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";

export function AnnouncementForm() {
  const form = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof postAnnouncement>>, fd: FormData) => {
    const result = await postAnnouncement(prev, fd);
    if (result?.ok) form.current?.reset();
    return result;
  }, null);
  return (
    <form ref={form} action={action} className="card space-y-3 p-4">
      <input name="title" required maxLength={120} placeholder="Title" className="input font-semibold" />
      <textarea name="body" required maxLength={3000} rows={4} placeholder="Message to every student" className="input resize-none" />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Posting…">Post to everyone</SubmitButton>
    </form>
  );
}
