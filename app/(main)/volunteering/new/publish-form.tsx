"use client";

import { useActionState, useTransition } from "react";
import { publishOpportunity } from "@/app/actions/volunteering";
import { makeT, type Locale } from "@/lib/i18n";

export type OppDraft = { id?: string; title: string; description: string; requirements: string; location: string; spots: number | null; event_id: string; starts_at: string; ends_at: string };

export function PublishForm({ draft, events, locale }: { draft: OppDraft; events: { id: string; title: string }[]; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(publishOpportunity, null);
  const [, start] = useTransition();
  return (
    // Submitted by hand so a mistake does not wipe what was typed.
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(() => action(fd)); }} className="card space-y-4 p-4">
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      <div>
        <label htmlFor="title" className="label">{t("What do you need help with?")}</label>
        <input id="title" name="title" required minLength={3} maxLength={100} defaultValue={draft.title} className="input" placeholder={t("e.g. Set up chairs for the concert")} />
      </div>
      {events.length > 0 && !draft.id && (
        <div>
          <label htmlFor="event_id" className="label">{t("Is it for an event?")}</label>
          <select id="event_id" name="event_id" defaultValue={draft.event_id} className="input">
            <option value="">{t("No, general volunteering")}</option>
            {events.map((e) => <option key={e.id} value={e.id}>📅 {e.title}</option>)}
          </select>
        </div>
      )}
      {draft.id && <input type="hidden" name="event_id" value={draft.event_id} />}
      <div>
        <label htmlFor="description" className="label">{t("Details")}</label>
        <textarea id="description" name="description" rows={3} maxLength={1500} defaultValue={draft.description} className="input resize-none" />
      </div>
      <div>
        <label htmlFor="requirements" className="label">{t("What do volunteers need?")} <span className="font-normal text-black/45">({t("optional")})</span></label>
        <input id="requirements" name="requirements" maxLength={500} defaultValue={draft.requirements} className="input" placeholder={t("e.g. Wear the school t-shirt, arrive at 8:00")} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label htmlFor="starts_at" className="label">{t("Starts")} <span className="font-normal text-black/45">({t("optional")})</span></label><input id="starts_at" name="starts_at" type="datetime-local" defaultValue={draft.starts_at} className="input" /></div>
        <div><label htmlFor="ends_at" className="label">{t("Ends")} <span className="font-normal text-black/45">({t("optional")})</span></label><input id="ends_at" name="ends_at" type="datetime-local" defaultValue={draft.ends_at} className="input" /></div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label htmlFor="location" className="label">{t("Where?")}</label><input id="location" name="location" maxLength={100} defaultValue={draft.location} className="input" /></div>
        <div><label htmlFor="spots" className="label">{t("How many volunteers?")} <span className="font-normal text-black/45">({t("optional")})</span></label><input id="spots" name="spots" type="number" min={1} max={500} defaultValue={draft.spots ?? ""} className="input" /></div>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "…" : draft.id ? t("Save changes") : t("Publish")}</button>
    </form>
  );
}
