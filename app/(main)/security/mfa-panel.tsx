"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordSecurityEvent } from "@/app/actions/account";

type Factor = { id: string; status: string };
type Enrolment = { id: string; qr: string; secret: string };

// Two-step sign-in with an authenticator app (Google Authenticator, Microsoft
// Authenticator, 1Password...). Required for Admins and Super Admins.
export function MfaPanel({ required, needsStep }: { required: boolean; needsStep: boolean }) {
  const router = useRouter();
  const [factor, setFactor] = useState<Factor | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function load() {
    const { data } = await createClient().auth.mfa.listFactors();
    setFactor((data?.totp ?? []).find((f) => f.status === "verified") ?? null);
    setLoaded(true);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once from the sign-in service
    load();
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // Clear any half-finished set-up first.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Loop ${Date.now()}` });
    setBusy(false);
    if (error || !data) return setError("Could not start the set-up. Please try again.");
    setEnrolment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verify(factorId: string, kind: "mfa_enabled" | "mfa_verified") {
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
    if (error) {
      setBusy(false);
      return setError("That code is not right. Check the app and try the newest code.");
    }
    await recordSecurityEvent(kind);
    setCode("");
    setEnrolment(null);
    setBusy(false);
    setDone(kind === "mfa_enabled" ? "Two-step sign-in is on." : "Verified. Admin tools are unlocked.");
    await load();
    router.refresh();
  }

  async function turnOff() {
    if (!factor) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (error) return setError("Enter a code first to confirm it is you, then try again.");
    await recordSecurityEvent("mfa_disabled");
    setDone("Two-step sign-in is off.");
    await load();
    router.refresh();
  }

  const codeInput = (
    <input
      value={code}
      onChange={(e) => setCode(e.target.value)}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      placeholder="6-digit code"
      aria-label="6-digit code from your authenticator app"
      className="input w-40 text-center font-mono tracking-widest"
    />
  );

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Two-step sign-in</h2>
        {loaded && (
          <span className={`chip ${factor ? "bg-brand-50 text-brand-800" : "bg-black/5"}`}>{factor ? "On" : "Off"}</span>
        )}
        {required && <span className="chip bg-amber-50 text-amber-900">Required for admins</span>}
      </div>
      <p className="text-sm text-black/60">
        After Google, Loop asks for a 6-digit code from an authenticator app on your phone. This protects your account
        even if someone gets into your Google account.
      </p>

      {done && <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">{done}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {!loaded ? (
        <p className="text-sm text-black/45">Checking…</p>
      ) : factor && needsStep ? (
        <form onSubmit={(e) => { e.preventDefault(); verify(factor.id, "mfa_verified"); }} className="space-y-2">
          <p className="text-sm font-medium">Enter the code from your authenticator app to open the admin tools.</p>
          <div className="flex flex-wrap gap-2">
            {codeInput}
            <button className="btn-primary" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Verify"}</button>
          </div>
        </form>
      ) : factor ? (
        required ? (
          <p className="text-sm text-black/60">It stays on while you have an admin role.</p>
        ) : (
          <button type="button" onClick={turnOff} disabled={busy} className="btn-secondary">Turn off</button>
        )
      ) : enrolment ? (
        <form onSubmit={(e) => { e.preventDefault(); verify(enrolment.id, "mfa_enabled"); }} className="space-y-3">
          <ol className="list-decimal space-y-1 ps-5 text-sm">
            <li>Open an authenticator app on your phone (for example Google Authenticator).</li>
            <li>Scan this square, or type the key under it.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolment.qr} alt="QR code for your authenticator app" width={176} height={176} className="rounded-xl border border-black/10 bg-white p-2" />
          <p className="text-xs break-all text-black/55">Key: <span className="font-mono">{enrolment.secret}</span></p>
          <div className="flex flex-wrap gap-2">
            {codeInput}
            <button className="btn-primary" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Turn on"}</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={start} disabled={busy} className="btn-primary">
          {busy ? "Starting…" : "Set up two-step sign-in"}
        </button>
      )}
    </section>
  );
}
