"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Paperclip, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { makeT, type Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/errors";
import { FormMessage } from "@/components/form-message";

export type ResourceInitial = {
  id?: string; subject_id?: string; title?: string; description?: string; type?: string; author?: string; link_url?: string | null;
  file_path?: string | null; file_name?: string | null; file_size?: number | null; file_mime?: string | null; file_hash?: string | null;
  cover_path?: string | null; cover_url?: string | null; downloadable?: boolean; visibility?: string;
};

const TYPES: [string, string][] = [
  ["digital_book", "Digital book"], ["textbook", "Textbook"], ["pdf_notes", "PDF notes"], ["study_guide", "Study guide"],
  ["past_paper", "Past paper"], ["practice_questions", "Practice questions"], ["worksheet", "Worksheet"], ["video", "Video"],
  ["website", "External website"], ["other", "Other"],
];
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const MAX_MB = 25;

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 64);
}

export function ResourceForm({
  mode, subjects, initial, schoolId, userId, locale, action, notice,
}: {
  mode: "community" | "official";
  subjects: { id: string; name: string }[];
  initial?: ResourceInitial;
  schoolId: string;
  userId: string;
  locale: Locale;
  action: (fd: FormData) => Promise<ActionResult>;
  notice?: string;
}) {
  const t = makeT(locale);
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<"file" | "link">(initial?.link_url ? "link" : "file");
  const [file, setFile] = useState({ path: initial?.file_path ?? "", name: initial?.file_name ?? "", size: initial?.file_size ?? 0, mime: initial?.file_mime ?? "", hash: initial?.file_hash ?? "" });
  const [cover, setCover] = useState({ path: initial?.cover_path ?? "", url: initial?.cover_url ?? "" });
  const [busy, setBusy] = useState<"file" | "cover" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult>(null);
  const [summary, setSummary] = useState<[string, string][]>([]);

  async function pickFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXT[ext];
    if (!mime) return setError(t("That file type is not allowed. Use PDF, Word, PowerPoint, Excel, text or an image."));
    if (f.size > MAX_MB * 1024 * 1024) return setError(t("Keep the file under {n} MB.", { n: MAX_MB }));
    setBusy("file");
    try {
      const safe = f.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || `file.${ext}`;
      const path = `${schoolId}/${userId}/${crypto.randomUUID()}/${safe}`;
      const hash = await sha256(f);
      const { error: up } = await createClient().storage.from("library-files").upload(path, f, { contentType: mime });
      if (up) throw new Error("upload");
      setFile({ path, name: f.name.slice(0, 120), size: f.size, mime, hash });
    } catch {
      setError(t("The file didn't upload. Check your connection and try again."));
    }
    setBusy(null);
  }

  async function pickCover(f: File | undefined) {
    if (!f) return;
    setError(null);
    setBusy("cover");
    try {
      const blob = await compressImage(f);
      const path = `${schoolId}/${userId}/${crypto.randomUUID()}/cover.${blob.type === "image/webp" ? "webp" : "jpg"}`;
      const { error: up } = await createClient().storage.from("library-files").upload(path, blob, { contentType: blob.type });
      if (up) throw new Error("upload");
      setCover({ path, url: URL.createObjectURL(blob) });
    } catch {
      setError(t("That picture can't be used. Try a different one."));
    }
    setBusy(null);
  }

  function review() {
    const f = form.current;
    if (!f || !f.reportValidity()) return;
    if (source === "file" && !file.path && !(mode === "official" && initial?.file_name)) return setError(t("Upload a file or switch to a link."));
    setError(null);
    const fd = new FormData(f);
    const typeLabel = TYPES.find(([v]) => v === fd.get("type"))?.[1] ?? "";
    const subject = subjects.find((s) => s.id === fd.get("subject_id"))?.name ?? "";
    setSummary([
      [t("Title"), String(fd.get("title") ?? "")], [t("Subject"), subject], [t("Type"), t(typeLabel)],
      [t("Description"), String(fd.get("description") ?? "")], [t("Author or source"), String(fd.get("author") ?? "")],
      [source === "file" ? t("File") : t("Link"), source === "file" ? file.name : String(fd.get("link_url") ?? "")],
      [t("Cover"), cover.path ? t("Added") : t("None")],
    ]);
    setStep(1);
    window.scrollTo({ top: 0 });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (mode === "community" && step === 0 && submitter?.value !== "draft") return review();
    const fd = new FormData(e.currentTarget, submitter);
    start(async () => {
      const r = await action(fd);
      if (r) setResult(r);
    });
  }

  const official = mode === "official";
  return (
    <form ref={form} onSubmit={submit} className="space-y-4" data-library-form>
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="file_path" value={source === "file" ? file.path : ""} />
      <input type="hidden" name="file_name" value={source === "file" ? file.name : ""} />
      <input type="hidden" name="file_size" value={source === "file" && file.size ? file.size : ""} />
      <input type="hidden" name="file_mime" value={source === "file" ? file.mime : ""} />
      <input type="hidden" name="file_hash" value={source === "file" ? file.hash : ""} />
      <input type="hidden" name="cover_path" value={cover.path} />
      {notice && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}

      <section hidden={step !== 0} className="card space-y-4 p-4">
        <div>
          <label className="label" htmlFor="lib-title">{t("Title")}</label>
          <input id="lib-title" name="title" className="input" minLength={3} maxLength={100} required defaultValue={initial?.title ?? ""} placeholder={t("e.g. SAT Math: algebra summary")} />
        </div>
        <div>
          <label className="label" htmlFor="lib-desc">{t("Short description")}</label>
          <textarea id="lib-desc" name="description" className="input min-h-24" minLength={10} maxLength={500} required defaultValue={initial?.description ?? ""} placeholder={t("What is it, and who is it useful for?")} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="lib-subject">{t("Subject")}</label>
            <select id="lib-subject" name="subject_id" className="input" required defaultValue={initial?.subject_id ?? ""}>
              <option value="" disabled>{t("Choose a subject")}</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lib-type">{t("Type")}</label>
            <select id="lib-type" name="type" className="input" required defaultValue={initial?.type ?? ""}>
              <option value="" disabled>{t("Choose a type")}</option>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="lib-author">{t("Author or source")} <span className="font-normal text-black/45">({t("optional")})</span></label>
          <input id="lib-author" name="author" className="input" maxLength={120} defaultValue={initial?.author ?? ""} placeholder={t("Who wrote or made it?")} />
        </div>

        <fieldset className="space-y-3">
          <legend className="label">{t("The resource itself")}</legend>
          <div className="flex gap-2" role="radiogroup">
            {(["file", "link"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={source === k} onClick={() => setSource(k)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${source === k ? "bg-brand-700 text-white" : "border border-black/10 bg-white text-black/65 hover:bg-sage-soft/50"}`}>
                {k === "file" ? t("Upload a file") : t("External link")}
              </button>
            ))}
          </div>
          {source === "file" ? (
            <div className="space-y-2">
              <label className="btn-secondary inline-flex w-fit cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600">
                <Upload className="size-4" aria-hidden="true" />
                <span>{file.name ? t("Choose a different file") : t("Choose a file")}</span>
                <input type="file" accept=".pdf,.docx,.pptx,.xlsx,.txt,.jpg,.jpeg,.png,.webp" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} className="sr-only" data-file-input />
              </label>
              <p className="text-xs text-black/50">{t("PDF, Word, PowerPoint, Excel, text or image. Up to {n} MB.", { n: MAX_MB })}</p>
              {busy === "file" && <p className="text-sm text-black/60">{t("Uploading…")}</p>}
              {file.name && busy !== "file" && <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800"><Paperclip className="size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 truncate">{file.name}</span></p>}
              {!file.path && official && initial?.file_name && <p className="text-xs text-black/50">{t("Current file: {n}. Upload a new one to replace it.", { n: initial.file_name })}</p>}
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="downloadable" defaultChecked={initial?.downloadable ?? official} className="mt-1" />
                <span>{t("Let students download this file")}</span>
              </label>
              {!official && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="rights_confirmed" className="mt-1" defaultChecked={false} />
                  <span>{t("I made this, or I am allowed to share it with my school.")}</span>
                </label>
              )}
            </div>
          ) : (
            <div>
              <input name="link_url" type="url" className="input" maxLength={500} defaultValue={initial?.link_url ?? ""} placeholder="https://" aria-label={t("External link")} />
              <p className="mt-1 text-xs text-black/50">{t("Links open on the other website. Only normal https:// addresses are accepted.")}</p>
            </div>
          )}
        </fieldset>

        <div>
          <p className="label">{t("Cover picture")} <span className="font-normal text-black/45">({t("optional")})</span></p>
          <div className="flex items-center gap-3">
            <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sage-soft/50 text-2xl">
              {cover.url
                // eslint-disable-next-line @next/next/no-img-element -- local preview
                ? <img src={cover.url} alt="" className="size-full object-cover" />
                : <ImagePlus className="size-6 text-brand-700/70" strokeWidth={1.5} aria-hidden="true" />}
            </div>
            <div className="space-y-1">
              <label className="btn-secondary inline-flex w-fit cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600">
                <ImagePlus className="size-4" aria-hidden="true" />
                <span>{cover.path ? t("Choose a different picture") : t("Choose a picture")}</span>
                <input type="file" accept="image/*" onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ""; }} className="sr-only" data-cover-input />
              </label>
              {busy === "cover" && <p className="text-xs text-black/60">{t("Uploading…")}</p>}
              {cover.path && <button type="button" onClick={() => setCover({ path: "", url: "" })} className="text-xs text-black/50 underline">{t("Remove cover")}</button>}
            </div>
          </div>
        </div>

        {official && (
          <div>
            <label className="label" htmlFor="lib-vis">{t("Availability")}</label>
            <select id="lib-vis" name="visibility" className="input" defaultValue={initial?.visibility ?? "visible"}>
              <option value="visible">{t("Available to students")}</option>
              <option value="hidden">{t("Hidden for now")}</option>
            </select>
          </div>
        )}
      </section>

      {!official && (
        <section hidden={step !== 1} className="card space-y-3 p-4" data-summary>
          <h2 className="section-title">{t("Check before you send")}</h2>
          <dl className="divide-y divide-black/5">
            {summary.map(([k, v]) => (
              <div key={k} className="py-2"><dt className="text-xs text-black/45">{k}</dt><dd className="whitespace-pre-wrap text-sm">{v || <span className="text-black/35">—</span>}</dd></div>
            ))}
          </dl>
          <p className="text-xs text-black/55">{t("A member of the Student Council or an admin will review this. You will get a notification with their decision.")}</p>
        </section>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <FormMessage state={result} />

      <div className="flex flex-wrap gap-2">
        {official ? (
          <button className="btn-primary" disabled={pending || !!busy}>{pending ? t("Saving…") : t("Save resource")}</button>
        ) : step === 0 ? (
          <>
            <button key="review" type="button" onClick={review} className="btn-primary" disabled={!!busy}>{t("Review and send")}</button>
            <button key="draft0" type="submit" name="intent" value="draft" formNoValidate className="btn-secondary" disabled={pending || !!busy}>{t("Save as draft")}</button>
          </>
        ) : (
          <>
            <button key="send" type="submit" name="intent" value="submit" className="btn-primary" disabled={pending}>{pending ? t("Sending…") : t("Submit for review")}</button>
            <button key="draft1" type="submit" name="intent" value="draft" className="btn-secondary" disabled={pending}>{t("Save as draft")}</button>
            <button key="back" type="button" onClick={() => setStep(0)} className="btn-ghost">{t("Back")}</button>
          </>
        )}
      </div>
    </form>
  );
}
