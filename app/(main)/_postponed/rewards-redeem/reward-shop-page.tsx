// POSTPONED: the Reward Shop where students spend points. Not routed. See ../README.md.
import { Suspense } from "react";
import Link from "next/link";
import { Crown, Search, Star, Trophy } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { signImages } from "@/lib/images";
import { formatDate } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { PageSkeleton } from "@/components/skeleton";
import { GiftScene } from "@/components/art/scenes";
import { CATEGORIES, CATEGORY_LABEL, PrizeIcon, TrophyScene, Waves } from "@/components/shop/art";
import type { MyPoints } from "@/components/level-card";
import { Countdown } from "@/components/shop/countdown";
import { RedeemButton } from "./redeem-button";

export const metadata = { title: "Reward Shop" };

const STATUS_LABEL: Record<string, string> = { fulfilled: "Ready", pending: "Waiting for staff", cancelled: "Cancelled" };
const PERIOD_LABEL: Record<string, string> = { week: "Weekly competition", month: "Monthly competition", all: "All-time ranking" };

async function Shop({ searchParams }: { searchParams: PageProps<"/shop">["searchParams"] }) {
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const cat = typeof sp.cat === "string" && [...CATEGORIES, "other"].includes(sp.cat as never) ? sp.cat : "";
  const topFirst = sp.view === "top10";

  const [{ data: rewards }, { data: mine }, { data: my }, { data: staff }, { data: settings }, { data: prizes }] = await Promise.all([
    supabase.from("rewards").select("id, name, description, cost, kind, stock, per_student_limit, image_path, category").eq("active", true).order("cost"),
    supabase.from("reward_redemptions").select("id, reward_id, status, cost, note, created_at, reward:rewards(name)").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(30),
    supabase.rpc("my_points"),
    supabase.rpc("can_manage_points"),
    supabase.from("top10_settings").select("period, rules").maybeSingle(),
    supabase.from("top10_prizes").select("place, title, description, value, image_path, special").order("place"),
  ]);
  const period = settings?.period === "all" || settings?.period === "week" ? settings.period : "month";
  const [{ data: ranking }, { data: endsAt }] = await Promise.all([
    supabase.rpc("individual_leaderboard", { p_period: period, p_grade: null as unknown as number, p_limit: 50 }),
    supabase.rpc("top10_period_end", { p_period: period }),
  ]);
  const p = my as unknown as MyPoints;
  const balance = Number(p?.balance ?? 0);
  const owned = new Map<string, number>();
  for (const r of mine ?? []) if (r.status !== "cancelled") owned.set(r.reward_id, (owned.get(r.reward_id) ?? 0) + 1);
  const images = await signImages(supabase, [...(rewards ?? []).map((r) => r.image_path), ...(prizes ?? []).map((x) => x.image_path)]);

  const needle = q.toLowerCase();
  const shown = (rewards ?? []).filter((r) => (!cat || r.category === cat) && (!needle || r.name.toLowerCase().includes(needle) || r.description.toLowerCase().includes(needle)));
  const hasOther = (rewards ?? []).some((r) => r.category === "other");
  const chipHref = (c: string) => `/shop${c || q ? `?${new URLSearchParams({ ...(c ? { cat: c } : {}), ...(q ? { q } : {}) })}` : ""}`;
  const chips: [string, string][] = [["", "All"], ...CATEGORIES.map((c) => [c, CATEGORY_LABEL[c]] as [string, string]), ...(hasOther ? [["other", "Other"] as [string, string]] : [])];

  const top = (ranking ?? []).slice(0, 10);
  const myIndex = (ranking ?? []).findIndex((r) => r.profile_id === me.id);
  const tenth = (ranking ?? [])[9];
  const prizeSlots = Array.from({ length: 10 }, (_, i) => (prizes ?? []).find((x) => x.place === i + 1) ?? null);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]" data-shop-page data-wide>
      {/* ------------------------------ Reward Shop ------------------------------ */}
      <div className={`min-w-0 space-y-5 ${topFirst ? "order-2 xl:order-none" : ""}`} data-section="reward-shop">
        <section className="relative isolate overflow-hidden rounded-3xl border border-brand-700/10 bg-sand/70 px-5 py-6 lg:px-8 lg:py-8" data-shop-banner>
          <Waves className="pointer-events-none absolute inset-0 -z-10 size-full" />
          <GiftScene className="pointer-events-none absolute end-4 bottom-0 -z-10 hidden h-[115%] w-auto sm:block" />
          <h1 className="font-heading text-[34px] leading-none font-semibold text-brand-900 lg:text-[48px]" data-banner-title>{t("Reward Shop")}</h1>
          <p className="mt-2 max-w-[26rem] text-[13px] text-ink-2 lg:mt-3 lg:text-base">{t("Spend your Loop Points on exclusive rewards!")}</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-white/80 px-4 py-2 text-sm font-medium shadow-sm" data-testid="balance-chip">
            <Star className="size-4 text-gold" aria-hidden="true" />{t("Your Points")}: <strong className="tabular-nums" data-testid="balance">{balance.toLocaleString("en")}</strong> LP
          </p>
        </section>

        <form action="/shop" role="search" className="relative">
          {cat && <input type="hidden" name="cat" value={cat} />}
          <Search className="pointer-events-none absolute start-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-2" aria-hidden="true" />
          <input name="q" defaultValue={q} placeholder={t("Search for rewards...")} aria-label={t("Search for rewards...")} className="h-11 w-full rounded-full border border-black/10 bg-white pe-4 ps-11 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" />
        </form>

        <nav aria-label={t("Reward categories")} className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]" data-shop-categories>
          <ul className="flex min-w-max gap-2 py-1">
            {chips.map(([id, label]) => (
              <li key={id || "all"}><Link href={chipHref(id)} aria-current={cat === id ? "page" : undefined} className="opt px-5 py-2">{t(label)}</Link></li>
            ))}
          </ul>
        </nav>

        {shown.length === 0 ? (
          <div className="card px-6 py-10 text-center" data-empty-rewards>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-sage-soft text-brand-800"><PrizeIcon title="gift" strokeWidth={1.5} className="size-7" /></span>
            <p className="mt-3 font-semibold">{(rewards ?? []).length === 0 ? t("Rewards will appear here soon") : t("No rewards match your search")}</p>
            <p className="mt-1 text-sm text-ink-2">{(rewards ?? []).length === 0 ? t("Your school has not added rewards yet.") : t("Try another word or category.")}</p>
            {staff && <Link href="/admin/rewards" className="btn-secondary mt-4 rounded-full">{t("Add rewards")}</Link>}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3" data-reward-grid>
            {shown.map((r) => {
              const have = owned.get(r.id) ?? 0;
              const soldOut = r.stock !== null && r.stock <= 0;
              const full = have >= r.per_student_limit;
              const missing = r.cost - balance;
              const blocked = full ? t("You have it") : soldOut ? t("Sold out") : missing > 0 ? t("Need {n} more points", { n: missing }) : null;
              const img = r.image_path ? images.get(r.image_path) ?? null : null;
              const limited = r.stock !== null && !soldOut;
              return (
                <li key={r.id} className="card flex flex-col overflow-hidden" data-reward={r.id} data-category={r.category}>
                  <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-sand to-sage-soft/60 text-brand-800">
                    {img
                      // eslint-disable-next-line @next/next/no-img-element -- private signed link
                      ? <img src={img} alt="" loading="lazy" className="size-full object-cover" />
                      : <PrizeIcon title={r.name} category={r.category} className="size-14" strokeWidth={1.2} />}
                    {(limited || soldOut || r.kind === "unlockable") && (
                      <span className="absolute start-3 top-3 rounded-full border border-gold/30 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-sm" data-availability>
                        {soldOut ? t("Sold out") : limited ? t("{n} left", { n: r.stock ?? 0 }) : t("Profile unlock")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div>
                      <h2 className="font-semibold">{r.name}</h2>
                      <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm text-ink-2">{r.description || t(CATEGORY_LABEL[r.category] ?? "Other")}</p>
                    </div>
                    <p className="flex items-center gap-1.5 text-[15px] font-bold text-ink"><Star className="size-4 text-gold" aria-hidden="true" /><span className="tabular-nums">{r.cost.toLocaleString("en")} LP</span></p>
                    <div className="mt-auto pt-1">
                      <RedeemButton locale={locale} balance={balance} blocked={blocked} reward={{ id: r.id, name: r.name, description: r.description, cost: r.cost, category: r.category, image: img }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {(mine ?? []).length > 0 && (
          <section className="card p-4" id="my-rewards" data-my-rewards>
            <h2 className="font-semibold">{t("My rewards")}</h2>
            <ul className="mt-2 divide-y divide-black/5 text-sm">
              {(mine ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{r.reward?.name}</span>
                  <span className={`chip ${r.status === "fulfilled" ? "bg-sage-soft text-brand-900" : r.status === "pending" ? "bg-gold-soft text-ink" : ""}`} data-redemption-status={r.status}>{t(STATUS_LABEL[r.status] ?? r.status)}</span>
                  <span className="tabular-nums text-xs text-ink-2">{r.cost} LP</span>
                  <span className="text-xs text-black/45">{formatDate(r.created_at)}</span>
                  {r.note && <span className="w-full text-xs text-ink-2">{r.note}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* ------------------------------ Top 10 Prizes ------------------------------ */}
      <aside className={`min-w-0 space-y-4 ${topFirst ? "order-1 xl:order-none" : ""}`} id="top-10" data-section="top10" data-testid="top10">
        <section className="relative isolate overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-[#faf4e4] to-[#f1ead6] px-5 py-6" data-top10-banner>
          <Waves className="pointer-events-none absolute inset-0 -z-10 size-full opacity-80" />
          <TrophyScene className="pointer-events-none absolute -end-1 bottom-0 -z-10 h-[88%] w-auto" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-white/80 px-3 py-1 text-xs font-semibold text-ink-2"><Trophy className="size-3.5 text-gold" aria-hidden="true" />{t(PERIOD_LABEL[period])}</span>
          <h2 className="mt-3 max-w-[11rem] font-heading text-[34px] leading-[1.05] font-semibold text-brand-900">{t("Top 10 Prizes")}</h2>
          <p className="mt-2 max-w-[13rem] text-[13px] text-ink-2">{t("Reach the top 10 and win exclusive rewards!")}</p>
          {endsAt && (
            <div className="mt-3">
              <Countdown endsAt={endsAt as string} label={t("Ends in")} endedLabel={t("Ended")} units={{ d: t("d"), h: t("h"), m: t("m") }} />
            </div>
          )}
        </section>

        <section className="card space-y-1.5 p-4 text-sm">
          {settings?.rules ? <p className="text-ink-2">{settings.rules}</p> : <p className="text-ink-2">{t("The 10 students with the most points win a special prize. Earn points with challenges, events, volunteering and more.")}</p>}
          <p className="font-medium text-brand-800" data-my-place>
            {myIndex >= 0
              ? myIndex < 10 ? t("You are in the Top 10! Your place: {n}", { n: myIndex + 1 }) : t("Your place: {n}. Keep going!", { n: myIndex + 1 })
              : t("You are not ranked yet. Earn points to join the ranking.")}
            {myIndex >= 10 && tenth && <span className="block text-xs font-normal text-ink-2">{t("{n} more points to reach the Top 10", { n: Math.max(1, Number(tenth.points) - Number((ranking ?? [])[myIndex].points) + 1) })}</span>}
          </p>
          <p className="text-xs text-ink-2">{t("Students who hide themselves on the leaderboard are not shown here.")}</p>
        </section>

        <ol className="card divide-y divide-black/5 overflow-hidden" data-prize-list>
          {prizeSlots.map((prize, i) => {
            const place = i + 1;
            const holder = top[i];
            const img = prize?.image_path ? images.get(prize.image_path) ?? null : null;
            const special = !!prize?.special;
            return (
              <li key={place} className={`flex items-center gap-3 px-3 py-2.5 ${holder && holder.profile_id === me.id ? "bg-sage-soft/40" : special ? "bg-sand/50" : ""}`} data-prize-slot={place} data-special={special || undefined}>
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${place <= 3 ? "border border-gold/50 bg-gold-soft text-ink" : "bg-sand text-ink-2"}`}>
                  {place === 1 ? <Crown className="size-4 text-gold" strokeWidth={2} aria-label="1" /> : place}
                </span>
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sand to-sage-soft/60 text-brand-800">
                  {img
                    // eslint-disable-next-line @next/next/no-img-element -- private signed link
                    ? <img src={img} alt="" loading="lazy" className="size-full object-cover" />
                    : <PrizeIcon title={prize?.title ?? ""} className="size-6" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm leading-tight font-semibold">
                    <span className="truncate">{prize?.title ?? t("Prize to be announced")}</span>
                    {special && <span className="rounded-full border border-brand-700/20 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-brand-800">{t("Education reward")}</span>}
                  </p>
                  <p className="line-clamp-1 text-xs text-ink-2">{prize?.description || (holder ? "" : t("Open place"))}</p>
                  {holder && <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-brand-800"><Avatar avatar={holder.avatar} size="xs" />{holder.full_name} · <span className="tabular-nums">{Number(holder.points)} LP</span></p>}
                </div>
                {prize?.value && <span className="shrink-0 text-xs font-semibold tabular-nums text-gold">{prize.value}</span>}
              </li>
            );
          })}
        </ol>
        {staff && <Link href="/admin/rewards#top10" className="text-sm text-brand-700 underline">{t("Set the prizes and rules")}</Link>}
      </aside>
    </div>
  );
}

export default function ShopPage(props: PageProps<"/shop">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Shop searchParams={props.searchParams} />
    </Suspense>
  );
}
