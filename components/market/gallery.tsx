"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

// A picture gallery that works for one picture, several pictures or none.
// The pictures sit in a row you can swipe on a phone (the page can still scroll up and down); arrows and thumbnails do the same on a computer.
export function Gallery({ images, alt, labels }: { images: string[]; alt: string; labels: { prev: string; next: string; none: string; picture: (n: number) => string } }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

  function go(n: number) {
    const el = track.current;
    if (!el || count === 0) return;
    const to = Math.min(count - 1, Math.max(0, n));
    el.scrollTo({ left: Math.sign(el.scrollLeft || 1) * to * el.clientWidth, behavior: "smooth" });
    setIndex(to);
  }
  function onScroll() {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    setIndex(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  }

  if (count === 0) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-sand to-sage-soft/60 text-brand-800/70" data-gallery-empty>
        <ImageOff className="size-12" strokeWidth={1.2} aria-hidden="true" />
        <span className="text-sm">{labels.none}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-gallery>
      <div className="relative">
        <div ref={track} onScroll={onScroll} tabIndex={0} onKeyDown={(e) => { if (e.key === "ArrowRight") go(index + 1); if (e.key === "ArrowLeft") go(index - 1); }}
          className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-2xl bg-gradient-to-br from-sand to-sage-soft/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-roledescription="carousel" aria-label={alt}>
          {images.map((src, i) => (
            <div key={src} className="flex size-full shrink-0 snap-center items-center justify-center" aria-label={labels.picture(i + 1)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- private signed link */}
              <img src={src} alt={i === 0 ? alt : ""} draggable={false} loading={i === 0 ? "eager" : "lazy"} className="max-h-full max-w-full object-contain" />
            </div>
          ))}
        </div>
        {count > 1 && (
          <>
            <span className="pointer-events-none absolute start-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white tabular-nums" data-gallery-counter>{index + 1} / {count}</span>
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label={labels.prev} className="absolute start-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow hover:bg-white disabled:opacity-40 md:flex"><ChevronLeft className="size-5 rtl:rotate-180" aria-hidden="true" /></button>
            <button type="button" onClick={() => go(index + 1)} disabled={index === count - 1} aria-label={labels.next} className="absolute end-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow hover:bg-white disabled:opacity-40 md:flex"><ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" /></button>
          </>
        )}
      </div>
      {count > 1 && (
        <>
          <div className="flex justify-center gap-1.5 md:hidden" aria-hidden="true" data-gallery-dots>
            {images.map((src, i) => <span key={src} className={`size-2 rounded-full transition-colors ${i === index ? "bg-brand-700" : "bg-black/15"}`} />)}
          </div>
          <div className="hidden gap-2 md:flex" data-gallery-thumbs>
            {images.map((src, i) => (
              <button key={src} type="button" onClick={() => go(i)} aria-label={labels.picture(i + 1)} aria-current={i === index} className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-sand/60 transition-colors ${i === index ? "border-brand-700" : "border-transparent opacity-80 hover:opacity-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- private signed link */}
                <img src={src} alt="" draggable={false} className="size-full object-cover" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
