"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { ClubIcon } from "@/components/club-icon";

// Club leaders and admins pick the club's picture here. It is checked again by the database.
export function ClubImageField({ clubId, schoolId, emoji, url }: { clubId: string; schoolId: string; emoji: string; url: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const blob = await compressImage(file);
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const path = `${schoolId}/${clubId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const up = await supabase.storage.from("club-images").upload(path, blob, { contentType: blob.type });
      if (up.error) throw new Error("upload");
      const { error: rpc } = await supabase.rpc("set_club_image", { p_club: clubId, p_path: path });
      if (rpc) throw new Error("save");
      router.refresh();
    } catch {
      setError("The picture didn't upload. Try a different image (JPG, PNG or WebP).");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true); setError(null);
    const { error: rpc } = await createClient().rpc("set_club_image", { p_club: clubId, p_path: null as unknown as string });
    if (rpc) setError("The picture couldn't be removed."); else router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-4" data-club-image-field>
      <ClubIcon emoji={emoji} url={url} className="size-20 text-4xl" />
      <div className="space-y-1.5">
        <p className="label !mb-0">Club picture</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-club-image-input />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn-secondary px-3 py-1.5 text-sm">{busy ? "Uploading…" : url ? "Change picture" : "Upload picture"}</button>
          {url && !busy && <button type="button" onClick={remove} className="text-sm text-black/55 underline">Remove</button>}
        </div>
        <p className="text-xs text-black/50">Shown on the club card and the club page. Without one, the icon below is used.</p>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}
