"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { saveGroupPhoto, removeGroupPhoto } from "@/lib/group-photo";
import { makeT, type Locale } from "@/lib/i18n";

// The person who made the group (and admins) change the group's picture from the chat header.
export function GroupPhotoButton({ conversationId, schoolId, hasPhoto, locale }: { conversationId: string; schoolId: string; hasPhoto: boolean; locale: Locale }) {
  const t = makeT(locale);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(false);
    const ok = /^image\/(jpeg|png|webp)$/.test(file.type) && (await saveGroupPhoto(schoolId, conversationId, file));
    setBusy(false);
    if (ok) router.refresh(); else setError(true);
  }
  async function remove() {
    setBusy(true);
    const ok = await removeGroupPhoto(conversationId);
    setBusy(false);
    if (ok) router.refresh(); else setError(true);
  }

  return (
    <span className="flex items-center gap-1" data-group-photo-button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} data-group-photo-input />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn-ghost inline-flex items-center gap-1 px-2 py-1 text-xs"><Camera className="size-4" aria-hidden="true" />{busy ? t("Saving…") : hasPhoto ? t("Change photo") : t("Add a group photo")}</button>
      {hasPhoto && !busy && <button type="button" onClick={remove} className="btn-ghost px-2 py-1 text-xs">{t("Remove photo")}</button>}
      {error && <span role="alert" className="text-xs text-red-700">{t("The photo didn't save. Try a JPG, PNG or WebP picture.")}</span>}
    </span>
  );
}
