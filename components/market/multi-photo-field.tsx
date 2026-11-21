"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { uploadPhoto } from "@/lib/upload";

const MAX = 4;

// Up to four pictures for a listing. They upload (compressed) as soon as they are chosen; the first one is the cover.
export function MultiPhotoField({ schoolId, userId }: { schoolId: string; userId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<{ path: string; url: string }[]>([]);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = MAX - items.length;
    for (const file of Array.from(files).slice(0, room)) {
      setBusy((n) => n + 1);
      const r = await uploadPhoto(file, schoolId, userId);
      setBusy((n) => n - 1);
      if (r.error || !r.path) { setError(r.error ?? "The photo didn't upload."); continue; }
      setItems((cur) => [...cur, { path: r.path!, url: URL.createObjectURL(file) }]);
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-2" data-multi-photo>
      <p className="label">Pictures <span className="font-normal text-black/45">(up to {MAX}; the first is the cover)</span></p>
      {items.map((it) => <input key={it.path} type="hidden" name="image_path" value={it.path} />)}
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <div key={it.path} className="relative size-20 overflow-hidden rounded-xl bg-sand/60">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
            <img src={it.url} alt="" className="size-full object-cover" />
            {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-center text-[10px] font-medium text-white">Cover</span>}
            <button type="button" onClick={() => setItems((cur) => cur.filter((x) => x.path !== it.path))} className="absolute end-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white" aria-label="Remove picture"><X className="size-3.5" aria-hidden="true" /></button>
          </div>
        ))}
        {busy > 0 && <div className="flex size-20 items-center justify-center rounded-xl bg-black/[0.05] text-xs text-ink-2">…</div>}
        {items.length + busy < MAX && (
          <button type="button" onClick={() => input.current?.click()} className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-700/25 text-xs text-ink-2 hover:bg-sage-soft/40"><ImagePlus className="size-5" aria-hidden="true" />Add</button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void pick(e.target.files)} data-multi-photo-input />
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
