// POSTPONED: the Rewards Shop where students spend points on rewards. Not routed. See ../README.md to bring it back.
import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { redeemReward } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { formatDate } from "@/lib/time";
import { signImages } from "@/lib/images";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import type { MyPoints } from "@/components/level-card";
import { Glyph, Place } from "@/components/glyph";

export const metadata = { title: "Rewards Shop" };

async function Shop({ searchParams }: { searchParams: PageProps<"/shop">["searchParams"] }) {
  const me = await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const { tab: raw } = await searchParams;
  const tab = raw === "top10" ? "top10" : "redeem";
  const [{ data: rewards }, { data: mine }, { data: my }, { data: staff }] = await Promise.all([
    supabase.from("rewards").select("id, name, description, cost, kind, stock, per_student_limit, image_path").eq("active", true).order("cost"),
    supabase.from("reward_redemptions").select("id, reward_id, status, cost, note, created_at, reward:rewards(name)").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(30),
    supabase.rpc("my_points"),
    supabase.rpc("can_manage_points"),
  ]);
  const p = my as unknown as MyPoints;
  const count = new Map<string, number>();
  for (const r of mine ?? []) if (r.status !== "cancelled") count.set(r.reward_id, (count.get(r.reward_id) ?? 0) + 1);
  const images = await signImages(supabase, (rewards ?? []).map((r) => r.image_path));
  const tabs = [["redeem", t("Redeem rewards")], ["top10", t("Top 10 prizes")]] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-black/50">{t("Your points to spend")}</p>
          <p className="text-3xl font-bold tabular-nums" data-testid="balance">{p.balance}</p>
        </div>
        <p className="max-w-[16rem] text-end text-xs text-black/55">{t("Spending points never lowers your level or your house's score.")}</p>
      </div>
      <div className="flex gap-1 rounded-xl bg-black/5 p-1" role="tablist">
        {tabs.map(([id, label]) => (
          <Link key={id} role="tab" aria-selected={tab === id} href={id === "redeem" ? "/shop" : `/shop?tab=${id}`} className={`flex-1 rounded-lg py-1.5 text-center text-sm font-medium ${tab === id ? "bg-brand-700 text-white shadow-sm" : "text-black/55 hover:bg-sage-soft/60"}`}>{label}</Link>
        ))}
      </div>

      {tab === "top10" ? <TopTen staff={!!staff} meId={me.id} /> : (
        <>
          {(rewards ?? []).length === 0 && <Empty emoji="🎁" title={t("The shop is empty")}>{t("Your school has not added rewards yet.")}</Empty>}
          <div className="grid gap-3 sm:grid-cols-2">
            {(rewards ?? []).map((r) => {
              const have = count.get(r.id) ?? 0;
              const soldOut = r.stock !== null && r.stock <= 0;
              const done = have >= r.per_student_limit;
              const missing = r.cost - p.balance;
              return (
                <article key={r.id} className="card flex flex-col overflow-hidden" data-reward={r.id}>
                  {r.image_path && images.get(r.image_path) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={images.get(r.image_path)!} alt="" loading="lazy" className="h-32 w-full object-cover" />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-sage-soft/50 text-4xl"><Glyph e={r.kind === "prize" ? "🎁" : "🎨"} strokeWidth={1.4} /></div>
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold">{r.name}</h2>
                      <span className="chip shrink-0 bg-brand-50 text-brand-800">{r.kind === "prize" ? t("Prize") : t("Unlockable")}</span>
                    </div>
                    {r.description && <p className="text-sm text-black/60">{r.description}</p>}
                    <p className="text-xs text-black/55">
                      {soldOut ? t("Sold out") : r.stock !== null ? t("{n} left", { n: r.stock }) : t("Available")}
                      {" · "}<strong className="text-brand-800">{r.cost} {t("points")}</strong>
                    </p>
                    <ActionForm action={redeemReward} className="mt-auto">
                      <input type="hidden" name="rewardId" value={r.id} />
                      <SubmitButton className="btn-primary w-full" disabled={soldOut || done || p.balance < r.cost} pendingText="…">
                        {done ? t("You have it") : soldOut ? t("Sold out") : missing > 0 ? t("Need {n} more points", { n: missing }) : t("Redeem for {n} points", { n: r.cost })}
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </article>
              );
            })}
          </div>

          {(mine ?? []).length > 0 && (
            <section className="card p-4">
              <h2 className="font-semibold">{t("Your rewards")}</h2>
              <ul className="mt-2 divide-y divide-black/5 text-sm">
                {(mine ?? []).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{r.reward?.name}</span>
                    <span className={`chip ${r.status === "fulfilled" ? "bg-brand-50 text-brand-800" : r.status === "pending" ? "bg-amber-50 text-amber-900" : "bg-black/5"}`}>
                      {t(r.status === "fulfilled" ? "Ready" : r.status === "pending" ? "Waiting for staff" : "Cancelled")}
                    </span>
                    <span className="text-xs text-black/45">{formatDate(r.created_at)}</span>
                    {r.note && <span className="w-full text-xs text-black/55">{r.note}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
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

export default function ShopPage(props: PageProps<"/shop">) {
  return (
    <>
      <PageHeader title="Rewards Shop" />
      <Suspense fallback={<PageSkeleton />}>
        <Shop searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
