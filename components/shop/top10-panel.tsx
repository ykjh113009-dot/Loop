import Link from "next/link";
import { Crown, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { signImages } from "@/lib/images";
import { Avatar } from "@/components/avatar";
import { PrizeIcon, TrophyScene, Waves } from "@/components/shop/art";
import { Countdown } from "@/components/shop/countdown";

const PERIOD_LABEL: Record<string, string> = { week: "Weekly competition", month: "Monthly competition", all: "All-time ranking" };

// The Top 10 Prizes: which prize each of the top ten students wins, who holds each place right now, and how long is left.
// It lives on the Leaderboards page and uses the same student ranking, so there is nothing to keep in sync.
export async function Top10Panel({ meId }: { meId: string }) {
  const supabase = await createClient();
  const { t } = await getT();
  const [{ data: staff }, { data: settings }, { data: prizes }] = await Promise.all([
    supabase.rpc("can_manage_points"),
    supabase.from("top10_settings").select("period, rules").maybeSingle(),
    supabase.from("top10_prizes").select("place, title, description, value, image_path, special").order("place"),
  ]);
  const period = settings?.period === "all" || settings?.period === "week" ? settings.period : "month";
  const [{ data: ranking }, { data: endsAt }] = await Promise.all([
    supabase.rpc("individual_leaderboard", { p_period: period, p_grade: null as unknown as number, p_limit: 50 }),
    supabase.rpc("top10_period_end", { p_period: period }),
  ]);
  const images = await signImages(supabase, (prizes ?? []).map((x) => x.image_path));
  const top = (ranking ?? []).slice(0, 10);
  const myIndex = (ranking ?? []).findIndex((r) => r.profile_id === meId);
  const tenth = (ranking ?? [])[9];
  const slots = Array.from({ length: 10 }, (_, i) => (prizes ?? []).find((x) => x.place === i + 1) ?? null);

  return (
    <div className="space-y-4" id="top-10" data-section="top10" data-testid="top10">
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
        <p className="text-ink-2">{settings?.rules || t("The 10 students with the most points win a special prize. Earn points with challenges, events, volunteering and more.")}</p>
        <p className="font-medium text-brand-800" data-my-place>
          {myIndex >= 0
            ? myIndex < 10 ? t("You are in the Top 10! Your place: {n}", { n: myIndex + 1 }) : t("Your place: {n}. Keep going!", { n: myIndex + 1 })
            : t("You are not ranked yet. Earn points to join the ranking.")}
          {myIndex >= 10 && tenth && <span className="block text-xs font-normal text-ink-2">{t("{n} more points to reach the Top 10", { n: Math.max(1, Number(tenth.points) - Number((ranking ?? [])[myIndex].points) + 1) })}</span>}
        </p>
        <p className="text-xs text-ink-2">{t("Students who hide themselves on the leaderboard are not shown here.")}</p>
      </section>

      <ol className="card divide-y divide-black/5 overflow-hidden" data-prize-list>
        {slots.map((prize, i) => {
          const place = i + 1;
          const holder = top[i];
          const img = prize?.image_path ? images.get(prize.image_path) ?? null : null;
          const special = !!prize?.special;
          return (
            <li key={place} className={`flex items-center gap-3 px-3 py-2.5 ${holder && holder.profile_id === meId ? "bg-sage-soft/40" : special ? "bg-sand/50" : ""}`} data-prize-slot={place} data-special={special || undefined}>
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
    </div>
  );
}
