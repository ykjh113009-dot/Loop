"use client";

import { useRef, useState, useTransition } from "react";
import { createFeedPost } from "@/app/actions/feed";
import { uploadPhoto } from "@/lib/upload";
import { Avatar } from "@/components/avatar";
import { LineIcon } from "@/components/line-icon";
import { makeT, type Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/errors";

type Club = { id: string; name: string; emoji: string };
const KINDS = [
  { kind: "text", label: "Post" },
  { kind: "question", label: "Question" },
  { kind: "achievement", label: "Achievement" },
  { kind: "poll", label: "Poll" },
] as const;

// "Share something with your school": text, an optional photo or poll, and
// who sees it (the whole school or one of your clubs).
export function HomeComposer({
  clubs, avatar, schoolId, userId, locale = "en",
}: {
  clubs: Club[]; avatar: string; schoolId: string; userId: string; locale?: Locale;
}) {
  const t = makeT(locale);
  const [kind, setKind] = useState<(typeof KINDS)[number]["kind"]>("text");
  const [clubId, setClubId] = useState("");
  const [body, setBody] = useState("");
  const [options, setOptions] = useState(["", ""]);
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
      const res = await createFeedPost({ body, kind, clubId: clubId || null, imagePath, options });
      setResult(res);
      if (!res?.error) {
        setBody("");
        setOptions(["", ""]);
        setKind("text");
        pickFile(null);
      }
    });
  }

  const placeholder =
    kind === "question" ? t("Ask your school a question…")
    : kind === "achievement" ? t("Share something you are proud of…")
    : kind === "poll" ? t("Ask a question for the poll…")
    : t("Share something with your school…");

  return (
    <div id="composer" className="scroll-mt-24 space-y-2.5">
      <div className="flex flex-wrap gap-1.5 ps-[52px]" role="radiogroup" aria-label={t("Kind of post")}>
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="radio"
            aria-checked={kind === k.kind}
            onClick={() => setKind(k.kind)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${kind === k.kind ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-900 hover:bg-brand-100"}`}
          >
            {t(k.label)}
          </button>
        ))}
      </div>
      <div className="flex items-start gap-3">
        <Avatar avatar={avatar} size="md" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder={placeholder}
          aria-label={t("Write a post")}
          className="min-h-[52px] flex-1 resize-none rounded-xl border border-brand-700/10 bg-brand-50/50 px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-2/70 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
        />
      </div>
      {kind === "poll" && (
        <div className="space-y-1.5 ps-[52px]">
          {options.map((o, i) => (
            <input
              key={i}
              value={o}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
              maxLength={80}
              placeholder={t("Choice {n}", { n: i + 1 })}
              aria-label={t("Choice {n}", { n: i + 1 })}
              className="input py-2 text-sm"
            />
          ))}
          {options.length < 6 && (
            <button type="button" onClick={() => setOptions([...options, ""])} className="text-xs font-semibold text-brand-700 hover:underline">
              {t("+ Add a choice")}
            </button>
          )}
        </div>
      )}
      {preview && (
        <div className="relative ms-[52px] w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file */}
          <img src={preview} alt={t("Chosen photo")} className="max-h-40 rounded-xl" />
          <button type="button" onClick={() => pickFile(null)} className="absolute top-1 end-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            {t("Remove")}
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 ps-[52px]">
        <label className="sr-only" htmlFor="composer-audience">{t("Who can see this")}</label>
        <select
          id="composer-audience"
          value={clubId}
          onChange={(e) => setClubId(e.target.value)}
          className="max-w-[55%] truncate rounded-full border border-brand-700/10 bg-white py-1.5 ps-3 pe-7 text-xs font-medium outline-none focus:border-brand-600"
        >
          <option value="">🏫 {t("Whole school")}</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
          ))}
        </select>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        {kind !== "poll" && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label={t("Add a photo")}
            className="rounded-full border border-brand-700/10 p-2 text-brand-700 hover:bg-brand-50"
          >
            <LineIcon name="image" className="size-[18px]" />
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending || !body.trim()}
          className="ms-auto rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-50"
        >
          {pending ? t("Posting…") : t("Post")}
        </button>
      </div>
      <p className="ps-[52px] text-[11px] text-ink-2">{t("Use #hashtags and @names. Lost or found something? Post it here.")}</p>
      {result?.error && <p role="alert" className="ps-[52px] text-sm text-red-700">{result.error}</p>}
      {result?.message && <p role="status" className="ps-[52px] text-sm text-brand-800">{result.message}</p>}
    </div>
  );
}
