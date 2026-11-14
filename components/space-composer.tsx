"use client";

import { useActionState, useRef } from "react";
import { spacePost } from "@/app/actions/community";
import { makeT, type Locale } from "@/lib/i18n";

// A small box to post inside a group or a club. Leaders also see "Announcement".
export function SpaceComposer({ type, spaceId, canAnnounce, locale }: { type: "group" | "club"; spaceId: string; canAnnounce: boolean; locale: Locale }) {
  const t = makeT(locale);
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof spacePost>>, fd: FormData) => {
    const res = await spacePost(prev, fd);
    if (res?.ok) form.current?.reset();
    return res;
  }, null);
  return (
    <form ref={form} action={action} className="card space-y-2 p-4">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="spaceId" value={spaceId} />
      <textarea name="body" required maxLength={2000} rows={2} placeholder={t("Write something for the group…")} aria-label={t("Write something for the group…")} className="input resize-none" />
      <div className="flex flex-wrap items-center gap-2">
        <select name="kind" className="input w-auto py-1.5 text-sm" aria-label={t("Kind of post")} defaultValue="text">
          <option value="text">{t("Post")}</option>
          <option value="question">{t("Question")}</option>
          {canAnnounce && <option value="announcement">{t("Announcement")}</option>}
        </select>
        <button className="btn-primary ms-auto" disabled={pending}>{pending ? "…" : t("Post")}</button>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-brand-800">{state.message}</p>}
    </form>
  );
}
