"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { submitAdminApplication } from "@/app/actions/account";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";
import { avatarSrc } from "@/lib/avatars";

const STEPS = ["Profile", "Role", "Done"] as const;
const font = { fontFamily: "var(--font-body), system-ui, sans-serif" } as const;
const display = { fontFamily: "var(--font-display), system-ui, sans-serif" } as const;

type Past = { id: string; label: string; className: string; text: string; when: string; note: string | null };

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-start" aria-label="Steps">
      {STEPS.map((s, i) => (
        <li key={s} className="relative flex flex-1 flex-col items-center gap-1" aria-current={step === i ? "step" : undefined}>
          {i > 0 && <span className={`absolute end-1/2 top-3 h-0.5 w-full ${i <= step ? "bg-brand-700" : "bg-black/10"}`} aria-hidden="true" />}
          <span className={`relative z-10 flex size-6 items-center justify-center rounded-full text-xs font-bold ${i < step ? "bg-brand-700 text-white" : i === step ? "bg-white text-brand-800 ring-2 ring-brand-700" : "bg-white text-black/40 ring-1 ring-black/15"}`}>
            {i < step ? "✓" : i + 1}
          </span>
          <span className={`text-[11px] ${i <= step ? "font-semibold text-brand-900" : "text-black/45"}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

const GOOGLE = (
  <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9z" /><path fill="#EA4335" d="M12 6a5.4 5.4 0 0 1 3.8 1.5l2.8-2.8A9.600 9.600 0 0 0 12 2 10 10 0 0 0 3.100 7.500l3.300 2.600A6 6 0 0 1 12 6z" /></svg>
);

export function ApplyWizard({
  name, email, avatar, schoolName, status, past, backHref, backLabel,
}: {
  name: string; email: string; avatar: string; schoolName: string; backHref: string; backLabel: string;
  status: "form" | "pending" | "admin"; past: Past[];
}) {
  const [step, setStep] = useState(status === "form" ? 0 : 2);
  const [position, setPosition] = useState("");
  const [role, setRole] = useState<"moderator" | "admin">("moderator");
  const [state, action] = useActionState(submitAdminApplication, null);
  const sent = state?.ok === true;
  const shown = sent ? 2 : step;

  return (
    <main className="min-h-dvh bg-cream lg:flex" style={font}>
      <aside className="relative flex items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-sage-soft/70 to-cream px-5 py-5 lg:w-[42%] lg:flex-col lg:justify-center lg:gap-2 lg:py-10">
        <div className="lg:text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand image */}
          <img src="/brand/loop-wordmark.png" alt="Loop" className="h-9 w-auto lg:h-16" />
          <p className="mt-1 text-sm text-brand-900/70 lg:mt-3 lg:text-xl" style={display}>Your school. Your community.</p>
        </div>
        <span className="pointer-events-none absolute -bottom-10 -start-10 hidden size-56 rounded-full bg-sage-soft/50 lg:block" aria-hidden="true" />
      </aside>

      <section className="flex flex-1 items-start justify-center px-4 py-6 lg:items-center lg:py-10">
        <div className="w-full max-w-lg space-y-5">
          <Stepper step={shown} />

          {shown === 0 && (
            <div className="card space-y-5 rounded-3xl p-5 sm:p-7" data-step="profile">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-brand-900" style={display}>Let&apos;s set up your admin account!</h1>
                <p className="mt-1 text-sm text-black/60">Admins and moderators help run Loop for {schoolName}. A Super Admin reads every application, and you get no admin access until it is approved.</p>
              </div>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
                {/* eslint-disable-next-line @next/next/no-img-element -- avatar */}
                <img src={avatarSrc(avatar)} alt="Your picture" className="size-28 rounded-full border-4 border-white object-cover shadow" />
                <p className="text-sm text-black/55">This is your Loop picture. You can change it any time in your profile settings.</p>
              </div>
              <div>
                <label className="label" htmlFor="ad-name">Full name</label>
                <input id="ad-name" value={name} readOnly className="input bg-black/[0.03]" />
                <p className="mt-1 flex items-center gap-1.5 text-xs text-black/50">{GOOGLE}From your Google account{email ? ` · ${email}` : ""}</p>
              </div>
              <div>
                <label className="label" htmlFor="ad-position">Your position at school <span className="font-normal text-black/45">(optional)</span></label>
                <input id="ad-position" value={position} onChange={(e) => setPosition(e.target.value.slice(0, 120))} maxLength={120} className="input" placeholder="e.g. Grade 11 student, teacher, activities coordinator" />
              </div>
              <div className="flex justify-end"><button type="button" onClick={() => setStep(1)} className="btn-primary px-8" data-next>Next →</button></div>
            </div>
          )}

          {shown === 1 && (
            <form action={action} className="card space-y-5 rounded-3xl p-5 sm:p-7" data-step="role">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-brand-900" style={display}>Which role fits you?</h1>
                <p className="mt-1 text-sm text-black/60">You may be given a different role from the one you ask for.</p>
              </div>
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="position" value={position} />
              <fieldset>
                <legend className="label">Role you are asking for</legend>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                  {([["moderator", "Moderator", "Reviews reports and removes harmful content"], ["admin", "Admin", "Also manages accounts, announcements and events"]] as const).map(([k, t, d]) => (
                    <button key={k} type="button" role="radio" aria-checked={role === k} onClick={() => setRole(k)}
                      className={`rounded-2xl border p-3 text-start ${role === k ? "border-brand-700 bg-brand-700 text-white" : "border-black/10 bg-white text-black/70"}`}>
                      <span className="block font-semibold">{t}</span><span className={`block text-xs ${role === k ? "text-white/85" : "text-black/55"}`}>{d}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block"><span className="label">Why do you want this role?</span><textarea name="motivation" required minLength={20} maxLength={1500} rows={3} className="input resize-none" /></label>
              <label className="block"><span className="label">What do you plan to contribute?</span><textarea name="contribution" required minLength={20} maxLength={1500} rows={3} className="input resize-none" /></label>
              <label className="block"><span className="label">Relevant experience <span className="font-normal text-black/45">(optional)</span></span><textarea name="experience" maxLength={1500} rows={2} className="input resize-none" /></label>
              <FormMessage state={state} />
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setStep(0)} className="text-sm font-semibold text-brand-700">← Back</button>
                <SubmitButton className="btn-primary px-8" pendingText="Sending…">Send application</SubmitButton>
              </div>
            </form>
          )}

          {shown === 2 && (
            <div className="card space-y-5 rounded-3xl p-5 text-center sm:p-7" data-step="done">
              <h1 className="text-2xl font-bold text-brand-900" style={display}>
                {status === "admin" ? "You already have an admin account" : "Application sent!"}
              </h1>
              <p className="text-sm text-black/60">
                {status === "admin" ? "Nothing more to do here." : "A Super Admin will review it. You will get a notification with the answer."}
              </p>
              {past.length > 0 && (
                <ul className="space-y-2 text-start text-sm">
                  {past.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-sage-soft/40 px-3 py-2">
                      <span className={`chip ${a.className}`}>{a.label}</span><span>{a.text}</span><span className="text-black/45">{a.when}</span>
                      {a.note && <span className="w-full text-black/60">Note: {a.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <Link href={backHref} className="btn-primary inline-flex px-8" data-continue>{backLabel} →</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
