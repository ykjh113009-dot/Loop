import { Suspense } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signImages } from "@/lib/images";
import { getT } from "@/lib/i18n-server";
import { GiftScene } from "@/components/art/scenes";
import { PageSkeleton } from "@/components/skeleton";
import { Top10Panel } from "@/components/shop/top10-panel";
import { CATEGORIES, CATEGORY_LABEL, PrizeIcon, Waves, prizeCategory } from "@/components/shop/art";

export const metadata = { title: "Reward Shop" };

// The Reward Shop page has two parts. Spending points on rewards is postponed (the finished pages are in
// _postponed/rewards-redeem), so that part says Coming soon. The Top 10 Prizes are live: each prize goes to
// the student in that place on the leaderboard.
async function Shop({ searchParams }: { searchParams: PageProps<"/shop">["searchParams"] }) {
  const me = await requireMe();
  const { t } = await getT();
  const sp = await searchParams;
  const topFirst = sp.view === "top10";
  const cat = typeof sp.cat === "string" && ([...CATEGORIES] as string[]).includes(sp.cat) ? sp.cat : "";
  const supabase = await createClient();
  const { data: prizes } = await supabase.from("top10_prizes").select("place, title, description, value, image_path, special").order("place");
  const images = await signImages(supabase, (prizes ?? []).map((x) => x.image_path));
  const shown = (prizes ?? []).filter((p) => !cat || prizeCategory(p.title) === cat);
  const chips: [string, string][] = [["", "All"], ...CATEGORIES.map((c) => [c, CATEGORY_LABEL[c]] as [string, string])];
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]" data-shop-page data-wide>
      <div className={`min-w-0 space-y-5 ${topFirst ? "order-2 xl:order-none" : ""}`} data-section="reward-shop">
        <section className="relative isolate overflow-hidden rounded-3xl border border-brand-700/10 bg-sand/70 px-5 py-6 lg:px-8 lg:py-8" data-shop-banner>
          <Waves className="pointer-events-none absolute inset-0 -z-10 size-full" />
          <GiftScene className="pointer-events-none absolute end-4 bottom-0 -z-10 hidden h-[115%] w-auto sm:block" />
          <h1 className="font-heading text-[34px] leading-none font-semibold text-brand-900 lg:text-[48px]" data-banner-title>{t("Reward Shop")}</h1>
          <p className="mt-2 max-w-[26rem] text-[13px] text-ink-2 lg:mt-3 lg:text-base">{t("Spend your Loop Points on exclusive rewards!")}</p>
        </section>
        <section className="card space-y-3 p-5" data-coming-soon>
          <span className="chip bg-brand-50 text-brand-800"><Sparkles className="size-3.5" aria-hidden="true" /> {t("Coming soon")}</span>
          <p className="text-[15px]">{t("Soon you will be able to spend the points you earn on gift cards, technology, study help and experiences chosen by your school.")}</p>
          <p className="text-sm text-ink-2">{t("The Top 10 Prizes are already live. Earn points to climb the leaderboard and win one.")}</p>
        </section>

        {/* The ten prizes, one card each: the student in that place on the leaderboard wins it. */}
        <nav aria-label={t("Prize categories")} className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]" data-shop-categories>
          <ul className="flex min-w-max gap-2 py-1">
            {chips.map(([id, label]) => (
              <li key={id || "all"}><Link href={id ? `/shop?cat=${id}` : "/shop"} aria-current={cat === id ? "page" : undefined} className="opt px-5 py-2">{t(label)}</Link></li>
            ))}
          </ul>
        </nav>
        {shown.length === 0 ? (
          <p className="card px-6 py-8 text-center text-sm text-ink-2">{t("No prizes in this group.")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3" data-prize-cards>
            {shown.map((p) => {
              const img = p.image_path ? images.get(p.image_path) ?? null : null;
              return (
                <li key={p.place} className="card flex flex-col overflow-hidden" data-prize-card={p.place}>
                  <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-sand to-sage-soft/60 text-brand-800">
                    {img
                      // eslint-disable-next-line @next/next/no-img-element -- private signed link
                      ? <img src={img} alt="" loading="lazy" className="size-full object-cover" />
                      : <PrizeIcon title={p.title} className="size-14" strokeWidth={1.2} />}
                    <span className="absolute start-3 top-3 rounded-full border border-gold/40 bg-white/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm">{t("Place {n}", { n: p.place })}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                    <h2 className="flex flex-wrap items-center gap-x-2 text-[15px] leading-tight font-semibold">
                      <span>{p.title}</span>
                      {p.special && <span className="rounded-full border border-brand-700/20 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-brand-800">{t("Education reward")}</span>}
                    </h2>
                    {p.description && <p className="line-clamp-2 text-sm text-ink-2">{p.description}</p>}
                    <p className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-ink-2">
                      <span>{p.place === 1 ? t("Top of the leaderboard") : t("Rank {n} on the leaderboard", { n: p.place })}</span>
                      {p.value && <span className="font-semibold tabular-nums text-gold">{p.value}</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <aside className={`min-w-0 ${topFirst ? "order-1 xl:order-none" : ""}`}>
        <Top10Panel meId={me.id} />
      </aside>
    </div>
  );
}

export default function ShopPage(props: PageProps<"/shop">) {
  return <Suspense fallback={<PageSkeleton />}><Shop searchParams={props.searchParams} /></Suspense>;
}
