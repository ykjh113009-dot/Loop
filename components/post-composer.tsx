"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { createPost } from "@/app/actions/content";
import { Icon } from "@/components/icons";
import type { ActionResult } from "@/lib/errors";

// Shrinks a photo to at most 1080px and ~100KB before upload, to save data.
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const toBlob = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  // Some iPhones can't make WebP files; fall back to JPEG.
  const webp = await toBlob("image/webp", 0.72);
  if (webp && webp.type === "image/webp") return webp;
  return (await toBlob("image/jpeg", 0.75))!;
}

export function PostComposer({ clubId, schoolId, userId }: { clubId: string; schoolId: string; userId: string }) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function submit() {
    setResult(null);
    startTransition(async () => {
      let imagePath: string | null = null;
      if (file) {
        try {
          const blob = await compressImage(file);
          const ext = blob.type === "image/webp" ? "webp" : "jpg";
          imagePath = `${schoolId}/${userId}/${crypto.randomUUID()}.${ext}`;
          const { error } = await createClient().storage.from("post-images").upload(imagePath, blob, { contentType: blob.type });
          if (error) {
            setResult({ error: "The photo didn't upload. Try again or post without it." });
            return;
          }
        } catch {
          setResult({ error: "That photo can't be used. Try a different one." });
          return;
        }
      }
      const res = await createPost({ clubId, body, imagePath });
      setResult(res);
      if (!res?.error) {
        setBody("");
        pickFile(null);
      }
    });
  }

  return (
    <div className="card space-y-3 p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Share something with the club…"
        className="input resize-none"
      />
      {preview && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-h-48 rounded-xl object-cover" />
          <button type="button" onClick={() => pickFile(null)} className="absolute top-2 left-2 rounded-full bg-black/60 px-2 text-sm text-white">
            ✕
          </button>
        </div>
      )}
      {result?.error && <p className="text-sm text-red-700">{result.error}</p>}
      {result?.message && <p className="text-sm text-amber-800">{result.message}</p>}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => fileInput.current?.click()} className="btn-ghost px-2">
          <Icon name="image" /> Photo
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        <button type="button" onClick={submit} disabled={pending || !body.trim()} className="btn-primary">
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
