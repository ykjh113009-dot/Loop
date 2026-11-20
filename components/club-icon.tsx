import { Glyph } from "@/components/glyph";
// A club's picture when it has one, otherwise its emoji, in a round sage badge.
export function ClubIcon({ emoji, url, className = "size-[60px] text-3xl" }: { emoji: string; url?: string | null; className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage-soft ${className}`} aria-hidden="true">
      {url
        // eslint-disable-next-line @next/next/no-img-element -- signed private image
        ? <img src={url} alt="" loading="lazy" className="size-full object-cover" />
        : <Glyph e={emoji} className="text-brand-800" strokeWidth={1.6} />}
    </span>
  );
}
