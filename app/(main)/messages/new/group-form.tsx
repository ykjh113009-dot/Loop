"use client";

import { useActionState, useState } from "react";
import { createGroup } from "@/app/actions/messages";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { makeT, type Locale } from "@/lib/i18n";

type Person = { id: string; full_name: string; avatar: string; grade: number | null; friend: boolean };

export function GroupForm({ people, locale }: { people: Person[]; locale: Locale }) {
  const t = makeT(locale);
  const [state, action] = useActionState(createGroup, null);
  const [query, setQuery] = useState("");
  const shown = people.filter((p) => p.full_name.toLowerCase().includes(query.toLowerCase()));
  return (
    <form action={action} className="card space-y-4 p-4">
      <label className="block">
        <span className="label">{t("Group name")}</span>
        <input name="title" required minLength={2} maxLength={60} className="input" placeholder={t("e.g. Physics study group")} />
      </label>
      <div>
        <span className="label">{t("Add people (up to 30)")}</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search by name")} aria-label={t("Search by name")} className="input mb-2" />
        <ul className="max-h-80 divide-y divide-black/5 overflow-y-auto rounded-xl border border-black/10">
          {people.map((p) => (
            <li key={p.id} hidden={!shown.includes(p)}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-black/[0.02]">
                <input type="checkbox" name="member" value={p.id} className="size-5 accent-brand-700" />
                <Avatar avatar={p.avatar} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.full_name}</span>
                {p.friend && <span className="chip bg-brand-50 text-brand-800">{t("Friend")}</span>}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-black/50">{t("You can add friends, and students who accept messages from everyone. Others are skipped.")}</p>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <SubmitButton className="btn-primary w-full">{t("Create group")}</SubmitButton>
    </form>
  );
}
