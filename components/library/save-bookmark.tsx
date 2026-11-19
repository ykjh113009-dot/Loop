"use client";

import { useState, useTransition } from "react";
import { saveToLibrary } from "@/app/actions/library";
import { Bookmark } from "lucide-react";

// The bookmark on a resource tile: saves it to (or removes it from) My Library.
export function SaveBookmark({ id, saved, label, savedLabel }: { id: string; saved: boolean; label: string; savedLabel: string }) {
  const [on, setOn] = useState(saved);
  const [, start] = useTransition();
  function toggle() {
    const next = !on;
    setOn(next);
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("on", next ? "1" : "0");
      const res = await saveToLibrary(null, fd);
      if (res?.error) setOn(!next);
    });
  }
  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={on ? savedLabel : label} className={`relative z-10 rounded-full p-1.5 hover:bg-sage-soft/60 ${on ? "text-brand-700" : "text-ink-2"}`} data-save-bookmark>
      <Bookmark className={`size-5 ${on ? "fill-brand-700" : ""}`} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
