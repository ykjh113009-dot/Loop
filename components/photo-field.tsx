"use client";

import { useRef, useState } from "react";
import { uploadPhoto } from "@/lib/upload";
import { Icon } from "@/components/icons";

// Optional photo for a form: uploads (compressed) as soon as it's picked and
// puts the stored path in a hidden "image_path" field.
export function PhotoField({ schoolId, userId, label = "Add a photo" }: { schoolId: string; userId: string; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setPreview(URL.createObjectURL(file));
    const result = await uploadPhoto(file, schoolId, userId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      setPreview(null);
      return;
    }
    setPath(result.path!);
  }

  return (
    <div>
      <input type="hidden" name="image_path" value={path} />
      {preview ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className={`max-h-40 rounded-xl object-cover ${busy ? "opacity-50" : ""}`} />
          {!busy && (
            <button
              type="button"
              onClick={() => {
                setPath("");
                setPreview(null);
              }}
              className="absolute top-2 left-2 rounded-full bg-black/60 px-2 text-sm text-white"
              aria-label="Remove photo"
            >
              ✕
            </button>
          )}
          {busy && <span className="absolute inset-0 flex items-center justify-center text-sm font-medium">Uploading…</span>}
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="btn-secondary">
          <Icon name="image" /> {label}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
