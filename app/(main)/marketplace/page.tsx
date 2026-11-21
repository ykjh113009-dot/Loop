import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Crown, Star } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { signImages } from "@/lib/images";
import { Avatar } from "@/components/avatar";
import { DashCard } from "@/components/dashboard/card";
import { PageSkeleton } from "@/components/skeleton";
import { PageBanner } from "@/components/ui/page-banner";
import { SectionTabs } from "@/components/ui/section-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Marketplace" };

async function Marketplace() {
  const me = await requireMe();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: listings }, { data: rewards }, { data: prizes }, { data: pts }] = await Promise.all([
    supabase.from("listings").select("id, title, kind, price, image_path, seller:profiles!listings_seller_id_fkey(full_name, avatar)").eq("status", "active").order("created_at", { ascending: false }).limit(4),
    supabase.from("rewards").select("id, name, cost, image_path").eq("active", true).order("cost").limit(3),
    supabase.from("top10_prizes").select("place, title").order("place").limit(3),
    me.isStudent ? supabase.rpc("my_points") : Promise.resolve({ data: null }),
  ]);
  const images = await signImages(supabase, [...(listings ?? []).map((l) => l.image_path), ...(rewards ?? []).map((r) => r.image_path)]);
  const balance = pts ? Number((pts as unknown as { balance: number }).balance) : null;
  const price = (l: { kind: string; price: number | null }) => (l.kind === "sell" ? (l.price !== null ? `₪${Number(l.price)}` : t("Ask")) : l.kind === "swap" ? t("Swap") : t("Free"));

  return (
    <div className="space-y-5" data-category-page="marketplace">
      <PageBanner title={t("Marketplace")} subtitle={t("Shop. Earn. Redeem.")} note={t("Discover what students are sharing and explore Loop rewards.")} scene="gift" />
      <SectionTabs label={t("Marketplace")} current="" items={[
        { href: "/market", label: t("Student Marketplace"), icon: "store" }, { href: "/shop", label: t("Reward Shop"), icon: "gift" }, { href: "/shop?view=top10", label: t("Top 10 Prizes"), icon: "crown" },
      ]} />

      <DashCard title={t("Featured listings")} href="/market" linkLabel={t("See all")}>
        <p className="mb-3 text-xs text-ink-2">{t("Books, uniforms, electronics and more, from students at your school. Meet at school, no online payments.")}</p>
        {(listings ?? []).length === 0 ? (
          <EmptyState compact scene="gift" title={t("No listings yet. Be the first to share something.")} action={{ href: "/market/new", label: t("Create Listing") }} secondary={{ href: "/market", label: t("Open the marketplace") }}>
            {t("Sell, swap or give away something you no longer need.")}
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-card="listings">
            {(listings ?? []).map((l) => {
              const img = l.image_path ? images.get(l.image_path) : null;
              const seller = l.seller as unknown as { full_name: string; avatar: string } | null;
              return (
                <li key={l.id}><Link href={`/market/${l.id}`} className="card block overflow-hidden hover:border-brand-700/25">
                  <div className="flex aspect-[4/3] items-center justify-center bg-sage-soft/50">
                    {img
                      // eslint-disable-next-line @next/next/no-img-element -- private signed link
                      ? <img src={img} alt="" className="size-full object-cover" />
                      : <span className="text-3xl" aria-hidden="true"><Glyph e="🛍️" /></span>}
                  </div>
                  <div className="space-y-1 p-2.5"><p className="truncate text-sm font-semibold">{l.title}</p><p className="text-sm font-bold text-brand-700">{price(l)}</p>
                    {seller && <p className="flex items-center gap-1.5 truncate text-xs text-ink-2"><Avatar avatar={seller.avatar} size="xs" />{seller.full_name}</p>}</div>
                </Link></li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex justify-end"><Link href="/market/new" className="btn-secondary px-3 py-1.5 text-sm">{t("Create Listing")}</Link></div>
      </DashCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="card relative overflow-hidden p-5" data-card="points">
          <div className="relative z-10 max-w-full space-y-2">
            <h2 className="flex items-center gap-1.5 text-[15px] font-semibold"><Star className="size-4 text-brand-700" strokeWidth={1.8} aria-hidden="true" />{t("Your Points")}</h2>
            {balance !== null ? <p className="font-heading text-3xl font-semibold tabular-nums" data-testid="mk-balance">{balance.toLocaleString("en")} <span className="text-base font-medium text-ink-2">{t("pts")}</span></p> : <p className="text-sm text-ink-2">{t("Points are for current students.")}</p>}
            {(rewards ?? []).length > 0 && <p className="text-xs text-ink-2">{t("Rewards from {n} points", { n: Number(rewards![0].cost) })}</p>}
            <Link href="/shop" className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm">{t("Visit Reward Shop")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></Link>
          </div>
        </section>

        <DashCard title={t("Top 10 Prizes")} href="/shop?view=top10" linkLabel={t("View Winners")}>
          {(prizes ?? []).length === 0 ? (
            <EmptyState compact scene="gift" title={t("Prizes will appear here")} action={me.isAdmin ? { href: "/admin/rewards", label: t("Set the prizes") } : undefined}>
              {t("The top students each period win prizes chosen by your school.")}
            </EmptyState>
          ) : (
            <ul className="space-y-2" data-card="prizes">
              {(prizes ?? []).map((p) => (
                <li key={p.place} className="flex items-center gap-3 rounded-xl bg-brand-50/70 px-3 py-2"><Crown className="size-5 shrink-0 text-brand-700" strokeWidth={1.8} aria-hidden="true" /><span className="w-6 text-sm font-bold tabular-nums text-brand-800">#{p.place}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.title}</span></li>
              ))}
            </ul>
          )}
        </DashCard>
      </div>

      {(rewards ?? []).length > 0 && (
        <DashCard title={t("Rewards to redeem")} href="/shop" linkLabel={t("See all")}>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-card="rewards">
            {(rewards ?? []).map((r) => {
              const img = r.image_path ? images.get(r.image_path) : null;
              return (
                <li key={r.id}><Link href="/shop" className="flex items-center gap-3 rounded-xl border border-brand-700/10 bg-white p-2.5 hover:border-brand-700/25">
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sage-soft/50 text-2xl">{img
                    // eslint-disable-next-line @next/next/no-img-element -- private signed link
                    ? <img src={img} alt="" className="size-full object-cover" /> : <Glyph e="🎁" />}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold">{r.name}</span><span className="text-xs text-ink-2">{Number(r.cost).toLocaleString("en")} {t("points")}</span></span></Link></li>
              );
            })}
          </ul>
        </DashCard>
      )}
    </div>
  );
}

export default function MarketplacePage() {
  return <Suspense fallback={<PageSkeleton />}><Marketplace /></Suspense>;
}
