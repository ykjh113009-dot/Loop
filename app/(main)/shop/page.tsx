import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { GiftScene } from "@/components/art/scenes";
import { PageSkeleton } from "@/components/skeleton";
import { Top10Panel } from "@/components/shop/top10-panel";
import { Waves } from "@/components/shop/art";

export const metadata = { title: "Reward Shop" };

// The Reward Shop page has two parts. Spending points on rewards is postponed (the finished pages are in
// _postponed/rewards-redeem), so that part says Coming soon. The Top 10 Prizes are live: each prize goes to
// the student in that place on the leaderboard.
async function Shop({ searchParams }: { searchParams: PageProps<"/shop">["searchParams"] }) {
  const me = await requireMe();
  const { t } = await getT();
  const sp = await searchParams;
  const topFirst = sp.view === "top10";
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]" data-shop-page data-wide>
      <div className={`min-w-0 space-y-5 ${topFirst ? "order-2 xl:order-none" : ""}`} data-section="reward-shop">
        <section className="relative isolate overflow-hidden rounded-3xl border border-brand-700/10 bg-sand/70 px-5 py-6 lg:px-8 lg:py-8" data-shop-banner>
          <Waves className="pointer-events-none absolute inset-0 -z-10 size-full" />
          <GiftScene className="pointer-events-none absolute end-4 bottom-0 -z-10 hidden h-[115%] w-auto sm:block" />
          <h1 className="font-heading text-[34px] leading-none font-semibold text-brand-900 lg:text-[48px]" data-banner-title>{t("Reward Shop")}</h1>
          <p className="mt-2 max-w-[26rem] text-[13px] text-ink-2 lg:mt-3 lg:text-base">{t("Spend your Loop Points on exclusive rewards!")}</p>
        </section>
        <section className="card space-y-4 p-5" data-coming-soon>
          <span className="chip bg-brand-50 text-brand-800"><Sparkles className="size-3.5" aria-hidden="true" /> {t("Coming soon")}</span>
          <p className="text-[15px]">{t("Soon you will be able to spend the points you earn on gift cards, technology, study help and experiences chosen by your school.")}</p>
          <div>
            <h2 className="section-title">{t("What to expect")}</h2>
            <ul className="list-disc space-y-1 ps-5 text-sm text-ink-2">
              <li>{t("Rewards in categories like Gift Cards, Technology, Study and Experiences")}</li>
              <li>{t("A confirmation that shows your points before and after you redeem")}</li>
              <li>{t("Your redemptions and their status in one place")}</li>
            </ul>
          </div>
          <p className="text-sm text-ink-2">{t("The Top 10 Prizes are already live. Earn points to climb the leaderboard and win one.")}</p>
        </section>
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
