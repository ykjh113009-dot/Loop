"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createFeedPost, reactToPost, toggleSave } from "@/app/actions/feed";
import { LineIcon } from "@/components/line-icon";
import { makeT, type Locale } from "@/lib/i18n";

const REACTIONS = { like: "👍", love: "❤️", laugh: "😂", wow: "😮", sad: "😢", clap: "👏" } as const;
type Kind = keyof typeof REACTIONS;

// The row under a post: react, comment, share, save.
export function PostActions({
  postId, reactionCount, commentCount, myReaction, saved, canShare, locale,
}: {
  postId: string; reactionCount: number; commentCount: number; myReaction: Kind | null; saved: boolean; canShare: boolean; locale: Locale;
}) {
  const t = makeT(locale);
  const [mine, setMine] = useState<Kind | null>(myReaction);
  const [count, setCount] = useState(reactionCount);
  const [isSaved, setSaved] = useState(saved);
  const [picker, setPicker] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [, start] = useTransition();

  function react(kind: Kind | null) {
    setPicker(false);
    const before = mine;
    setCount((c) => c + (kind && !before ? 1 : !kind && before ? -1 : 0));
    setMine(kind);
    start(async () => {
      const res = await reactToPost(postId, kind);
      if (res?.error) {
        setMine(before);
        setCount(reactionCount);
        setNote(res.error);
      }
    });
  }
  function save() {
    const next = !isSaved;
    setSaved(next);
    start(async () => {
      const res = await toggleSave(postId, next);
      if (res?.error) setSaved(!next);
    });
  }
  function share() {
    start(async () => {
      const res = await createFeedPost({ body: "", kind: "repost", clubId: null, imagePath: null, repostOf: postId });
      setNote(res?.error ?? res?.message ?? t("Shared to your school."));
    });
  }

  return (
    <footer className="mt-auto pt-3">
      <div className="relative flex items-center gap-1 text-ink-2">
        {picker && (
          <div role="menu" className="absolute bottom-9 start-0 z-10 flex gap-0.5 rounded-full border border-brand-700/10 bg-white p-1 shadow-lg">
            {(Object.keys(REACTIONS) as Kind[]).map((k) => (
              <button key={k} type="button" role="menuitem" onClick={() => react(k)} aria-label={k} className="rounded-full px-1.5 py-0.5 text-xl hover:bg-brand-50">
                {REACTIONS[k]}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => (mine ? react(null) : react("like"))}
          onContextMenu={(e) => { e.preventDefault(); setPicker((p) => !p); }}
          aria-pressed={!!mine}
          aria-label={mine ? t("Remove your reaction") : t("Like")}
          className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium hover:bg-brand-50 ${mine ? "text-brand-800" : ""}`}
        >
          {mine ? <span className="text-base leading-none">{REACTIONS[mine]}</span> : <LineIcon name="heart" className="size-[18px]" />}
          <span className="tabular-nums" data-testid="reaction-count">{count}</span>
        </button>
        <button type="button" onClick={() => setPicker((p) => !p)} aria-label={t("Choose a reaction")} aria-expanded={picker} className="rounded-full px-1.5 py-1 text-xs hover:bg-brand-50">
          ＋
        </button>
        <Link href={`/post/${postId}`} aria-label={t("Comments")} className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium hover:bg-brand-50">
          <LineIcon name="comment" className="size-[18px]" />
          <span className="tabular-nums">{commentCount}</span>
        </Link>
        {canShare && (
          <button type="button" onClick={share} className="rounded-full px-2 py-1 text-xs font-medium hover:bg-brand-50">
            {t("Share")}
          </button>
        )}
        <button type="button" onClick={save} aria-pressed={isSaved} aria-label={isSaved ? t("Remove from saved") : t("Save")} className={`ms-auto rounded-full p-1.5 hover:bg-brand-50 ${isSaved ? "text-brand-700" : ""}`}>
          <LineIcon name="bookmark" className="size-[18px]" strokeWidth={isSaved ? 2.6 : 1.7} />
        </button>
      </div>
      {note && <p role="status" className="mt-1 text-xs text-ink-2">{note}</p>}
    </footer>
  );
}
