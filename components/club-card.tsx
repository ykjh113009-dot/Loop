import Link from "next/link";
import { Users, Crown } from "lucide-react";
import { joinClub } from "@/app/actions/clubs";
import { SubmitButton } from "@/components/submit-button";
import { formatDateTime } from "@/lib/time";
import { ClubIcon } from "@/components/club-icon";
import { Glyph } from "@/components/glyph";

export type ClubSummary = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  status: string;
  category?: string;
  recruiting?: string;
  image_path?: string | null;
  club_members: { count: number }[];
};

// One club: icon, name, a one-line pitch, who runs it, and a Join button.
export function ClubCard({ club, joined = false, leaders = [], nextAt = null, canJoin = true, imageUrl = null, featured = false }: { club: ClubSummary; joined?: boolean; leaders?: string[]; nextAt?: string | null; canJoin?: boolean; imageUrl?: string | null; featured?: boolean }) {
  const members = club.club_members?.[0]?.count ?? 0;
  const pitch = club.description.split(/(?<=[.!?])\s/)[0] ?? "";
  return (
    <article className={`relative flex flex-col gap-3 overflow-hidden rounded-3xl border border-brand-700/10 bg-white/85 shadow-[0_1px_2px_rgba(40,60,40,0.04)] ${featured ? "" : "p-4"}`} data-club={club.name} data-club-featured={featured ? "true" : undefined}>
      {featured && (
        <div className="relative h-28 w-full bg-gradient-to-br from-sage-soft to-[#dbe5cc]" aria-hidden="true">
          {imageUrl
            // eslint-disable-next-line @next/next/no-img-element -- signed private image
            ? <img src={imageUrl} alt="" loading="lazy" className="size-full object-cover" />
            : <span className="flex size-full items-center justify-center text-5xl"><Glyph e={club.emoji} /></span>}
          <span className="absolute start-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand-800">Featured</span>
        </div>
      )}
      <div className={featured ? "flex flex-col gap-3 px-4 pb-4" : "contents"}>
      <Link href={`/clubs/${club.id}`} className="flex items-center gap-3.5 after:absolute after:inset-0 after:rounded-3xl" aria-label={club.name}>
        {!featured && <ClubIcon emoji={club.emoji} url={imageUrl} />}
        <span className="min-w-0">
          <span className="block truncate text-[17px] font-semibold">{club.name}</span>
          <span className="line-clamp-2 text-sm text-ink-2">{pitch}</span>
        </span>
      </Link>
      {nextAt && <p className="truncate text-xs font-medium text-brand-700" data-club-next><Glyph e="📅" /> Next: {formatDateTime(nextAt)}</p>}
      <div className="mt-auto flex items-center gap-3 text-xs text-ink-2">
        <span className="inline-flex shrink-0 items-center gap-1.5"><Users className="size-4" strokeWidth={1.7} aria-hidden="true" />{members} {members === 1 ? "member" : "members"}</span>
        {leaders.length > 0 && <span className="inline-flex min-w-0 items-center gap-1.5 border-s border-brand-700/10 ps-3" data-club-leaders><Crown className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" /><span className="truncate">Run by {leaders.join(", ")}</span></span>}
        <span className="relative z-10 ms-auto shrink-0">
          {joined ? (
            <span className="inline-flex items-center rounded-full bg-sage-soft px-3.5 py-2 text-sm font-semibold text-brand-800"><Glyph e="✓" /> Joined</span>
          ) : !canJoin || club.recruiting === "closed" ? (
            club.recruiting === "closed" ? <span className="text-xs text-ink-2">Not taking members</span> : null
          ) : club.recruiting === "application" ? (
            <Link href={`/clubs/${club.id}`} className="btn-primary inline-flex rounded-full px-6 py-2 text-sm">Apply</Link>
          ) : (
            <form action={joinClub}>
              <input type="hidden" name="clubId" value={club.id} />
              <SubmitButton className="btn-primary rounded-full px-6 py-2 text-sm" pendingText="…">Join</SubmitButton>
            </form>
          )}
        </span>
      </div>
      </div>
    </article>
  );
}
