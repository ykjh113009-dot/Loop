"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Check, CloudUpload, Info, Pencil, Save, Trash2, X, ImageIcon } from "lucide-react";
import { updateProfile } from "@/app/actions/profile";
import { updateProfileExtras } from "@/app/actions/social";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload";
import { ACCENTS } from "@/lib/accent";
import { NEW_AVATARS, avatarSrc } from "@/lib/avatars";
import { makeT, type Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/errors";

const DEFAULT_COVER = "/brand/default-cover.webp";
const IMAGE_TYPES = "image/jpeg,image/png,image/webp";
const COVER_W = 1600;
const COVER_H = 533; // 3 : 1, the shape of the profile banner

type Interest = { id: number; name: string; emoji: string };

// A centred dialog: closes with Escape, the X or a click outside, and keeps the page from scrolling behind it.
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button, input")?.focus();
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" data-modal>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45" tabIndex={-1} />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={id} className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-[#faf8f0] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={id} className="text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-black/5"><X className="size-5" aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EditProfile(props: {
  schoolId: string; userId: string; locale: Locale; profileHref: string; name: string; gradeNote: string | null;
  avatar: string; photoUrl: string | null; coverUrl: string | null;
  bio: string; interests: Interest[]; picked: number[];
  section: string; sectionLocked: boolean; skills: string[]; subjects: string[]; accent: string;
  mentor: { university: string; major: string } | null;
}) {
  const t = makeT(props.locale);
  const [avatar, setAvatar] = useState(props.avatar);
  const [photoUrl, setPhotoUrl] = useState(props.photoUrl);
  const [coverUrl, setCoverUrl] = useState(props.coverUrl);
  const [bio, setBio] = useState(props.bio);
  const [picked, setPicked] = useState(props.picked);
  const [section, setSection] = useState(props.section);
  const [skills, setSkills] = useState(props.skills.join(", "));
  const [subjects, setSubjects] = useState(props.subjects.join(", "));
  const [accent, setAccent] = useState(props.accent);
  const [university, setUniversity] = useState(props.mentor?.university ?? "");
  const [major, setMajor] = useState(props.mentor?.major ?? "");
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<"photo" | "cover" | null>(null);

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 10 ? p : [...p, id]));

  // Saves everything on the page; the photo and cover dialogs use it too, with the new file paths.
  async function saveAll(paths: { photoPath?: string | null; coverPath?: string | null } = {}, avatarOverride?: string): Promise<ActionResult> {
    const fd = new FormData();
    fd.set("avatar", avatarOverride ?? avatar);
    fd.set("bio", bio);
    picked.forEach((id) => fd.append("interest", String(id)));
    if (props.mentor) { fd.set("university", university); fd.set("major", major); }
    const first = await updateProfile(null, fd);
    if (first?.error) return first;
    return updateProfileExtras({ skills, subjects, section: props.sectionLocked ? props.section : section, accent, ...paths });
  }
  function submit() {
    setResult(null);
    start(async () => setResult(await saveAll()));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5" data-edit-profile data-wide>
      <section className="relative overflow-hidden rounded-3xl border border-brand-700/10 bg-[#f4f1e6] pb-5 shadow-[0_1px_2px_rgba(40,60,40,0.04)]">
        <div className="group relative h-40 bg-cover sm:h-64" style={{ backgroundImage: `url(${coverUrl ?? DEFAULT_COVER})`, backgroundPosition: "center 20%" }} data-testid="cover">
          <button type="button" onClick={() => setModal("cover")} aria-label={t("Change Cover")} className="absolute inset-0 cursor-pointer" data-change-cover-area />
          <Link href={props.profileHref} className="absolute start-3 top-3 z-10 inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-medium shadow-sm hover:bg-white"><ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />{t("Back to profile")}</Link>
          <span className="pointer-events-none absolute end-3 top-3 z-10 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium opacity-0 shadow-sm transition-opacity group-hover:opacity-100 max-sm:opacity-100 [@media(hover:none)]:opacity-100" data-change-cover-label><Camera className="size-4" aria-hidden="true" />{t("Change Cover")}</span>
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 -bottom-px h-8 w-full text-[#f4f1e6] sm:h-12" aria-hidden="true"><path fill="currentColor" d="M0 80V52C240 8 470 8 720 40S1190 72 1440 28V80Z" /></svg>
        </div>
        <div className="relative flex flex-col items-center px-5">
          <button type="button" onClick={() => setModal("photo")} aria-label={t("Change profile photo")} className="group/av relative z-10 -mt-14 rounded-full sm:-mt-16" data-change-photo>
            {photoUrl
              // eslint-disable-next-line @next/next/no-img-element -- local or signed image
              ? <img src={photoUrl} alt="" className="size-28 rounded-full border-[5px] border-white bg-white object-cover shadow-lg sm:size-32" />
              // eslint-disable-next-line @next/next/no-img-element -- local svg
              : <img src={avatarSrc(avatar)} alt="" className="size-28 rounded-full border-[5px] border-white bg-white object-cover shadow-lg sm:size-32" />}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35 text-white opacity-0 transition-opacity group-hover/av:opacity-100 group-focus-visible/av:opacity-100" aria-hidden="true"><Camera className="size-7" /></span>
            <span className="absolute end-0 bottom-1 flex size-9 items-center justify-center rounded-full border-2 border-white bg-brand-700 text-white shadow" aria-hidden="true"><Camera className="size-[18px]" /></span>
          </button>
          <p className="mt-2 text-xl font-semibold">{props.name}</p>
          {props.gradeNote && <p className="mt-0.5 text-center text-xs text-ink-2">{props.gradeNote}</p>}
        </div>
      </section>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-0 overflow-hidden rounded-3xl border border-brand-700/10 bg-white/85 shadow-[0_1px_2px_rgba(40,60,40,0.04)]">
        <section className="p-5 sm:p-6" data-section="interests">
          <header className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2.5 text-[20px] font-semibold"><span aria-hidden="true">★</span>{t("What are you into?")}</h2>
              <p className="mt-0.5 text-sm text-ink-2">{t("Select up to 10 interests")}</p>
            </div>
            <span className="text-sm text-ink-2 tabular-nums" aria-live="polite" data-interest-count>{picked.length}/10</span>
          </header>
          <div className="flex flex-wrap gap-2.5" data-interests>
            {props.interests.map((i) => {
              const on = picked.includes(i.id);
              return (
                <button key={i.id} type="button" aria-pressed={on} onClick={() => toggle(i.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[15px] font-medium transition ${on ? "border-brand-700 bg-brand-700 text-white" : "border-black/15 bg-white text-black/70 hover:border-black/30"}`}>
                  {on && <Check className="size-4" strokeWidth={3} aria-hidden="true" />}{i.emoji} {i.name}
                </button>
              );
            })}
          </div>
        </section>

        <section className="border-t border-brand-700/10 p-5 sm:p-6" data-section="about">
          <label htmlFor="ep-bio" className="mb-2 block text-[20px] font-semibold">{t("About you")} <span className="text-base font-normal text-ink-2">({t("optional")})</span></label>
          <div className="relative">
            <Pencil className="pointer-events-none absolute start-4 top-4 size-[18px] text-ink-2" aria-hidden="true" />
            <textarea id="ep-bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 200))} maxLength={200} rows={3} placeholder={t("e.g. I love football and I'm learning guitar…")} className="input !rounded-2xl !ps-11 pb-7" />
            <span className="pointer-events-none absolute end-4 bottom-2 text-xs text-ink-2 tabular-nums" data-bio-count>{bio.length} / 200</span>
          </div>
          <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-2"><Info className="size-4 shrink-0" aria-hidden="true" />{t("Don't share your phone number, address or other private details.")}</p>
        </section>

        <section className="border-t border-brand-700/10 p-5 sm:p-6" data-section="photos">
          <h2 className="mb-3 flex items-center gap-2.5 text-[20px] font-semibold"><ImageIcon className="size-5" aria-hidden="true" />{t("Photos")}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setModal("photo")} className="flex items-center gap-4 rounded-2xl border border-black/10 bg-white p-3 text-start hover:bg-sage-soft/30" data-open-photo>
              {/* eslint-disable-next-line @next/next/no-img-element -- local or signed image */}
              <img src={photoUrl ?? avatarSrc(avatar)} alt="" className="size-14 shrink-0 rounded-full object-cover" />
              <span><span className="block font-semibold">{t("Profile Photo")}</span><span className="text-sm text-ink-2">{t("Change photo")}</span></span>
            </button>
            <button type="button" onClick={() => setModal("cover")} className="flex items-center gap-4 rounded-2xl border border-black/10 bg-white p-3 text-start hover:bg-sage-soft/30" data-open-cover>
              <span className="h-14 w-24 shrink-0 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${coverUrl ?? DEFAULT_COVER})` }} aria-hidden="true" />
              <span><span className="block font-semibold">{t("Cover Photo")}</span><span className="text-sm text-ink-2">{t("Change Cover")}</span></span>
            </button>
          </div>
        </section>

        <section className="border-t border-brand-700/10 p-5 sm:p-6" data-section="details">
          <h2 className="mb-3 text-[20px] font-semibold">{t("Class and more")}</h2>
          <div className="space-y-4">
            <label className="block">
              <span className="label">{t("Class letter (for example A)")}</span>
              <input value={section} onChange={(e) => setSection(e.target.value)} maxLength={1} disabled={props.sectionLocked} className="input w-24 uppercase" />
              {props.sectionLocked && <span className="mt-1 block text-xs text-ink-2">{t("Your class decides your house, so only an admin can change it.")}</span>}
            </label>
            <label className="block"><span className="label">{t("Skills and talents (separate with commas)")}</span><input value={skills} onChange={(e) => setSkills(e.target.value)} maxLength={400} placeholder={t("Drawing, video editing, public speaking")} className="input" /></label>
            <label className="block"><span className="label">{t("Favourite subjects (separate with commas)")}</span><input value={subjects} onChange={(e) => setSubjects(e.target.value)} maxLength={300} placeholder={t("Physics, English")} className="input" /></label>
            {props.mentor && (
              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="label">{t("Alumni mentor details")}</legend>
                <input value={university} onChange={(e) => setUniversity(e.target.value)} maxLength={80} placeholder={t("University")} className="input" aria-label={t("University")} />
                <input value={major} onChange={(e) => setMajor(e.target.value)} maxLength={80} placeholder={t("What you study")} className="input" aria-label={t("What you study")} />
              </fieldset>
            )}
            <fieldset>
              <legend className="label">{t("Accent colour")}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {Object.entries(ACCENTS).map(([key, a]) => (
                  <button key={key} type="button" role="radio" aria-checked={accent === key} aria-label={a.name} onClick={() => setAccent(key)}
                    className={`size-9 rounded-full ring-2 ring-offset-2 ${accent === key ? "ring-brand-700" : "ring-transparent"}`} style={{ background: a.cover }} />
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 border-t border-brand-700/10 bg-white/95 p-4 backdrop-blur lg:bottom-0 lg:p-5" data-save-bar>
          {result?.error && <p role="alert" className="mb-2 text-sm text-red-700">{result.error}</p>}
          {result?.message && <p role="status" className="mb-2 text-sm font-medium text-brand-800" data-saved>{t(result.message)}</p>}
          <button type="submit" disabled={pending} className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-base" data-save-changes>
            <Save className="size-5" aria-hidden="true" />{pending ? t("Saving…") : t("Save changes")}
          </button>
        </div>
      </form>

      {modal === "photo" && (
        <PhotoModal {...props} t={t} avatar={avatar} photoUrl={photoUrl} onClose={() => setModal(null)}
          onSave={async (paths, nextAvatar, nextUrl) => {
            const r = await saveAll(paths, nextAvatar);
            if (!r?.error) { setAvatar(nextAvatar); setPhotoUrl(nextUrl); setResult(r); setModal(null); }
            return r;
          }} />
      )}
      {modal === "cover" && (
        <CoverModal {...props} t={t} coverUrl={coverUrl} onClose={() => setModal(null)}
          onSave={async (coverPath, nextUrl) => {
            const r = await saveAll({ coverPath });
            if (!r?.error) { setCoverUrl(nextUrl); setResult(r); setModal(null); }
            return r;
          }} />
      )}
    </div>
  );
}

type T = (s: string, v?: Record<string, string | number>) => string;

function PhotoModal({ t, schoolId, userId, avatar, photoUrl, onClose, onSave }: {
  t: T; schoolId: string; userId: string; avatar: string; photoUrl: string | null; onClose: () => void;
  onSave: (paths: { photoPath?: string | null }, avatar: string, url: string | null) => Promise<ActionResult>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [chosenAvatar, setChosenAvatar] = useState(avatar);
  const [avatarPicked, setAvatarPicked] = useState(false);
  const [showAvatars, setShowAvatars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const shown = preview ?? (removed || avatarPicked ? null : photoUrl);
  const hasPhoto = !!shown;

  function pick(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setError(t("Use a JPG, PNG or WebP picture.")); return; }
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f)); setRemoved(false); setAvatarPicked(false);
  }
  function save() {
    setError(null);
    start(async () => {
      let paths: { photoPath?: string | null } = {};
      let nextUrl: string | null = photoUrl;
      if (file) {
        const up = await uploadPhoto(file, schoolId, userId);
        if (up.error) { setError(up.error); return; }
        paths = { photoPath: up.path! }; nextUrl = preview;
      } else if (removed || avatarPicked) { paths = { photoPath: null }; nextUrl = null; }
      const r = await onSave(paths, avatarPicked ? chosenAvatar : avatar, nextUrl);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <Modal title={t("Update profile photo")} onClose={onClose}>
      <div className="flex flex-col items-center gap-4" data-photo-modal>
        {/* eslint-disable-next-line @next/next/no-img-element -- local or signed image */}
        <img src={shown ?? avatarSrc(avatarPicked ? chosenAvatar : avatar)} alt={t("Your picture")} className="size-44 rounded-full border-[6px] border-white bg-white object-cover shadow-md ring-1 ring-black/10" data-photo-preview />
        <input ref={fileInput} type="file" accept={IMAGE_TYPES} className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-photo-input />
        <button type="button" onClick={() => fileInput.current?.click()} className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-full py-3"><CloudUpload className="size-5" aria-hidden="true" />{t("Upload New Photo")}</button>
        <div className="flex items-center gap-5 text-sm">
          {hasPhoto && <button type="button" onClick={() => { setRemoved(true); setFile(null); setPreview(null); }} className="inline-flex items-center gap-2 font-medium hover:underline" data-remove-photo><Trash2 className="size-4" aria-hidden="true" />{t("Remove Photo")}</button>}
          <button type="button" onClick={() => setShowAvatars((s) => !s)} className="font-medium text-brand-700 hover:underline" aria-expanded={showAvatars}>{t("or choose an avatar")}</button>
        </div>
        {showAvatars && (
          <div className="grid w-full grid-cols-4 gap-2" role="radiogroup" aria-label={t("Avatars")}>
            {NEW_AVATARS.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={avatarPicked && chosenAvatar === id} onClick={() => { setChosenAvatar(id); setAvatarPicked(true); setFile(null); setPreview(null); setRemoved(false); }}
                className={`rounded-full p-0.5 ring-2 ${avatarPicked && chosenAvatar === id ? "ring-brand-700" : "ring-transparent"}`} aria-label={`${t("Avatar")} ${id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local image */}
                <img src={avatarSrc(id)} alt="" className="aspect-square w-full rounded-full" />
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-ink-2">{t("JPG, PNG or WebP")}</p>
        {error && <p role="alert" className="w-full rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="grid w-full grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="btn-secondary rounded-full py-3">{t("Cancel")}</button>
          <button type="button" onClick={save} disabled={busy} className="btn-primary rounded-full py-3" data-save-photo>{busy ? t("Saving…") : t("Save Photo")}</button>
        </div>
      </div>
    </Modal>
  );
}

function CoverModal({ t, schoolId, userId, coverUrl, onClose, onSave }: {
  t: T; schoolId: string; userId: string; coverUrl: string | null; onClose: () => void;
  onSave: (path: string | null | undefined, url: string | null) => Promise<ActionResult>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<"keep" | "default" | "new">("keep");
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // How big the picture is drawn: at zoom 1 it just covers the banner. Sizes are kept in state when the picture loads.
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const metricsFor = (z: number) => {
    if (!nat || !box) return null;
    const scale = Math.max(box.w / nat.w, box.h / nat.h) * z;
    return { cw: box.w, ch: box.h, scale, w: nat.w * scale, h: nat.h * scale };
  };
  const m = metricsFor(zoom);
  const clamp = (x: number, y: number, z = zoom) => {
    const mm = metricsFor(z);
    if (!mm) return { x, y };
    return { x: Math.min(0, Math.max(mm.cw - mm.w, x)), y: Math.min(0, Math.max(mm.ch - mm.h, y)) };
  };
  function loaded(e: React.SyntheticEvent<HTMLImageElement>) {
    const im = e.currentTarget, f = frame.current;
    if (!f) return;
    const n = { w: im.naturalWidth, h: im.naturalHeight }, b = { w: f.clientWidth, h: f.clientHeight };
    const scale = Math.max(b.w / n.w, b.h / n.h);
    setNat(n); setBox(b);
    setOff({ x: (b.w - n.w * scale) / 2, y: (b.h - n.h * scale) / 2 });
  }
  function pick(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setError(t("Use a JPG, PNG or WebP picture.")); return; }
    setError(null);
    if (src) URL.revokeObjectURL(src);
    setNat(null); setSrc(URL.createObjectURL(f)); setMode("new"); setZoom(1);
  }
  function setZoomKeepingCenter(z: number) {
    const before = metricsFor(zoom), after = metricsFor(z);
    if (before && after) {
      const cx = (-off.x + before.cw / 2) / before.scale, cy = (-off.y + before.ch / 2) / before.scale;
      setOff(clamp(-(cx * after.scale - after.cw / 2), -(cy * after.scale - after.ch / 2), z));
    }
    setZoom(z);
  }
  function nudge(e: React.KeyboardEvent) {
    const step = 12;
    const d = e.key === "ArrowLeft" ? [step, 0] : e.key === "ArrowRight" ? [-step, 0] : e.key === "ArrowUp" ? [0, step] : e.key === "ArrowDown" ? [0, -step] : null;
    if (d) { e.preventDefault(); setOff((o) => clamp(o.x + d[0], o.y + d[1])); }
  }

  function save() {
    setError(null);
    start(async () => {
      if (mode === "keep") { onClose(); return; }
      if (mode === "default") { const r = await onSave(null, null); if (r?.error) setError(r.error); return; }
      const im = img.current;
      if (!m || !im) { setError(t("That picture can't be used. Try a different one.")); return; }
      const canvas = document.createElement("canvas");
      canvas.width = COVER_W; canvas.height = COVER_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setError(t("That picture can't be used. Try a different one.")); return; }
      ctx.drawImage(im, -off.x / m.scale, -off.y / m.scale, m.cw / m.scale, m.ch / m.scale, 0, 0, COVER_W, COVER_H);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.86));
      if (!blob) { setError(t("That picture can't be used. Try a different one.")); return; }
      const path = `${schoolId}/${userId}/${crypto.randomUUID()}.jpg`;
      const { error: up } = await createClient().storage.from("post-images").upload(path, blob, { contentType: "image/jpeg" });
      if (up) { setError(t("The picture didn't upload. Try again.")); return; }
      const r = await onSave(path, URL.createObjectURL(blob));
      if (r?.error) setError(r.error);
    });
  }

  const showCurrent = mode === "keep" ? (coverUrl ?? "/brand/default-cover.webp") : mode === "default" ? "/brand/default-cover.webp" : null;
  return (
    <Modal title={t("Change Cover")} onClose={onClose}>
      <div className="space-y-4" data-cover-modal>
        <div ref={frame} className="relative aspect-[3/1] w-full touch-none overflow-hidden rounded-2xl bg-sage-soft/40 ring-1 ring-black/10"
          tabIndex={mode === "new" ? 0 : -1} onKeyDown={mode === "new" ? nudge : undefined} aria-label={mode === "new" ? t("Drag the picture to reposition it") : t("Current cover")}
          onPointerDown={(e) => { if (mode !== "new") return; drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { const d = drag.current; if (d) setOff(clamp(d.ox + e.clientX - d.x, d.oy + e.clientY - d.y)); }}
          onPointerUp={() => { drag.current = null; }}>
          {mode === "new" && src ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview
            <img ref={img} src={src} alt="" draggable={false} onLoad={loaded} className="pointer-events-none absolute start-0 top-0 max-w-none select-none"
              style={m ? { width: m.w, height: m.h, transform: `translate(${off.x}px, ${off.y}px)` } : { minWidth: "100%", minHeight: "100%", objectFit: "cover" }} data-crop-image />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- current cover
            <img src={showCurrent ?? ""} alt="" className="size-full object-cover" data-cover-preview />
          )}
        </div>
        {mode === "new" && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-3 text-sm"><span className="shrink-0 text-ink-2">{t("Zoom")}</span>
              <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoomKeepingCenter(Number(e.target.value))} className="w-full accent-brand-700" data-zoom />
            </label>
            <p className="text-xs text-ink-2">{t("Drag the picture to reposition it.")}</p>
          </div>
        )}
        <input ref={fileInput} type="file" accept={IMAGE_TYPES} className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-cover-input />
        <button type="button" onClick={() => fileInput.current?.click()} className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-full py-3"><CloudUpload className="size-5" aria-hidden="true" />{t("Upload a new cover")}</button>
        <button type="button" onClick={() => { setMode("default"); setSrc(null); }} className="mx-auto block text-sm font-medium hover:underline" data-restore-cover>{t("Restore Default Cover")}</button>
        <p className="text-center text-xs text-ink-2">{t("JPG, PNG or WebP")}</p>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="btn-secondary rounded-full py-3">{t("Cancel")}</button>
          <button type="button" onClick={save} disabled={busy} className="btn-primary rounded-full py-3" data-save-cover>{busy ? t("Saving…") : t("Save")}</button>
        </div>
      </div>
    </Modal>
  );
}
