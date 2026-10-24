import Link from "next/link";

export type ClubSummary = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  status: string;
  club_members: { count: number }[];
};

export function ClubCard({ club, joined = false }: { club: ClubSummary; joined?: boolean }) {
  const members = club.club_members?.[0]?.count ?? 0;
  return (
    <Link href={`/clubs/${club.id}`} className="card flex items-center gap-3 p-3 hover:bg-black/[0.02]">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl">{club.emoji}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{club.name}</p>
        <p className="line-clamp-1 text-xs text-black/55">{club.description}</p>
      </div>
      <div className="shrink-0 text-right text-xs text-black/50">
        {members} {members === 1 ? "member" : "members"}
        {joined && <span className="block font-semibold text-brand-700">✓ Joined</span>}
      </div>
    </Link>
  );
}
