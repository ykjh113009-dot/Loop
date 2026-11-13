import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { personLabel } from "@/lib/people";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Connections" };
const PERSON = "id, full_name, avatar, grade, role, alumni_year, deactivated_at";
type Person = { id: string; full_name: string; avatar: string; grade: number | null; role: string; alumni_year: number | null; deactivated_at: string | null };

async function Connections({ params, searchParams }: { params: PageProps<"/profile/[id]/connections">["params"]; searchParams: PageProps<"/profile/[id]/connections">["searchParams"] }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "followers" || rawTab === "following" ? rawTab : "friends";
  await requireMe();
  const supabase = await createClient();
  const { t } = await getT();

  let people: (Person | null)[] = [];
  if (tab === "followers") {
    const { data } = await supabase.from("follows").select(`p:profiles!follows_follower_id_fkey(${PERSON})`).eq("followed_id", id).limit(500);
    people = (data ?? []).map((r) => r.p as Person | null);
  } else if (tab === "following") {
    const { data } = await supabase.from("follows").select(`p:profiles!follows_followed_id_fkey(${PERSON})`).eq("follower_id", id).limit(500);
    people = (data ?? []).map((r) => r.p as Person | null);
  } else {
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.from("friendships").select(`p:profiles!friendships_b_id_fkey(${PERSON})`).eq("a_id", id).limit(500),
      supabase.from("friendships").select(`p:profiles!friendships_a_id_fkey(${PERSON})`).eq("b_id", id).limit(500),
    ]);
    people = [...(a ?? []), ...(b ?? [])].map((r) => r.p as Person | null);
  }
  const list = people.filter((p): p is Person => !!p && !p.deactivated_at).sort((x, y) => x.full_name.localeCompare(y.full_name));
  const tabs = [["friends", t("Friends")], ["followers", t("Followers")], ["following", t("Following")]] as const;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("Connections")} back={`/profile/${id}`} />
      <div className="mb-4 flex gap-1 rounded-xl bg-black/5 p-1">
        {tabs.map(([key, label]) => (
          <Link key={key} href={`/profile/${id}/connections?tab=${key}`} className={`flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium ${tab === key ? "bg-white shadow-sm" : "text-black/55"}`}>
            {label}
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="card p-4 text-sm text-black/55">{t("Nobody here yet.")}</p>
      ) : (
        <ul className="card divide-y divide-black/5">
          {list.map((p) => (
            <li key={p.id}>
              <Link href={`/profile/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-black/[0.02]">
                <Avatar avatar={p.avatar} size="md" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.full_name}</span>
                  <span className="block text-xs text-black/50">{personLabel(p)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ConnectionsPage(props: PageProps<"/profile/[id]/connections">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Connections params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
