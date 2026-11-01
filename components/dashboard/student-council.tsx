import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { IconTile, DashCard } from "@/components/dashboard/card";

export async function StudentCouncil() {
  await requireMe();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: members }, { data: elections }] = await Promise.all([
    supabase.from("council_members").select("position, profile:profiles(id, full_name, avatar)").order("sort").limit(4),
    supabase.from("elections").select("id, title, opens_at, closes_at").gt("closes_at", now).order("opens_at").limit(1),
  ]);
  const election = elections?.[0];
  const open = election && election.opens_at <= now;
  return (
    <DashCard title="Student Council" href="/council" linkLabel="View all">
      <div className="flex items-center gap-3">
        <IconTile name="shield" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Student Council</p>
          <p className="text-xs text-ink-2">{(members ?? []).length > 0 ? `${(members ?? []).length}${(members ?? []).length === 4 ? "+" : ""} members` : "No members listed yet"}</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-brand-50/70 px-3 py-2.5 text-sm">
        {election ? (
          <>
            <p className="text-xs font-medium text-ink-2">{open ? "Vote open now" : "Next vote"}</p>
            <p className="font-semibold">{election.title}</p>
            <p className="text-xs text-ink-2">{open ? `Closes ${formatShortDate(election.closes_at)}` : `Opens ${formatShortDate(election.opens_at)}`}</p>
          </>
        ) : (
          <p className="text-ink-2">No votes or proposals right now. Have an idea? Send the council a suggestion.</p>
        )}
      </div>
      {(members ?? []).some((m) => m.profile) && (
        <div className="mt-3 flex -space-x-2">
          {(members ?? []).map((m) => m.profile && (
            <Link key={m.profile.id} href={`/profile/${m.profile.id}`} title={`${m.profile.full_name} · ${m.position}`}>
              <Avatar avatar={m.profile.avatar} size="sm" className="ring-2 ring-white" />
            </Link>
          ))}
        </div>
      )}
      <Link href={election ? `/council/elections/${election.id}` : "/suggestions"} className="mt-3 inline-flex rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-800">
        {election ? "View Updates" : "Send a suggestion"}
      </Link>
    </DashCard>
  );
}
