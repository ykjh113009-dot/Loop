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

  const pill = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${on ? "border-brand-700 bg-brand-700 text-white" : "border-brand-700/10 bg-white/80 text-ink-2 hover:bg-white"}`;
  return (
    <div id="composer" className="scroll-mt-24 space-y-3">
      <div className="flex items-start gap-3.5">
        <Avatar avatar={avatar} size="md" className="!size-12 sm:!size-14" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder={placeholder}
          aria-label={t("Write a post")}
          className="min-h-[56px] flex-1 resize-none rounded-3xl border border-brand-700/10 bg-sage-soft/30 px-5 py-4 text-[15px] outline-none placeholder:text-ink-2/70 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
        />
      </div>
      {kind === "poll" && (
        <div className="space-y-1.5 ps-[60px] sm:ps-[72px]">
          {options.map((o, i) => (
            <input
              key={i}
              value={o}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
              maxLength={80}
              placeholder={t("Choice {n}", { n: i + 1 })}
              aria-label={t("Choice {n}", { n: i + 1 })}
              className="input rounded-full py-2 text-sm"
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
        <div className="relative ms-[60px] w-fit sm:ms-[72px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file */}
          <img src={preview} alt={t("Chosen photo")} className="max-h-40 rounded-2xl" />
          <button type="button" onClick={() => pickFile(null)} className="absolute top-1 end-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            {t("Remove")}
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 ps-[60px] sm:ps-[72px]">
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        {kind !== "poll" && (
          <button type="button" onClick={() => fileInput.current?.click()} aria-label={t("Add a photo")} className={pill(!!file)}>
            <LineIcon name="image" className="size-[18px]" />{t("Photo")}
          </button>
        )}
        <div className="contents" role="radiogroup" aria-label={t("Kind of post")}>
          {KINDS.map((k) => (
            <button key={k.kind} type="button" role="radio" aria-checked={kind === k.kind} onClick={() => setKind(k.kind)} className={`${pill(kind === k.kind)} ${k.kind === "text" ? "sr-only" : ""}`}>
              {t(k.label)}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="composer-audience">{t("Who can see this")}</label>
        <select
          id="composer-audience"
          value={clubId}
          onChange={(e) => setClubId(e.target.value)}
          className="max-w-[40%] truncate rounded-full border border-brand-700/10 bg-white/80 py-1.5 ps-3 pe-7 text-[13px] font-medium outline-none focus:border-brand-600"
        >
          <option value="">{t("Whole school")}</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !body.trim()}
          className="ms-auto inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2 text-[15px] font-semibold text-white hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="size-[18px] rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 3 10 14" /><path d="M21 3l-7 18-4-7-7-4 18-7z" /></svg>
          {pending ? t("Posting…") : t("Post")}
        </button>
      </div>
      <p className="ps-[60px] text-[11px] text-ink-2 sm:ps-[72px]">{t("Use #hashtags and @names. Lost or found something? Post it here.")}</p>
      {result?.error && <p role="alert" className="ps-[60px] text-sm text-red-700 sm:ps-[72px]">{result.error}</p>}
      {result?.message && <p role="status" className="ps-[60px] text-sm text-brand-800 sm:ps-[72px]">{result.message}</p>}
    </div>
  );
}
