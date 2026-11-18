"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/actions/profile";
import { Confetti } from "@/components/confetti";
import { NEW_AVATARS, avatarSrc } from "@/lib/avatars";
import { uploadPhoto } from "@/lib/upload";
import { makeT, type Locale } from "@/lib/i18n";

const SECTIONS = ["A", "B", "C", "D", "E", "F"];
const STEPS = ["Profile", "Interests", "Done"] as const;

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  );
}

function Stepper({ step, t }: { step: number; t: (s: string) => string }) {
  return (
    <ol className="flex items-start" aria-label={t("Steps")}>
      {STEPS.map((s, i) => (
        <li key={s} className="relative flex flex-1 flex-col items-center gap-1" aria-current={step === i ? "step" : undefined}>
          {i > 0 && <span className={`absolute end-1/2 top-3 h-0.5 w-full ${i <= step ? "bg-brand-700" : "bg-black/10"}`} aria-hidden="true" />}
          <span className={`relative z-10 flex size-6 items-center justify-center rounded-full text-xs font-bold ${i < step ? "bg-brand-700 text-white" : i === step ? "bg-white text-brand-800 ring-2 ring-brand-700" : "bg-white text-black/40 ring-2 ring-black/10"}`}>
            {i < step ? <Check /> : i + 1}
          </span>
          <span className={`text-[11px] ${i <= step ? "font-semibold text-brand-900" : "text-black/45"}`}>{t(s)}</span>
        </li>
      ))}
    </ol>
  );
}

export function WelcomeWizard({
  locale, after = "/home", schoolId, userId, name, email, schoolName, grades, fixedGrade, fixedSection, noClassReason, interests,
}: {
  locale: Locale; after?: string; schoolId: string; userId: string; name: string; email: string; schoolName: string; grades: number[];
  fixedGrade: number | null; fixedSection: string | null; noClassReason: "counselor" | "alumni" | null;
  interests: { id: number; name: string }[];
}) {
  const t = makeT(locale);
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [picking, setPicking] = useState(false);
  const [avatar, setAvatar] = useState("b01");
  const [photo, setPhoto] = useState<{ path: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [grade, setGrade] = useState<number | null>(fixedGrade);
  const [section, setSection] = useState<string | null>(fixedSection);
  const [bio, setBio] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [rules, setRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [seconds, setSeconds] = useState(6);
  const needsClass = !noClassReason;
  const first = name.split(" ")[0];

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    const preview = URL.createObjectURL(file);
    const up = await uploadPhoto(file, schoolId, userId);
    setUploading(false);
    if (up.error) return setError(t(up.error));
    setPhoto({ path: up.path!, preview });
  }

  function next() {
    setError(null);
    if (needsClass && !grade) return setError(t("Please choose your grade."));
    if (needsClass && !section) return setError(t("Please choose your class letter."));
    setStep(1);
    window.scrollTo({ top: 0 });
  }

  function finish() {
    setError(null);
    if (!rules) return setError(t("Please agree to the community rules."));
    const fd = new FormData();
    fd.set("avatar", avatar);
    if (photo) fd.set("image_path", photo.path);
    if (grade) fd.set("grade", String(grade));
    if (section) fd.set("section", section);
    fd.set("bio", bio);
    fd.set("rules", "on");
    picked.forEach((id) => fd.append("interest", String(id)));
    start(async () => {
      const r = await completeOnboarding(null, fd);
      if (r?.error) return setError(t(r.error));
      setStep(2);
      window.scrollTo({ top: 0 });
    });
  }

  // The welcome screen continues to Home by itself after a moment.
  useEffect(() => {
    if (step !== 2) return;
    if (seconds <= 0) { router.replace(after); return; }
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, seconds, router, after]);

  const shownAvatar = photo ? photo.preview : avatarSrc(avatar);
  const font = { fontFamily: "var(--font-body), system-ui, sans-serif" } as const;
  const display = { fontFamily: "var(--font-display), system-ui, sans-serif" } as const;
  const wordmark = (cls: string) => (
    // eslint-disable-next-line @next/next/no-img-element -- static brand image
    <img src="/brand/loop-wordmark.png" alt="Loop" className={cls} />
  );

  if (step === 2) {
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-cream px-5 py-10 text-center" style={font} data-welcome-done>
        <Confetti />
        <div className="relative z-10 flex max-w-md flex-col items-center gap-4">
          {wordmark("h-10 w-auto")}
          <h1 className="text-3xl font-bold text-brand-900 sm:text-4xl" style={display}>{t("You're officially part of Loop!")}</h1>
          <p className="text-lg text-black/65">{t("Welcome to our school community, {n}.", { n: first })}</p>
          <button onClick={() => router.replace(after)} className="btn-primary px-8 py-3 text-base" data-continue>{after === "/home" ? t("Continue to Dashboard") : t("Continue")} →</button>
          <p className="text-xs text-black/45" aria-live="polite">{t("Taking you there in {n}…", { n: Math.max(seconds, 0) })}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-cream lg:flex" style={font}>
      {/* Brand side: the promise. A slim version on phones. */}
      <aside className="relative flex items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-sage-soft/70 to-cream px-5 py-5 lg:w-[42%] lg:flex-col lg:justify-center lg:gap-2 lg:py-10">
        <div className="lg:text-center">
          {wordmark("h-9 w-auto lg:h-16")}
          <p className="mt-1 text-sm text-brand-900/70 lg:mt-3 lg:text-xl" style={display}>{t("Your school. Your community.")}</p>
        </div>
        <span className="pointer-events-none absolute -bottom-10 -start-10 hidden size-56 rounded-full bg-sage-soft/50 lg:block" aria-hidden="true" />
      </aside>

      <section className="flex flex-1 items-start justify-center px-4 py-6 lg:items-center lg:py-10">
        <div className="w-full max-w-lg space-y-5">
          <Stepper step={step} t={t} />

          {step === 0 && !picking && (
            <div className="card space-y-5 rounded-3xl p-5 sm:p-7" data-step="profile">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-brand-900" style={display}>{t("Let's set up your profile!")}</h1>
                <p className="mt-1 text-sm text-black/60">{t("This will help us personalize your Loop experience.")}</p>
              </div>

              <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img src={shownAvatar} alt={t("Your picture")} className={`size-28 rounded-full border-4 border-white object-cover shadow ${uploading ? "opacity-50" : ""}`} data-preview />
                  <button type="button" onClick={() => fileInput.current?.click()} className="absolute bottom-0 end-0 flex size-9 items-center justify-center rounded-full bg-brand-700 text-white shadow" aria-label={t("Upload a photo")}>
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1" /><circle cx="12" cy="13.5" r="3.5" /></svg>
                  </button>
                </div>
                <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
                  <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} data-photo-input />
                  <button type="button" onClick={() => fileInput.current?.click()} className="btn-secondary w-full justify-center sm:w-auto" disabled={uploading}>{uploading ? t("Uploading…") : photo ? t("Change photo") : t("Upload Photo")}</button>
                  <button type="button" onClick={() => setPicking(true)} className="text-sm font-semibold text-brand-700 underline underline-offset-2" data-choose-avatar>{t("or choose an avatar")}</button>
                  {photo && <button type="button" onClick={() => setPhoto(null)} className="text-xs text-black/50 underline">{t("Remove photo")}</button>}
                </div>
              </div>

              <div>
                <label className="label" htmlFor="wz-name">{t("Full name")}</label>
                <input id="wz-name" value={name} readOnly className="input bg-black/[0.03]" />
                <p className="mt-1 flex items-center gap-1.5 text-xs text-black/50">
                  <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.600-4.100H3.100v2.600A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.400 13.900a6 6 0 0 1 0-3.800V7.500H3.100a10 10 0 0 0 0 9z" /><path fill="#EA4335" d="M12 6c1.500 0 2.800.5 3.900 1.500l2.900-2.900A10 10 0 0 0 3.100 7.500l3.300 2.600C7.200 7.800 9.400 6 12 6z" /></svg>
                  {t("From your Google account")}{email ? ` · ${email}` : ""}
                </p>
              </div>

              {needsClass ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <fieldset>
                    <legend className="label">{t("Grade")}</legend>
                    {fixedGrade ? (
                      <p className="rounded-xl bg-sage-soft/50 px-3 py-2.5 text-sm font-semibold">{t("Grade {n}", { n: fixedGrade })}</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2" role="radiogroup">
                        {grades.map((g) => (
                          <button key={g} type="button" role="radio" aria-checked={grade === g} onClick={() => setGrade(g)}
                            className={`rounded-xl border py-2.5 text-center font-semibold ${grade === g ? "border-brand-700 bg-brand-700 text-white" : "border-black/10 bg-white text-black/70"}`}>{g}</button>
                        ))}
                      </div>
                    )}
                  </fieldset>
                  <fieldset>
                    <legend className="label">{t("Class / Section")}</legend>
                    {fixedSection ? (
                      <p className="rounded-xl bg-sage-soft/50 px-3 py-2.5 text-sm font-semibold">{(grade ?? "") + fixedSection}</p>
                    ) : (
                      <div className="grid grid-cols-6 gap-1.5" role="radiogroup">
                        {SECTIONS.map((l) => (
                          <button key={l} type="button" role="radio" aria-checked={section === l} onClick={() => setSection(l)}
                            className={`rounded-xl border py-2.5 text-center text-sm font-semibold ${section === l ? "border-brand-700 bg-brand-700 text-white" : "border-black/10 bg-white text-black/70"}`}>{grade ?? ""}{l}</button>
                        ))}
                      </div>
                    )}
                  </fieldset>
                </div>
              ) : (
                <p className="rounded-xl bg-sage-soft/50 px-3 py-2 text-sm">{noClassReason === "counselor" ? t("You are set up as the school counselor.") : t("You are set up as an alumni mentor.")}</p>
              )}
              {needsClass && !fixedGrade && <p className="-mt-3 text-xs text-black/45">{t("Only your school admin can change grade and class later.")}</p>}

              <div>
                <label className="label" htmlFor="wz-bio">{t("Bio")} <span className="font-normal text-black/45">({t("optional")})</span></label>
                <div className="relative">
                  <textarea id="wz-bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 200))} maxLength={200} rows={2} className="input pb-6" placeholder={t("Tell us a bit about yourself…")} />
                  <span className="pointer-events-none absolute bottom-2 end-3 text-xs text-black/40">{bio.length}/200</span>
                </div>
              </div>

              {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="flex justify-end"><button type="button" onClick={next} className="btn-primary px-8" disabled={uploading} data-next>{t("Next")} →</button></div>
            </div>
          )}

          {step === 0 && picking && (
            <div className="card space-y-5 rounded-3xl p-5 sm:p-7" data-step="avatars">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-brand-900" style={display}>{t("Choose an avatar")}</h1>
                <p className="mt-1 text-sm text-black/60">{t("Pick a fun avatar or upload your own photo!")}</p>
              </div>
              <button type="button" onClick={() => { setPicking(false); fileInput.current?.click(); }} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/15 py-3 text-sm font-medium text-black/60" data-upload-tile>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1" /><circle cx="12" cy="13.5" r="3.5" /></svg>
                {t("Upload Photo")}
              </button>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {NEW_AVATARS.map((id) => {
                  const on = !photo && avatar === id;
                  return (
                    <button key={id} type="button" onClick={() => { setAvatar(id); setPhoto(null); }} aria-pressed={on} aria-label={`${t("Avatar")} ${id}`}
                      className={`relative aspect-square overflow-hidden rounded-2xl ring-2 transition ${on ? "ring-brand-700" : "ring-transparent hover:ring-black/10"}`} data-avatar={id}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- local svg */}
                      <img src={avatarSrc(id)} alt="" className="size-full" />
                      {on && <span className="absolute end-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-brand-700 text-white"><Check /></span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setPicking(false)} className="btn-ghost">← {t("Back")}</button>
                <button type="button" onClick={() => setPicking(false)} className="btn-primary px-8" data-avatar-done>{t("Done")}</button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="card space-y-5 rounded-3xl p-5 sm:p-7" data-step="interests">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-brand-900" style={display}>{t("What are you into?")}</h1>
                <p className="mt-1 text-sm text-black/60">{t("Pick up to 10. We use these to suggest clubs, events and people.")}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2" data-interests>
                {interests.map((i) => {
                  const on = picked.includes(i.id);
                  return (
                    <button key={i.id} type="button" aria-pressed={on}
                      onClick={() => setPicked((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : p.length >= 10 ? p : [...p, i.id]))}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${on ? "border-brand-700 bg-brand-700 text-white" : "border-black/10 bg-white text-black/70 hover:border-black/25"}`}>
                      {on && <Check />}{i.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-center text-xs text-black/45">{picked.length}/10</p>
              <label className="flex items-start gap-3 rounded-2xl bg-black/[0.03] p-3 text-sm">
                <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)} className="mt-0.5 size-5 accent-brand-700" data-rules />
                <span>{t("I agree to the")} <Link href="/rules" target="_blank" className="font-semibold underline">{t("community rules")}</Link>: {t("be kind, use my real name, and report anything that makes me or others uncomfortable.")}</span>
              </label>
              {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setStep(0)} className="btn-ghost">← {t("Back")}</button>
                <button type="button" onClick={finish} className="btn-primary px-8" disabled={pending} data-finish>{pending ? t("Setting up…") : t("Finish Setup")} →</button>
              </div>
            </div>
          )}
          <p className="text-center text-xs text-black/40">{schoolName}</p>
        </div>
      </section>
    </main>
  );
}
