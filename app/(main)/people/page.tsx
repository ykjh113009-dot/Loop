import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Find students" };

async function People({ searchParams }: { searchParams: PageProps<"/people">["searchParams"] }) {
  const me = await requireMe();
  const supabase = await createClient();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 50) : "";
  const grade = typeof sp.grade === "string" ? Number(sp.grade) : null;
  const interest = typeof sp.interest === "string" ? sp.interest : "";

  const { data: interests } = await supabase.from("interests").select("id, slug, name, emoji").order("name");
  const picked = interests?.find((i) => i.slug === interest);

  let query = supabase
    .from("profiles")
    .select(picked ? "id, full_name, avatar, grade, bio, profile_interests!inner(interest_id)" : "id, full_name, avatar, grade, bio")
    .not("onboarded_at", "is", null)
    .is("deactivated_at", null)
    .neq("id", me.id)
    .order("full_name")
    .limit(60);
  // Remove characters that have a special meaning in search patterns.
  if (q) query = query.ilike("full_name", `%${q.replace(/[%_\\,()]/g, "")}%`);
  if (grade) query = query.eq("grade", grade);
  if (picked) query = query.eq("profile_interests.interest_id", picked.id);
  const { data } = await query;
  const people = (data ?? []) as unknown as { id: string; full_name: string; avatar: string; grade: number | null; bio: string }[];

  const link = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const next = { q, grade: grade ? String(grade) : "", interest, ...changes };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    return `/people?${params}`;
  };

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search by name" className="input" aria-label="Search by name" />
        {grade && <input type="hidden" name="grade" value={grade} />}
        {interest && <input type="hidden" name="interest" value={interest} />}
        <button className="btn-primary">Search</button>
      </form>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Link href={link({ grade: null })} className={`chip shrink-0 ${!grade ? "bg-brand-700 text-white" : ""}`}>All grades</Link>
        {me.school.grades.map((g) => (
          <Link key={g} href={link({ grade: String(g) })} className={`chip shrink-0 ${grade === g ? "bg-brand-700 text-white" : ""}`}>
            Grade {g}
          </Link>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {picked && <Link href={link({ interest: null })} className="chip shrink-0 bg-brand-700 text-white">{picked.emoji} {picked.name} ✕</Link>}
        {interests?.filter((i) => i.slug !== interest).map((i) => (
          <Link key={i.id} href={link({ interest: i.slug })} className="chip shrink-0">{i.emoji} {i.name}</Link>
        ))}
      </div>

      {people.length === 0 ? (
        <Empty emoji="🔍" title="No students found">Try a different name or filter.</Empty>
      ) : (
        <ul className="card divide-y divide-black/5">
          {people.map((p) => (
            <li key={p.id}>
              <Link href={`/profile/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]">
                <Avatar avatar={p.avatar} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.full_name}</p>
                  <p className="truncate text-xs text-black/50">Grade {p.grade}{p.bio && ` · ${p.bio}`}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PeoplePage(props: PageProps<"/people">) {
  return (
    <>
      <PageHeader title="Find students" />
      <Suspense fallback={<PageSkeleton />}>
        <People searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
