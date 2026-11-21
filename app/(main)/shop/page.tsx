import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Glyph, Place } from "@/components/glyph";

export const metadata = { title: "Top 10 Prizes" };

async function Shop() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data: staff } = await supabase.rpc("can_manage_points");
  return (
    <div className="mx-auto max-w-3xl">
      <TopTen staff={!!staff} meId={me.id} />
    </div>
  );
}

// The special prizes for the top 10 students, using the same ranking as the student leaderboard.
async function TopTen({ staff, meId }: { staff: boolean; meId: string }) {
  const supabase = await createClient();
  const { t } = await getT();
  const [{ data: settings }, { data: prizes }] = await Promise.all([
    supabase.from("top10_settings").select("period, rules").maybeSingle(),
    supabase.from("top10_prizes").select("place, title, description").order("place"),
  ]);
  const period = settings?.period === "all" ? "all" : "week";
  const { data: ranking } = await supabase.rpc("individual_leaderboard", { p_period: period, p_grade: null as unknown as number, p_limit: 50 });
  const top = (ranking ?? []).slice(0, 10);
  const myIndex = (ranking ?? []).findIndex((r) => r.profile_id === meId);
  const prizeFor = (place: number) => (prizes ?? []).find((x) => x.place === place);
  return (
    <div className="space-y-4" data-testid="top10">
      <section className="card space-y-2 border-brand-700/20 bg-sage-soft/30 p-4">
        <h2 className="flex items-center gap-2 font-bold"><Glyph e="🏆" /> {t("Top 10 student prizes")}</h2>
        <p className="text-sm text-black/70">{settings?.rules || t("The 10 students with the most points win a special prize. Earn points with challenges, events, volunteering and more.")}</p>
        <p className="text-xs text-black/55">{t("Ranking period")}: <strong>{period === "week" ? t("this week (resets every Sunday)") : t("all time")}</strong>. {t("Students who hide themselves on the leaderboard are not listed.")}</p>
        <p className="text-sm font-medium text-brand-800">{myIndex >= 0 ? (myIndex < 10 ? t("You are in the Top 10! Your place: {n}", { n: myIndex + 1 }) : t("Your place: {n}. Keep going!", { n: myIndex + 1 })) : t("Earn points to enter the ranking.")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">{t("The ranking and its prizes")}</h2>
        {top.length === 0 ? <Empty emoji="🏆" title={t("Nobody is ranked yet")}>{t("Earn points to be the first!")}</Empty> : (
          <ol className="space-y-2">
            {top.map((r, i) => {
              const prize = prizeFor(i + 1);
              return (
                <li key={r.profile_id} className={`card flex items-center gap-3 p-3 ${r.profile_id === meId ? "ring-2 ring-brand-600" : ""}`}>
                  <Place n={i + 1} />
                  <Avatar avatar={r.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.full_name}</p>
                    <p className="truncate text-xs text-black/50">{prize ? `${prize.title}` : t("No prize set for this place yet")}</p>
                  </div>
                  <span className="text-sm tabular-nums"><strong>{r.points}</strong> <span className="text-black/45">{t("points")}</span></span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="section-title">{t("Prizes by place")}</h2>
        {(prizes ?? []).length === 0 ? <p className="card p-4 text-sm text-black/55">{t("The prizes have not been announced yet.")}</p> : (
          <ul className="card divide-y divide-black/5">
            {(prizes ?? []).map((x) => (
              <li key={x.place} className="flex items-start gap-3 px-4 py-3 text-sm"><Place n={x.place} /><div><p className="font-semibold">{x.title}</p>{x.description && <p className="text-black/60">{x.description}</p>}</div></li>
            ))}
          </ul>
        )}
        {staff && <Link href="/admin/rewards" className="text-sm text-brand-700 underline">{t("Set the prizes and rules")}</Link>}
      </section>
    </div>
  );
}

export default function ShopPage() {
  return (
    <>
      <PageHeader title="Top 10 Prizes" />
      <Suspense fallback={<PageSkeleton />}>
        <Shop />
      </Suspense>
    </>
  );
}
