import { Suspense } from "react";
import Link from "next/link";
import { getClub } from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";
import { personLabel } from "@/lib/people";
import { Avatar } from "@/components/avatar";
import { PageSkeleton } from "@/components/skeleton";

async function Members({ params }: { params: PageProps<"/clubs/[id]/members">["params"] }) {
  const { id } = await params;
  const { club } = await getClub(id);
  const supabase = await createClient();
  const { data } = await supabase
    .from("club_members")
    .select("role, joined_at, profile:profiles(id, full_name, avatar, grade, role, alumni_year)")
    .eq("club_id", club.id)
    .order("joined_at");
  // Leaders first, then everyone else alphabetically.
  const members = (data ?? []).sort(
    (a, b) =>
      (a.role === "leader" ? 0 : 1) - (b.role === "leader" ? 0 : 1) ||
      (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? ""),
  );

  return (
    <ul className="card divide-y divide-black/5">
      {members.map((m) =>
        m.profile ? (
          <li key={m.profile.id}>
            <Link href={`/profile/${m.profile.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]">
              <Avatar avatar={m.profile.avatar} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.profile.full_name}</p>
                <p className="text-xs text-black/50">{personLabel(m.profile)}</p>
              </div>
              {m.role === "leader" && <span className="chip bg-brand-50 text-brand-800">Leader</span>}
            </Link>
          </li>
        ) : null,
      )}
    </ul>
  );
}

export default function ClubMembersPage(props: PageProps<"/clubs/[id]/members">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Members params={props.params} />
    </Suspense>
  );
}
