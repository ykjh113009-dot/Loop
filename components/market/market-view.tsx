import Link from "next/link";
import { ArrowRight, Filter, Plus, Repeat, Search, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { signImages } from "@/lib/images";
import { CATEGORIES, priceLabel } from "@/lib/market";
import { timeAgo } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Waves } from "@/components/shop/art";
import { MarketScene } from "@/components/market/scene";
import { DetailsTrigger } from "@/components/market/details-trigger";
import { MarketSafetyNote } from "@/components/safety-note";
import { Glyph } from "@/components/glyph";

const TABS = [["buy", "Buy"], ["sell", "Sell"], ["swap", "Swap"]] as const;
const SORTS = [["new", "Newest First"], ["low", "Price: low to high"], ["high", "Price: high to low"]] as const;

// The student market: buy, sell and swap with other students. It only shows what students list; prizes live in the Reward Shop.
export async function MarketView({ searchParams, base }: { searchParams: Promise<Record<string, string | string[] | undefined>>; base: string }) {
  const me = await requireMe();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const tab = sp.mine === "1" ? "sell" : TABS.some(([id]) => id === one("tab")) ? one("tab") : "buy";
  const category = one("category") in CATEGORIES ? one("category") : "";
  const sort = SORTS.some(([id]) => id === one("sort")) ? one("sort") : "new";
  const q = one("q").replace(/[%_,()\\]/g, " ").trim().slice(0, 60);
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select("id, title, kind, price, status, image_path, created_at, seller_id, seller:profiles!listings_seller_id_fkey(full_name, avatar)")
    .limit(60);
  if (tab === "sell") query = query.eq("seller_id", me.id);
  else query = query.in("status", ["active", "reserved"]).in("kind", tab === "swap" ? ["swap"] : ["sell", "free"]);
  if (category) query = query.eq("category", category);
  if (q) query = query.ilike("title", `%${q}%`);
  query = sort === "low" ? query.order("price", { ascending: true, nullsFirst: false }) : sort === "high" ? query.order("price", { ascending: false, nullsFirst: false }) : query.order("created_at", { ascending: false });

  const [{ data }, { data: recent }] = await Promise.all([
    query,
    supabase.from("listings").select("id, title, created_at, seller:profiles!listings_seller_id_fkey(full_name, avatar)").in("status", ["active", "reserved"]).order("created_at", { ascending: false }).limit(4),
  ]);
  const listings = data ?? [];
  const urls = await signImages(supabase, listings.map((l) => l.image_path));
  const href = (o: Record<string, string>) => {
    const p = new URLSearchParams({ ...(tab !== "buy" ? { tab } : {}), ...(category ? { category } : {}), ...(sort !== "new" ? { sort } : {}), ...(q ? { q } : {}), ...o });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `${base}${p.size ? `?${p}` : ""}`;
  };
  const canPost = me.isStudent && !me.isSuspended;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]" data-market-page data-wide>
      <div className="min-w-0 space-y-4">
        <section className="relative isolate overflow-hidden rounded-3xl border border-brand-700/10 bg-sand/70 px-5 py-6 lg:px-8 lg:py-8" data-banner data-market-banner>
          <Waves className="pointer-events-none absolute inset-0 -z-10 size-full" />
          <MarketScene className="pointer-events-none absolute end-4 bottom-0 -z-10 hidden h-[104%] w-auto sm:block" />
          <h1 className="font-heading text-[38px] leading-none font-semibold text-brand-900 lg:text-[56px]" data-banner-title>{t("Market")}</h1>
          <p className="mt-2 text-[15px] font-medium text-ink lg:text-xl">{t("Buy, Sell, and Swap with ease.")}</p>
          <p className="mt-1 max-w-md text-[13px] text-ink-2 lg:text-sm">{t("Discover great deals, sell your items, or trade with other students!")}</p>
        </section>

        <form action={base} role="search" className="relative">
          {tab !== "buy" && <input type="hidden" name="tab" value={tab} />}
          {category && <input type="hidden" name="category" value={category} />}
          {sort !== "new" && <input type="hidden" name="sort" value={sort} />}
          <Search className="pointer-events-none absolute start-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-2" aria-hidden="true" />
          <input name="q" defaultValue={q} placeholder={t("Search for items...")} aria-label={t("Search for items...")} className="h-11 w-full rounded-full border border-black/10 bg-white pe-4 ps-11 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" />
        </form>

        <div className="flex flex-wrap items-center gap-2" data-market-controls>
          <nav aria-label={t("Market")} className="flex gap-2">
            {TABS.map(([id, label]) => <Link key={id} href={href({ tab: id === "buy" ? "" : id })} role="tab" aria-selected={tab === id} className="opt px-6 py-2.5 text-[15px] aria-selected:font-semibold">{t(label)}</Link>)}
          </nav>
          <div className="ms-auto flex flex-wrap gap-2">
            <details className="relative">
              <summary className="opt cursor-pointer list-none px-4 py-2.5 [&::-webkit-details-marker]:hidden"><Filter className="size-4" aria-hidden="true" />{category ? t(CATEGORIES[category]) : t("Filter")}</summary>
              <div className="absolute end-0 z-20 mt-2 w-56 space-y-1 rounded-2xl border border-black/10 bg-white p-2 shadow-lg">
                <Link href={href({ category: "" })} className={`opt w-full justify-start rounded-xl ${!category ? "opt-on" : ""}`}>{t("All")}</Link>
                {Object.entries(CATEGORIES).map(([id, label]) => <Link key={id} href={href({ category: id })} className={`opt w-full justify-start rounded-xl ${category === id ? "opt-on" : ""}`}>{t(label)}</Link>)}
              </div>
            </details>
            <details className="relative">
              <summary className="opt cursor-pointer list-none px-4 py-2.5 [&::-webkit-details-marker]:hidden"><SlidersHorizontal className="size-4" aria-hidden="true" />{t(SORTS.find(([id]) => id === sort)![1])}</summary>
              <div className="absolute end-0 z-20 mt-2 w-56 space-y-1 rounded-2xl border border-black/10 bg-white p-2 shadow-lg">
                {SORTS.map(([id, label]) => <Link key={id} href={href({ sort: id === "new" ? "" : id })} className={`opt w-full justify-start rounded-xl ${sort === id ? "opt-on" : ""}`}>{t(label)}</Link>)}
              </div>
            </details>
          </div>
        </div>

        <MarketSafetyNote />

        {listings.length === 0 ? (
          <EmptyState scene="gift" title={tab === "sell" ? t("You have not listed anything yet.") : t("No listings yet. Be the first to share something.")}
            action={canPost ? { href: "/market/new", label: t("Create Listing") } : undefined}>
            {t("Sell, swap or give away something you no longer need.")}
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3" data-listing-grid>
            {listings.map((l) => {
              const url = l.image_path ? urls.get(l.image_path) : null;
              const seller = l.seller as unknown as { full_name: string; avatar: string } | null;
              return (
                <DetailsTrigger key={l.id} id={l.id} title={l.title} locale={locale} className="card flex flex-col overflow-hidden">
                  <Link href={`/market/${l.id}`} data-details className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-sand to-sage-soft/60 text-4xl text-brand-800">
                    {url
                      // eslint-disable-next-line @next/next/no-img-element -- private signed link
                      ? <img src={url} alt="" loading="lazy" className="size-full object-cover" />
                      : <Glyph e="📦" strokeWidth={1.2} />}
                    {l.status !== "active" && <span className="chip absolute start-2 top-2 bg-white/90 px-2 py-0.5 text-[10px]">{l.status === "held" ? t("checking") : t(l.status)}</span>}
                  </Link>
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <p className="line-clamp-1 text-[15px] font-semibold">{l.title}</p>
                    <p className="text-[15px] font-bold text-brand-800">{priceLabel(l)}</p>
                    <p className="flex items-center justify-between gap-2 text-xs text-ink-2">
                      <span className="flex min-w-0 items-center gap-1.5">{seller && <Avatar avatar={seller.avatar} size="xs" />}<span className="truncate">{seller?.full_name}</span></span>
                      <span className="shrink-0">{timeAgo(l.created_at)}</span>
                    </p>
                    <Link href={`/market/${l.id}`} data-details className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-sage-soft/70 px-3 py-2 text-sm font-semibold text-brand-900 hover:bg-sage-soft">{t("View Details")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></Link>
                  </div>
                </DetailsTrigger>
              );
            })}
          </ul>
        )}
      </div>

      <aside className="min-w-0 space-y-4">
        {canPost && (
          <>
            <section className="relative isolate overflow-hidden rounded-3xl border border-brand-700/10 bg-sage-soft/50 p-5" data-card="sell">
              <ShoppingBag className="pointer-events-none absolute -end-1 top-4 -z-10 size-20 text-brand-800/25" strokeWidth={1.2} aria-hidden="true" />
              <h2 className="flex items-center gap-2 text-lg font-semibold"><ShoppingBag className="size-5 text-brand-800" aria-hidden="true" />{t("Sell Your Item")}</h2>
              <p className="mt-1 max-w-[14rem] text-sm text-ink-2">{t("Turn your unused items into money you can spend.")}</p>
              <Link href="/market/new" className="btn-primary mt-4 w-full rounded-full"><Plus className="size-4" aria-hidden="true" />{t("Create Listing")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></Link>
            </section>
            <section className="relative isolate overflow-hidden rounded-3xl border border-brand-700/10 bg-sage-soft/50 p-5" data-card="swap">
              <Repeat className="pointer-events-none absolute -end-1 top-4 -z-10 size-20 text-brand-800/25" strokeWidth={1.2} aria-hidden="true" />
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Repeat className="size-5 text-brand-800" aria-hidden="true" />{t("Swap Items")}</h2>
              <p className="mt-1 max-w-[14rem] text-sm text-ink-2">{t("Trade with other students for what you need.")}</p>
              <Link href="/market/new?kind=swap" className="btn-primary mt-4 w-full rounded-full">{t("Start a Swap")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></Link>
            </section>
          </>
        )}
        <section className="card p-4" data-card="recent">
          <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">{t("Recent Activity")}</h2><Link href={base} className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:underline">{t("View All")} <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden="true" /></Link></div>
          {(recent ?? []).length === 0 ? <p className="mt-3 text-sm text-ink-2">{t("Nothing yet. New listings show up here.")}</p> : (
            <ul className="mt-2 divide-y divide-black/5">
              {(recent ?? []).map((r) => {
                const s = r.seller as unknown as { full_name: string; avatar: string } | null;
                return (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    {s ? <Avatar avatar={s.avatar} size="sm" /> : null}
                    <Link href={`/market/${r.id}`} className="min-w-0 flex-1 text-sm hover:underline"><span className="font-medium">{s?.full_name}</span> {t("listed")} <span className="font-medium">{r.title}</span><span className="block text-xs text-ink-2">{timeAgo(r.created_at)}</span></Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
