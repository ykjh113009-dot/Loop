"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createPost } from "@/app/actions/content";
import { uploadPhoto } from "@/lib/upload";
import { Avatar } from "@/components/avatar";
import { LineIcon } from "@/components/line-icon";
import type { ActionResult } from "@/lib/errors";

type Club = { id: string; name: string; emoji: string };

// "Share something with your school": a text box, an optional photo, and the
// club the post goes to (every post belongs to a club).
export function HomeComposer({ clubs, avatar, schoolId, userId }: { clubs: Club[]; avatar: string; schoolId: string; userId: string }) {
  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
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
        const upload = await uploadPhoto(file, schoolId, userId);
        if (upload.error) {
          setResult({ error: upload.error });
          return;
        }
        imagePath = upload.path!;
      }
      const res = await createPost({ clubId, body, imagePath });
      setResult(res);
      if (!res?.error) {
        setBody("");
        pickFile(null);
      }
    });
  }

  if (clubs.length === 0) {
    return (
      <div id="composer" className="flex scroll-mt-24 items-center gap-3 rounded-xl bg-brand-50/70 px-4 py-3 text-sm text-ink-2">
        <Avatar avatar={avatar} size="md" />
        <p className="flex-1">Posts go to your clubs. Join a club to start sharing.</p>
        <Link href="/clubs" className="shrink-0 rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-800">
          Find a club
        </Link>
      </div>
    );
  }

  return (
    <div id="composer" className="scroll-mt-24 space-y-2.5">
      <div className="flex items-start gap-3">
        <Avatar avatar={avatar} size="md" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Share something with your school…"
          aria-label="Write a post"
          className="min-h-[52px] flex-1 resize-none rounded-xl border border-brand-700/10 bg-brand-50/50 px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-2/70 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
        />
      </div>
      {preview && (
        <div className="relative ml-[52px] w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file */}
          <img src={preview} alt="Chosen photo" className="max-h-40 rounded-xl" />
          <button type="button" onClick={() => pickFile(null)} className="absolute top-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            Remove
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pl-[52px]">
        <label className="sr-only" htmlFor="composer-club">Post to</label>
        <select
          id="composer-club"
          value={clubId}
          onChange={(e) => setClubId(e.target.value)}
          className="max-w-[55%] truncate rounded-full border border-brand-700/10 bg-white py-1.5 pr-7 pl-3 text-xs font-medium outline-none focus:border-brand-600"
        >
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
          ))}
        </select>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label="Add a photo"
          className="rounded-full border border-brand-700/10 p-2 text-brand-700 hover:bg-brand-50"
        >
          <LineIcon name="image" className="size-[18px]" />
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !body.trim()}
          className="ml-auto rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
      {result?.error && <p role="alert" className="pl-[52px] text-sm text-red-700">{result.error}</p>}
      {result?.message && <p role="status" className="pl-[52px] text-sm text-brand-800">{result.message}</p>}
    </div>
  );
}
