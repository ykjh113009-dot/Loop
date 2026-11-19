import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClubCard, type ClubSummary } from "@/components/club-card";
import { LayoutGrid, Volleyball, GraduationCap, Laptop, Globe, Heart, Search, Plus } from "lucide-react";
import { signClubImages } from "@/lib/images";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Clubs" };

const CATS = [["sports", "Sports", Volleyball], ["academics", "Academics", GraduationCap], ["tech", "Tech", Laptop], ["culture", "Culture", Globe], ["charity", "Charity", Heart]] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for a moderator",
  rejected: "Not approved",
  archived: "Closed",
};

async function Clubs({ searchParams }: { searchParams: PageProps<"/clubs">["searchParams"] }) {
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data: clubs }, { data: memberships }, { data: myRequests }] = await Promise.all([
    supabase.from("clubs").select("id, name, emoji, description, status, category, recruiting, image_path, club_members(count)").eq("status", "approved").order("name"),
    supabase.from("club_members").select("club_id").eq("profile_id", me.id),
    supabase.from("clubs").select("id, name, emoji, status, review_note").eq("requested_by", me.id).neq("status", "approved"),
  ]);
  const clubIds = (clubs ?? []).map((c) => c.id);
  const [{ data: leaderRows }, { data: eventRows }] = clubIds.length
    ? await Promise.all([
        supabase.from("club_members").select("club_id, profile:profiles(full_name)").in("club_id", clubIds).eq("role", "leader"),
        supabase.from("events").select("club_id, starts_at").in("club_id", clubIds).eq("status", "approved").gt("starts_at", new Date().toISOString()).order("starts_at"),
      ])
    : [{ data: [] }, { data: [] }];
  const leadersOf = new Map<string, string[]>();
  for (const r of leaderRows ?? []) if (r.profile) leadersOf.set(r.club_id, [...(leadersOf.get(r.club_id) ?? []), r.profile.full_name]);
  const nextOf = new Map<string, string>();
  for (const e of eventRows ?? []) if (e.club_id && !nextOf.has(e.club_id)) nextOf.set(e.club_id, e.starts_at);
  const images = await signClubImages(supabase, (clubs ?? []).map((c) => c.image_path));
  const { requested, picture, cat: rawCat, q: rawQ } = await searchParams;
  const cat = typeof rawCat === "string" && CATS.some(([k]) => k === rawCat) ? rawCat : "";
  const query = typeof rawQ === "string" ? rawQ.trim().slice(0, 40).toLowerCase() : "";
  const mine = new Set((memberships ?? []).map((m) => m.club_id));
  const all = ((clubs ?? []) as ClubSummary[]).filter((c) => (!cat || c.category === cat) && (!query || c.name.toLowerCase().includes(query)));
  const joined = all.filter((c) => mine.has(c.id));
  const others = all.filter((c) => !mine.has(c.id));

  const pill = (active: boolean) => `inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium ${active ? "border-brand-700 bg-brand-700 text-white" : "border-brand-700/10 bg-white/80 text-ink-2 hover:bg-white"}`;
  const href = (c: string) => `/clubs${c || query ? `?${new URLSearchParams({ ...(c ? { cat: c } : {}), ...(query ? { q: query } : {}) })}` : ""}`;
  return (
    <div className="space-y-5" data-clubs-page data-wide>
      <section className="relative isolate h-[150px] overflow-hidden rounded-3xl bg-[#e9ead6] lg:h-[180px]" data-banner>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand artwork */}
        <img src="/brand/clubs-hero.png" alt="" width={600} height={180} className="pointer-events-none absolute end-0 bottom-0 -z-10 h-full w-auto max-w-[75%] object-contain object-right-bottom rtl:-scale-x-100" />
        <div className="px-5 pt-5 lg:px-8 lg:pt-7">
          <h1 className="font-heading text-[34px] leading-none font-semibold text-brand-900 lg:text-[52px]" data-banner-title>Clubs</h1>
          <p className="mt-2 max-w-[60%] text-[13px] text-ink-2 lg:mt-3 lg:text-lg">Find your people. Join clubs that match your interests.</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <form role="search" className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-ink-2" aria-hidden="true" />
          {cat && <input type="hidden" name="cat" value={cat} />}
          <input name="q" defaultValue={query} maxLength={40} placeholder="Search clubs…" aria-label="Search clubs" className="input !rounded-full !ps-11" />
        </form>
        {me.isStudent && !me.isSuspended && <Link href="/clubs/new" className="btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2.5"><Plus className="size-4" aria-hidden="true" />Request a club</Link>}
      </div>

      <nav aria-label="Club categories" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" data-club-filters>
        <Link href={href("")} aria-current={!cat ? "page" : undefined} className={pill(!cat)}><LayoutGrid className="size-[18px]" aria-hidden="true" />All Clubs</Link>
        {CATS.map(([k, label, Icon]) => <Link key={k} href={href(k)} aria-current={cat === k ? "page" : undefined} className={pill(cat === k)}><Icon className="size-[18px]" aria-hidden="true" />{label}</Link>)}
      </nav>

      {requested && (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
          🎉 Your club request was sent. A moderator will review it and you&apos;ll get a notification.{picture === "failed" ? " The picture didn&apos;t upload. You can add it from the club's Manage page once it is approved." : ""}
        </p>
      )}

      {myRequests && myRequests.length > 0 && (
        <section>
          <h2 className="section-title">Your requests</h2>
          <div className="space-y-2">
            {myRequests.map((r) => (
              <div key={r.id} className="card flex items-center gap-3 p-3 text-sm">
                <span className="text-xl">{r.emoji}</span>
                <span className="flex-1 font-medium">{r.name}</span>
                <span className="text-xs text-black/50">{STATUS_LABEL[r.status]}{r.review_note ? ` — ${r.review_note}` : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(() => {
        const card = (c: ClubSummary, opts: { joined?: boolean; featured?: boolean } = {}) => (
          <ClubCard key={c.id} club={c} imageUrl={c.image_path ? images.get(c.image_path) : null} joined={opts.joined} featured={opts.featured} canJoin={me.isStudent && !me.isSuspended} leaders={leadersOf.get(c.id)} nextAt={nextOf.get(c.id)} />
        );
        const grid = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";
        const members = (c: ClubSummary) => c.club_members?.[0]?.count ?? 0;
        const ranked = [...others].sort((x, y) => members(y) - members(x) || x.name.localeCompare(y.name));
        // With a category or a search, show one simple list of what matches.
        const filtered = !!(cat || query);
        const featured = filtered ? [] : ranked.slice(0, 3);
        const popular = filtered ? [] : ranked.slice(3, 9);
        const rest = filtered ? ranked : ranked.slice(9);
        return (
          <>
            {featured.length > 0 && (
              <section data-clubs-section="featured">
                <h2 className="section-title">Featured Clubs</h2>
                <div className={grid}>{featured.map((c) => card(c, { featured: true }))}</div>
              </section>
            )}
            {joined.length > 0 && (
              <section data-clubs-section="mine">
                <h2 className="section-title">My Clubs</h2>
                <div className={grid}>{joined.map((c) => card(c, { joined: true }))}</div>
              </section>
            )}
            {popular.length > 0 && (
              <section data-clubs-section="popular">
                <h2 className="section-title">Popular Clubs</h2>
                <div className={grid}>{popular.map((c) => card(c))}</div>
              </section>
            )}
            <section data-clubs-section="discover">
              {(rest.length > 0 || filtered) && <h2 className="section-title">{filtered ? `${others.length + joined.length} ${others.length + joined.length === 1 ? "club" : "clubs"}` : "Discover Clubs"}</h2>}
              {rest.length ? (
                <div className={grid}>{rest.map((c) => card(c))}</div>
              ) : filtered && others.length === 0 && joined.length === 0 ? (
                <EmptyState scene="community" title="No clubs match that" action={{ href: "/clubs", label: "See all clubs" }}>Try another category or a different name.</EmptyState>
              ) : joined.length === 0 && featured.length === 0 ? (
                <EmptyState scene="community" title="No clubs here yet. Be the first to start one!" action={me.isStudent && !me.isSuspended ? { href: "/clubs/new", label: "Request a club" } : undefined}>Find your people. Join clubs that match your interests.</EmptyState>
              ) : null}
            </section>
          </>
        );
      })()}
    </div>
  );
}

export default function ClubsPage(props: PageProps<"/clubs">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Clubs searchParams={props.searchParams} />
    </Suspense>
  );
}
