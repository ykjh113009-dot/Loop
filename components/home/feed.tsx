import Link from "next/link";
import { Megaphone, BadgeCheck, ChevronRight } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyClubs } from "@/lib/dashboard";
import { loadFeed } from "@/lib/feed";
import { getT } from "@/lib/i18n-server";
import { timeAgo } from "@/lib/time";
import { Empty } from "@/components/empty";
import { contentPowers } from "@/lib/content-powers";
import { FeedPostCard } from "@/components/dashboard/feed-post";
import { HomeComposer } from "@/components/dashboard/home-composer";

const PAGE = 8;

// The school feed on Home: the same posts, composer and actions as before, with the newest announcements on top.
export async function HomeFeed({ show }: { show?: string }) {
  const me = await requireMe();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const shown = Math.min(Math.max(Number(show) || PAGE, PAGE), 100);
  const [clubs, posts, { data: ann }] = await Promise.all([
    getMyClubs(me.id),
    loadFeed(supabase, me.id, { feed: true, tag: null, limit: Math.min(shown, 50), offset: 0 }),
    supabase.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(2),
  ]);
  const more = shown > 50 ? await loadFeed(supabase, me.id, { feed: true, tag: null, limit: 50, offset: 50 }) : [];
  const all = [...posts, ...more].slice(0, shown);
  return (
    <section id="feed" className="scroll-mt-24 rounded-3xl border border-brand-700/10 bg-white/85 p-4 shadow-[0_1px_2px_rgba(40,60,40,0.04)] lg:p-5" data-card="feed">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[19px] font-semibold"><Megaphone className="size-5 text-brand-700" strokeWidth={1.8} aria-hidden="true" />{t("Feed")}</h2>
        {all.length >= shown && shown < 100 && <Link href={`/home?show=${shown + 20}#feed`} scroll={false} className="text-xs font-medium text-brand-700 hover:underline">{t("See all")} →</Link>}
      </header>
      {!me.isSuspended && <div className="mb-2 rounded-2xl bg-sage-soft/25 p-3"><HomeComposer clubs={clubs} avatar={me.avatar} schoolId={me.school_id} userId={me.id} locale={locale} /></div>}
      <div className="divide-y divide-brand-700/10">
        {(ann ?? []).map((a) => (
          <Link key={a.id} href="/announcements" className="group flex items-center gap-3 py-3" data-announcement>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sage-soft text-brand-700"><Megaphone className="size-5" strokeWidth={1.8} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1 rounded-2xl bg-sage-soft/50 px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-xs"><span className="font-semibold">{t("The School Admin")}</span><BadgeCheck className="size-3.5 text-brand-700" aria-hidden="true" /><span className="text-ink-2">{timeAgo(a.created_at)}</span></span>
              <span className="block truncate text-[15px] font-semibold">{a.title}</span>
              <span className="line-clamp-1 text-[13px] text-ink-2">{a.body.replace(/\s+/g, " ")}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-ink-2 rtl:rotate-180" aria-hidden="true" />
          </Link>
        ))}
        {all.length === 0 ? (
          <div className="py-4"><Empty emoji="✏️" title={t("No posts yet")}>{t("Be the first to share something with your school.")}</Empty></div>
        ) : (
          all.map((p) => <FeedPostCard key={p.id} post={p} meId={me.id} locale={locale} wide bare staff={me.isStaff ? contentPowers(me, "post") : undefined} />)
        )}
      </div>
      {all.length >= shown && shown < 100 && (
        <div className="pt-3 text-center"><Link href={`/home?show=${shown + 20}#feed`} scroll={false} className="btn-secondary rounded-full px-6">{t("Show more")}</Link></div>
      )}
    </section>
  );
}
