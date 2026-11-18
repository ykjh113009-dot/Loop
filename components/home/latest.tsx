import Link from "next/link";
import { Megaphone, Heart, MessageCircle, BadgeCheck } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { loadFeed } from "@/lib/feed";
import { timeAgo } from "@/lib/time";
import { Avatar } from "@/components/avatar";

type Row = { key: string; href: string; official: boolean; name: string; avatar?: string; when: string; sub: string; title: string; text: string; likes?: number; comments?: number; image?: string };

// The newest school announcements and posts, mixed, newest first.
export async function LatestFromLoop() {
  const me = await requireMe();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: ann }, posts] = await Promise.all([
    supabase.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(2),
    loadFeed(supabase, me.id, { feed: true, tag: null, limit: 3, offset: 0 }),
  ]);
  const rows: Row[] = [
    ...(ann ?? []).map((a) => ({ key: "a" + a.id, href: "/announcements", official: true, name: t("School"), when: a.created_at, sub: t("Official"), title: a.title, text: a.body.replace(/\s+/g, " ").slice(0, 120) })),
    ...posts.map((p) => {
      const lines = p.body.trim().split("\n");
      return { key: "p" + p.id, href: `/post/${p.id}`, official: false, name: p.author?.full_name ?? "", avatar: p.author?.avatar, when: p.created_at, sub: p.club?.name ?? t("Whole school"), title: lines[0].slice(0, 80), text: lines.slice(1).join(" ").slice(0, 120), likes: p.reaction_count, comments: p.comment_count, image: p.imageUrl };
    }),
  ].sort((a, b) => +new Date(b.when) - +new Date(a.when)).slice(0, 4);
  return (
    <section className="rounded-2xl border border-brand-700/10 bg-white/80 p-4 lg:p-5" data-card="latest">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold"><Megaphone className="size-5 text-brand-700" strokeWidth={1.8} aria-hidden="true" />{t("Latest from Loop")}</h2>
        <Link href="/community" className="text-xs font-medium text-brand-700 hover:underline">{t("See all")} →</Link>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-sage-soft/40 px-4 py-8 text-center text-sm text-ink-2">{t("Nothing new yet. School news and posts will show up here.")}</p>
      ) : (
        <ul className="divide-y divide-brand-700/10">
          {rows.map((r) => (
            <li key={r.key} className="py-3.5 first:pt-0 last:pb-0">
              <Link href={r.href} className="flex gap-3">
                <span className="mt-0.5 shrink-0">
                  {r.official ? <span className="flex size-11 items-center justify-center rounded-full bg-sage-soft text-brand-700"><Megaphone className="size-5" strokeWidth={1.8} aria-hidden="true" /></span> : <Avatar avatar={r.avatar ?? "a01"} size="md" className="!size-11" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-xs"><span className="font-semibold text-ink">{r.name}</span>{r.official && <BadgeCheck className="size-3.5 text-brand-700" aria-hidden="true" />}<span className="text-ink-2">· {timeAgo(r.when)} · {r.sub}</span></span>
                  <span className="mt-0.5 block text-[15px] font-semibold">{r.title}</span>
                  {r.text && <span className="line-clamp-2 text-[13px] text-ink-2">{r.text}</span>}
                  {r.likes !== undefined && <span className="mt-1.5 flex gap-4 text-xs text-ink-2"><span className="inline-flex items-center gap-1"><Heart className="size-3.5" aria-hidden="true" />{r.likes}</span><span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" aria-hidden="true" />{r.comments}</span></span>}
                </span>
                {r.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- compressed on upload
                  <img src={r.image} alt="" loading="lazy" className="hidden h-24 w-36 shrink-0 rounded-xl bg-black/5 object-cover sm:block" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
