"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import type { ActionResult } from "@/lib/errors";
import { requestClub } from "@/app/actions/clubs";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";

const EMOJIS = ["⭐", "⚽", "🏀", "🤖", "💻", "🎨", "🎵", "🎭", "📚", "🎤", "📷", "🌱", "♟️", "🍳", "🎮", "🤝", "💃", "🔬", "✍️", "🧵"];

export function RequestClubForm({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [emoji, setEmoji] = useState("⭐");

  // Sends the request; if there is a picture, uploads it to the new club and then opens the list.
  const [state, action] = useActionState(async (prev: ActionResult, formData: FormData): Promise<ActionResult> => {
    const result = await requestClub(prev, formData);
    if (result?.ok && result.clubId) {
      let note: string | null = null;
      if (file) {
        try {
          const blob = await compressImage(file);
          const path = `${schoolId}/${result.clubId}/${crypto.randomUUID()}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
          const supabase = createClient();
          const up = await supabase.storage.from("club-images").upload(path, blob, { contentType: blob.type });
          if (up.error) throw new Error("upload");
          const { error } = await supabase.rpc("set_club_image", { p_club: result.clubId, p_path: path });
          if (error) throw new Error("save");
        } catch {
          note = "Your request was sent, but the picture didn't upload. You can add it from the club's Manage page once it is approved.";
        }
      }
      router.push(`/clubs?requested=1${note ? "&picture=failed" : ""}`);
    }
    return result;
  }, null);

  function pick(f: File | undefined) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f ?? null);
    setPreview(f ? URL.createObjectURL(f) : null);
  }
  return (
    <form action={action} className="card space-y-4 p-4">
      <div>
        <label htmlFor="name" className="label">Club name</label>
        <input id="name" name="name" required minLength={3} maxLength={60} className="input" placeholder="e.g. Photography Club" />
      </div>
      <div className="flex items-center gap-4" data-request-picture>
        <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage-soft text-4xl" aria-hidden="true">
          {preview
            // eslint-disable-next-line @next/next/no-img-element -- local preview
            ? <img src={preview} alt="" className="size-full object-cover" data-picture-preview />
            : emoji}
        </span>
        <div className="space-y-1.5">
          <p className="label !mb-0">Club picture <span className="font-normal text-black/45">(optional)</span></p>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-picture-input />
          <input type="hidden" name="hasPicture" value={file ? "1" : "0"} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileInput.current?.click()} className="btn-secondary px-3 py-1.5 text-sm">{file ? "Change picture" : "Upload picture"}</button>
            {file && <button type="button" onClick={() => pick(undefined)} className="text-sm text-black/55 underline">Remove</button>}
          </div>
          <p className="text-xs text-black/50">Without a picture, the icon below is used.</p>
        </div>
      </div>
      <fieldset>
        <legend className="label">Pick an icon</legend>
        <input type="hidden" name="emoji" value={emoji} />
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => setEmoji(e)}
              aria-pressed={emoji === e}
              className={`size-10 rounded-xl text-xl ${emoji === e ? "bg-brand-100 ring-2 ring-brand-600" : "bg-black/5"}`}
            >
              {e}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="category" className="label">Category</label>
        <select id="category" name="category" className="input" defaultValue="other">
          <option value="sports">Sports</option><option value="academics">Academics</option><option value="tech">Tech</option>
          <option value="culture">Culture</option><option value="charity">Charity</option><option value="other">Something else</option>
        </select>
      </div>
      <div>
        <label htmlFor="description" className="label">What will the club do?</label>
        <textarea id="description" name="description" required minLength={10} maxLength={500} rows={4} className="input resize-none" placeholder="When do you meet? Who is it for?" />
      </div>
      <p className="text-xs text-black/50">A moderator will review your request. If it&apos;s approved, you become the club leader.</p>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Sending…">Send request</SubmitButton>
    </form>
  );
}
