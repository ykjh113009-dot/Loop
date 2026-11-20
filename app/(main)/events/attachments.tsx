"use client";

import { useActionState, useRef, useState } from "react";
import { addEventAttachment, removeEventAttachment } from "@/app/actions/events";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { makeT, type Locale } from "@/lib/i18n";
import { Glyph } from "@/components/glyph";

export function AttachmentUploader({ eventId, schoolId, locale }: { eventId: string; schoolId: string; locale: Locale }) {
  const t = makeT(locale);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const isPdf = file.type === "application/pdf";
      if (isPdf && file.size > 10 * 1024 * 1024) throw new Error(t("Keep files under 10 MB."));
      const blob: Blob = isPdf ? file : await compressImage(file);
      const ext = isPdf ? "pdf" : blob.type === "image/webp" ? "webp" : "jpg";
      const path = `${schoolId}/${eventId}/${crypto.randomUUID()}.${ext}`;
      const { error: up } = await createClient().storage.from("event-files").upload(path, blob, { contentType: blob.type });
      if (up) throw new Error(t("The file didn't upload. Try again."));
      const result = await addEventAttachment(path, file.name.slice(0, 120), eventId);
      if (result?.error) throw new Error(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("That file can't be used."));
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn-secondary">{busy ? "…" : `${t("Add a photo or PDF")}`}</button>
      <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function RemoveAttachment({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(removeEventAttachment, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="text-xs text-black/40 hover:text-red-600" aria-label={label}><Glyph e="✕" /></button>
      {state?.error && <span className="text-xs text-red-700"> {state.error}</span>}
    </form>
  );
}
