"use client";

import { useActionState, useState, useTransition } from "react";
import { createEvent, updateEvent } from "@/app/actions/events";
import { PhotoField } from "@/components/photo-field";
import { EVENT_CATEGORIES } from "@/lib/events";
import { makeT, type Locale } from "@/lib/i18n";
import { Glyph } from "@/components/glyph";

export type EventDraft = {
  id?: string; title: string; description: string; location: string; category: string; club_id: string;
  starts_at: string; ends_at: string; capacity: number | null; cover_path: string | null; organizers: string[];
};

type Person = { id: string; name: string };

// Pick a few people for the organizing team.
function TeamPicker({ people, initial, t }: { people: Person[]; initial: string[]; t: ReturnType<typeof makeT> }) {
  const [ids, setIds] = useState(initial);
  const [q, setQ] = useState("");
  const chosen = ids.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  const matches = q.trim().length >= 2 ? people.filter((p) => !ids.includes(p.id) && p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  return (
    <div className="space-y-2">
      <input type="hidden" name="organizers_present" value="1" />
      {ids.map((id) => <input key={id} type="hidden" name="organizers" value={id} />)}
      <div className="flex flex-wrap gap-1.5">
        {chosen.map((p) => (
          <button key={p.id} type="button" onClick={() => setIds(ids.filter((x) => x !== p.id))} className="chip bg-brand-50 text-brand-900">{p.name} <Glyph e="✕" /></button>
        ))}
      </div>
      {ids.length < 8 && <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder={t("Type a name to add someone")} />}
      {matches.length > 0 && (
        <ul className="card divide-y divide-black/5 text-sm">
          {matches.map((p) => (
            <li key={p.id}><button type="button" onClick={() => { setIds([...ids, p.id]); setQ(""); }} className="w-full px-3 py-2 text-start hover:bg-black/[0.03]">{p.name}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EventForm({ draft, clubs, direct, minStart, schoolId, userId, locale, people, canSetTeam }: {
  draft: EventDraft; clubs: { id: string; name: string; emoji: string }[]; direct: boolean; minStart: string;
  schoolId: string; userId: string; locale: Locale; people: Person[]; canSetTeam: boolean;
}) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(draft.id ? updateEvent : createEvent, null);
  const [, start] = useTransition();
  return (
    // Submitted by hand so a mistake does not wipe what the student typed.
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(() => action(fd)); }} className="card space-y-4 p-4">
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      {draft.cover_path && <input type="hidden" name="keep_cover" value={draft.cover_path} />}
      {!draft.id && (
        <div>
          <label htmlFor="club_id" className="label">{t("Who is it for?")}</label>
          <select id="club_id" name="club_id" defaultValue={draft.club_id} className="input">
            <option value="">{t("The whole school")}</option>
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      {draft.id && <input type="hidden" name="club_id" value={draft.club_id} />}
      <div>
        <label htmlFor="title" className="label">{t("Title")}</label>
        <input id="title" name="title" required minLength={3} maxLength={100} defaultValue={draft.title} className="input" placeholder={t("e.g. Arduino workshop")} />
      </div>
      <div>
        <label htmlFor="category" className="label">{t("Category")}</label>
        <select id="category" name="category" defaultValue={draft.category} className="input">
          {EVENT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{t(c.label)}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="starts_at" className="label">{t("Starts")}</label>
          <input id="starts_at" name="starts_at" type="datetime-local" required min={draft.id ? undefined : minStart} defaultValue={draft.starts_at} className="input" />
        </div>
        <div>
          <label htmlFor="ends_at" className="label">{t("Ends")} <span className="font-normal text-black/45">({t("optional")})</span></label>
          <input id="ends_at" name="ends_at" type="datetime-local" defaultValue={draft.ends_at} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="location" className="label">{t("Where?")}</label>
        <input id="location" name="location" maxLength={100} defaultValue={draft.location} className="input" placeholder={t("e.g. Computer lab 2")} />
      </div>
      <div>
        <label htmlFor="description" className="label">{t("Details")}</label>
        <textarea id="description" name="description" rows={4} maxLength={1500} defaultValue={draft.description} className="input resize-none" placeholder={t("What will happen? What should people bring?")} />
      </div>
      <div>
        <label htmlFor="capacity" className="label">{t("Limit the number of people")} <span className="font-normal text-black/45">({t("optional")})</span></label>
        <input id="capacity" name="capacity" type="number" min={1} max={5000} defaultValue={draft.capacity ?? ""} className="input" />
        <p className="mt-1 text-xs text-black/50">{t("Anyone can come by default. If you set a limit, extra students join a waiting list.")}</p>
      </div>
      <PhotoField schoolId={schoolId} userId={userId} label={draft.cover_path ? t("Change cover photo") : t("Add a cover photo")} />
      {canSetTeam && (
        <div>
          <p className="label">{t("Organizing team")}</p>
          <TeamPicker people={people} initial={draft.organizers} t={t} />
        </div>
      )}
      {!direct && !draft.id && <p className="text-xs text-black/50">{t("An admin will approve your event before it shows on the calendar.")}</p>}
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "…" : draft.id ? t("Save changes") : direct ? t("Publish event") : t("Send for approval")}
      </button>
    </form>
  );
}
