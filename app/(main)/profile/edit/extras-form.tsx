"use client";

import { useState, useTransition } from "react";
import { updateProfileExtras } from "@/app/actions/social";
import { uploadPhoto } from "@/lib/upload";
import { ACCENTS } from "@/lib/accent";
import { makeT, type Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/errors";

// Photo, cover, class letter, skills, favourite subjects and accent colour.
export function ExtrasForm(props: {
  schoolId: string; userId: string; locale: Locale;
  section: string; skills: string[]; subjects: string[]; accent: string;
  hasPhoto: boolean; hasCover: boolean;
}) {
  const t = makeT(props.locale);
  const [section, setSection] = useState(props.section);
  const [skills, setSkills] = useState(props.skills.join(", "));
  const [subjects, setSubjects] = useState(props.subjects.join(", "));
  const [accent, setAccent] = useState(props.accent);
  const [photo, setPhoto] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, start] = useTransition();

  function save() {
    setResult(null);
    start(async () => {
      let photoPath: string | null | undefined;
      let coverPath: string | null | undefined;
      for (const [file, set] of [[photo, (p: string) => (photoPath = p)], [cover, (p: string) => (coverPath = p)]] as const) {
        if (!file) continue;
        const up = await uploadPhoto(file, props.schoolId, props.userId);
        if (up.error) return setResult({ error: up.error });
        set(up.path!);
      }
      if (removePhoto && !photo) photoPath = null;
      if (removeCover && !cover) coverPath = null;
      setResult(await updateProfileExtras({ skills, subjects, section, accent, photoPath, coverPath }));
    });
  }

  return (
    <div className="card space-y-4 p-4">
      <h2 className="font-semibold">{t("Photo, class and more")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">{t("Profile photo")}</span>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="input text-sm" aria-label={t("Profile photo")} />
          {props.hasPhoto && (
            <span className="mt-1 flex items-center gap-2 text-xs text-black/60">
              <input type="checkbox" checked={removePhoto} onChange={(e) => setRemovePhoto(e.target.checked)} /> {t("Remove my photo and use the avatar")}
            </span>
          )}
        </label>
        <label className="block">
          <span className="label">{t("Cover photo")}</span>
          <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} className="input text-sm" aria-label={t("Cover photo")} />
          {props.hasCover && (
            <span className="mt-1 flex items-center gap-2 text-xs text-black/60">
              <input type="checkbox" checked={removeCover} onChange={(e) => setRemoveCover(e.target.checked)} /> {t("Remove my cover photo")}
            </span>
          )}
        </label>
      </div>
      <label className="block">
        <span className="label">{t("Class letter (for example A)")}</span>
        <input value={section} onChange={(e) => setSection(e.target.value)} maxLength={1} className="input w-24 uppercase" aria-label={t("Class letter (for example A)")} />
      </label>
      <label className="block">
        <span className="label">{t("Skills and talents (separate with commas)")}</span>
        <input value={skills} onChange={(e) => setSkills(e.target.value)} maxLength={400} placeholder={t("Drawing, video editing, public speaking")} className="input" />
      </label>
      <label className="block">
        <span className="label">{t("Favourite subjects (separate with commas)")}</span>
        <input value={subjects} onChange={(e) => setSubjects(e.target.value)} maxLength={300} placeholder={t("Physics, English")} className="input" />
      </label>
      <fieldset>
        <legend className="label">{t("Accent colour")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {Object.entries(ACCENTS).map(([key, a]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={accent === key}
              aria-label={a.name}
              onClick={() => setAccent(key)}
              className={`size-9 rounded-full ring-2 ring-offset-2 ${accent === key ? "ring-brand-700" : "ring-transparent"}`}
              style={{ background: a.cover }}
            />
          ))}
        </div>
      </fieldset>
      {result?.error && <p role="alert" className="text-sm text-red-700">{result.error}</p>}
      {result?.message && <p role="status" className="text-sm text-brand-800">{t(result.message)}</p>}
      <button type="button" onClick={save} disabled={pending} className="btn-primary w-full">{pending ? t("Saving…") : t("Save")}</button>
    </div>
  );
}
