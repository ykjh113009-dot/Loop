"use client";

import { useActionState } from "react";
import { contactCouncil, deleteCouncilPost, postCouncil, replyCouncilMessage, setCouncilInfo } from "@/app/actions/council";
import { makeT, type Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/errors";

function Msg({ state }: { state: ActionResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-red-700">{state.error}</p>;
  if (state?.message) return <p className="text-sm text-brand-800">{state.message}</p>;
  return null;
}

export function PostForm({ locale }: { locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(postCouncil, null);
  return (
    <form action={action} key={state?.message ? "done" : "form"} className="space-y-2">
      <select name="kind" defaultValue="announcement" className="input" aria-label={t("What are you posting?")}>
        <option value="announcement">{t("Announcement (tells the whole school)")}</option>
        <option value="update">{t("Update")}</option>
        <option value="initiative">{t("Initiative")}</option>
        <option value="activity">{t("Activity")}</option>
      </select>
      <input name="title" required minLength={3} maxLength={100} className="input" placeholder={t("Title")} aria-label={t("Title")} />
      <textarea name="body" rows={3} maxLength={2000} className="input resize-none" placeholder={t("Details")} aria-label={t("Details")} />
      <select name="status" defaultValue="planned" className="input" aria-label={t("Initiative status")}>
        <option value="planned">{t("Initiative: planned")}</option>
        <option value="in_progress">{t("Initiative: in progress")}</option>
        <option value="done">{t("Initiative: done")}</option>
      </select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" className="size-4 accent-brand-700" /> {t("Pin to the top")}</label>
      <Msg state={state} />
      <button disabled={pending} className="btn-primary w-full">{pending ? "…" : t("Post")}</button>
    </form>
  );
}

export function DeletePost({ id, locale }: { id: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(deleteCouncilPost, null);
  return (
    <form action={action}><input type="hidden" name="id" value={id} /><button disabled={pending} className="text-xs text-black/40 hover:text-red-600">{t("Delete")}</button><Msg state={state} /></form>
  );
}

export function InfoForm({ locale, info }: { locale: Locale; info: { about: string; contact_email: string; office: string; meeting_info: string } }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(setCouncilInfo, null);
  return (
    <form action={action} className="space-y-2">
      <textarea name="about" rows={2} maxLength={1000} defaultValue={info.about} className="input resize-none" placeholder={t("About the council")} aria-label={t("About the council")} />
      <input name="contact_email" type="email" maxLength={120} defaultValue={info.contact_email} className="input" placeholder={t("Contact email")} aria-label={t("Contact email")} />
      <input name="office" maxLength={120} defaultValue={info.office} className="input" placeholder={t("Where to find us, e.g. Room 3")} aria-label={t("Where to find us, e.g. Room 3")} />
      <input name="meeting_info" maxLength={300} defaultValue={info.meeting_info} className="input" placeholder={t("When we meet, e.g. Thursdays at lunch")} aria-label={t("When we meet, e.g. Thursdays at lunch")} />
      <Msg state={state} />
      <button disabled={pending} className="btn-secondary w-full">{pending ? "…" : t("Save")}</button>
    </form>
  );
}

export function ContactForm({ locale }: { locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(contactCouncil, null);
  return (
    <form action={action} key={state?.message ? "done" : "form"} className="space-y-2">
      <input name="subject" required minLength={3} maxLength={100} className="input" placeholder={t("Subject")} aria-label={t("Subject")} />
      <textarea name="body" required minLength={3} maxLength={1500} rows={3} className="input resize-none" placeholder={t("What would you like to tell or ask the council?")} aria-label={t("What would you like to tell or ask the council?")} />
      <Msg state={state} />
      <button disabled={pending} className="btn-primary w-full">{pending ? "…" : t("Send to the council")}</button>
      <p className="text-xs text-black/50">{t("Only the council and admins can read this. You will get the answer here and as a notification.")}</p>
    </form>
  );
}

export function ReplyForm({ id, locale }: { id: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(replyCouncilMessage, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <textarea name="reply" rows={2} maxLength={1500} className="input resize-none text-sm" placeholder={t("Your reply")} aria-label={t("Your reply")} />
      <Msg state={state} />
      <div className="flex gap-2">
        <button name="close" value="1" disabled={pending} className="btn-ghost flex-1">{t("Close without reply")}</button>
        <button disabled={pending} className="btn-primary flex-1">{pending ? "…" : t("Reply")}</button>
      </div>
    </form>
  );
}
