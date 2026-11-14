"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { submitEntry } from "@/app/actions/challenges";
import { uploadProof } from "@/lib/upload";
import { makeT, type Locale } from "@/lib/i18n";

type Ids = { schoolId: string; challengeId: string; userId: string };

// One file picker for the photo or video proof. Uploads straight away into the student's private folder.
function ProofFile({ kind, ids, name, label }: { kind: "photo" | "video"; ids: Ids; name: string; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await uploadProof(file, kind, ids);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      setPath("");
      setFileName("");
      return;
    }
    setPath(result.path!);
    setFileName(file.name);
  }

  return (
    <div>
      <input type="hidden" name={name} value={path} />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className={`btn-secondary w-full justify-start ${path ? "border-brand-600 bg-brand-50" : ""}`}>
        {kind === "photo" ? "📷" : "🎬"} {busy ? "…" : path ? `✓ ${fileName}` : label}
      </button>
      <input ref={input} type="file" accept={kind === "photo" ? "image/*" : "video/mp4,video/webm,video/quicktime"} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function EntryForm({ challengeId, proofKinds, questions, ids, locale }: { challengeId: string; proofKinds: string[]; questions: string[]; ids: Ids; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(submitEntry, null);
  const [, start] = useTransition();
  if (state?.message) return <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{state.message}</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(() => action(fd)); }} className="space-y-3">
      <input type="hidden" name="id" value={challengeId} />
      {proofKinds.includes("photo") && <ProofFile kind="photo" ids={ids} name="photo_path" label={t("Add your photo")} />}
      {proofKinds.includes("video") && <ProofFile kind="video" ids={ids} name="video_path" label={t("Add your video (up to 25 MB)")} />}
      {proofKinds.includes("answers") && questions.map((q, i) => (
        <label key={i} className="block"><span className="label">{i + 1}. {q}</span><input name="answer" required maxLength={500} className="input" /></label>
      ))}
      {proofKinds.includes("text") && (
        <label className="block"><span className="label">{t("Tell us what you did")}</span><textarea name="note" required minLength={3} maxLength={1000} rows={3} className="input resize-none" /></label>
      )}
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "…" : t("Send my proof")}</button>
    </form>
  );
}
