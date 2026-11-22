"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { saveGroupPhoto } from "@/lib/group-photo";
import { createGroup } from "@/app/actions/messages";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { makeT, type Locale } from "@/lib/i18n";

type Person = { id: string; full_name: string; avatar: string; grade: number | null; friend: boolean };

export function GroupForm({ people, locale, schoolId }: { people: Person[]; locale: Locale; schoolId: string }) {
  const t = makeT(locale);
  const [state, action] = useActionState(createGroup, null);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  useEffect(() => {
    if (!state?.id) return;
    const id = state.id;
    (async () => {
      if (photo) await saveGroupPhoto(schoolId, id, photo);
      router.push(`/messages/${id}`);
    })();
  }, [state, photo, schoolId, router]);
  function choose(file: File | undefined) {
    setPhotoError(false);
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setPhotoError(true);
    setPhoto(file);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
  }
  const shown = people.filter((p) => p.full_name.toLowerCase().includes(query.toLowerCase()));
  return (
    <form action={action} className="card space-y-4 p-4">
      <div className="flex items-center gap-4" data-group-photo-field>
        <button type="button" onClick={() => input.current?.click()} className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage-soft text-brand-800 hover:bg-sage-soft/70" aria-label={t("Add a group photo")}>
          {preview
            // eslint-disable-next-line @next/next/no-img-element -- local preview
            ? <img src={preview} alt="" className="size-full object-cover" />
            : <Camera className="size-8" aria-hidden="true" />}
        </button>
        <div className="space-y-1">
          <p className="label !mb-0">{t("Group photo")} <span className="font-normal text-black/45">({t("optional")})</span></p>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} data-group-photo-input />
          <button type="button" onClick={() => input.current?.click()} className="btn-secondary px-3 py-1.5 text-sm">{photo ? t("Change photo") : t("Add a group photo")}</button>
          {photoError && <p role="alert" className="text-xs text-red-700">{t("Choose a JPG, PNG or WebP picture.")}</p>}
        </div>
      </div>
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
