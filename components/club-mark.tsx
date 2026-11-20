// A club's small mark inside a line of text: its picture when it has one, otherwise its emoji.
import { Glyph } from "@/components/glyph";
// It works from the club's own data, so every club shows its own picture everywhere it appears.
export function ClubMark({ club, className = "size-4" }: { club: { id: string; emoji: string; image_path?: string | null }; className?: string }) {
  if (!club.image_path) return <span aria-hidden="true"><Glyph e={club.emoji} /></span>;
  const version = encodeURIComponent(club.image_path.split("/").pop() ?? "");
  return (
    // eslint-disable-next-line @next/next/no-img-element -- served through a signed redirect
    <img src={`/api/club-image/${club.id}?v=${version}`} alt="" loading="lazy" className={`inline-block shrink-0 rounded-full object-cover align-text-bottom ${className}`} />
  );
}
