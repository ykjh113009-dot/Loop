import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { personLabel } from "@/lib/people";
import { formatActivityTime } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Search" };

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  await requireMe();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 50) : "";
  if (q.length < 2) return <Empty emoji="🔎" title="Type at least 2 letters">Search for students, clubs and events.</Empty>;

  const like = `%${q.replace(/[%_\\,()]/g, "")}%`;
  const supabase = await createClient();
  const [{ data: people }, { data: clubs }, { data: events }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar, grade, role, alumni_year").is("deactivated_at", null).ilike("full_name", like).order("full_name").limit(8),
    supabase.from("clubs").select("id, name, emoji, description").eq("status", "approved").ilike("name", like).order("name").limit(8),
    supabase.from("events").select("id, title, starts_at, ends_at, location").eq("status", "approved").ilike("title", like).order("starts_at", { ascending: false }).limit(8),
  ]);
  const none = !people?.length && !clubs?.length && !events?.length;
  if (none) return <Empty emoji="🔎" title={`Nothing found for "${q}"`}>Try a different spelling.</Empty>;

  return (
    <div className="space-y-5">
      {!!people?.length && (
        <section>
          <h2 className="section-title">Students</h2>
          <ul className="card divide-y divide-brand-700/10">
            {people.map((p) => (
              <li key={p.id}>
                <Link href={`/profile/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50">
                  <Avatar avatar={p.avatar} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.full_name}</span>
                    <span className="block text-xs text-ink-2">{personLabel(p)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!clubs?.length && (
        <section>
          <h2 className="section-title">Clubs</h2>
          <ul className="card divide-y divide-brand-700/10">
            {clubs.map((c) => (
              <li key={c.id}>
                <Link href={`/clubs/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sage-soft/70 text-xl">{c.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-ink-2">{c.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!events?.length && (
        <section>
          <h2 className="section-title">Events</h2>
          <ul className="card divide-y divide-brand-700/10">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="block px-4 py-3 hover:bg-brand-50">
                  <span className="block truncate font-medium">{e.title}</span>
                  <span className="block text-xs text-ink-2">{formatActivityTime(e.starts_at, e.ends_at)}{e.location ? ` · ${e.location}` : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <div className="space-y-4">
      <PageHeader title="Search" />
      <form action="/search" method="get" role="search" className="lg:hidden">
        <input name="q" type="search" maxLength={50} placeholder="Search in Loop…" aria-label="Search in Loop" className="input" />
      </form>
      <Suspense fallback={<PageSkeleton />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
