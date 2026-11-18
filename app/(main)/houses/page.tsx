import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { houseColor } from "@/lib/house";
import { PageBanner } from "@/components/ui/page-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Houses" };

async function Houses() {
  const me = await requireMe();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: week }, { data: all }, { data: info }, { data: mine }] = await Promise.all([
    supabase.rpc("house_leaderboard", { p_period: "week" }),
    supabase.rpc("house_leaderboard", { p_period: "all" }),
    supabase.from("houses").select("id, motto"),
    supabase.rpc("my_house"),
  ]);
  const motto = new Map((info ?? []).map((h) => [h.id, h.motto]));
  const weekBy = new Map((week ?? []).map((h) => [h.house_id, Number(h.points)]));
  const ranked = [...(all ?? [])].sort((a, b) => Number(b.points) - Number(a.points));
  const top = Math.max(1, ...ranked.map((h) => Number(h.points)));
  return (
    <div className="space-y-5" data-houses>
      <PageBanner title={t("Houses")} subtitle={t("One school. Friendly rivalry.")} note={t("Every student belongs to a house. Points add up all year.")} scene="campus" />
      {ranked.length === 0 ? (
        <EmptyState scene="campus" title={t("Houses are not set up yet")} action={me.isAdmin ? { href: "/admin/houses", label: t("Set up houses") } : { href: "/leaderboard", label: t("See the leaderboards") }}>
          {t("When your school creates houses, you will see them here with their points and standings.")}
        </EmptyState>
      ) : (
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-2" data-card="houses">
          {ranked.map((h, i) => (
            <li key={h.house_id} className={`card space-y-3 p-4 ${h.house_id === mine ? "ring-2 ring-brand-600/50" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-3xl" style={{ background: houseColor(h.color) + "26" }}>{h.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold">{h.name}</h2>
                  {motto.get(h.house_id) && <p className="truncate text-sm text-ink-2">“{motto.get(h.house_id)}”</p>}
                </div>
                <span className="rounded-full bg-black/5 px-3 py-1 text-sm font-bold tabular-nums">#{i + 1}</span>
              </div>
              <div className="h-2 rounded-full bg-black/5"><div className="h-2 rounded-full" style={{ width: `${Math.max(4, (Number(h.points) / top) * 100)}%`, background: houseColor(h.color) }} /></div>
              <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                <div><dt className="text-xs text-ink-2">{t("All time")}</dt><dd className="font-bold tabular-nums">{Number(h.points).toLocaleString("en")}</dd></div>
                <div><dt className="text-xs text-ink-2">{t("This week")}</dt><dd className="font-bold tabular-nums">{(weekBy.get(h.house_id) ?? 0).toLocaleString("en")}</dd></div>
                <div><dt className="text-xs text-ink-2">{t("Members")}</dt><dd className="font-bold tabular-nums">{Number(h.members)}</dd></div>
              </dl>
              {h.house_id === mine && <p className="text-xs font-semibold text-brand-700">{t("Your house")}</p>}
            </li>
          ))}
        </ol>
      )}
      <p className="text-sm text-ink-2"><Link href="/leaderboard" className="font-medium text-brand-700 hover:underline">{t("See the full leaderboards")}</Link></p>
    </div>
  );
}

export default function HousesPage() {
  return <Suspense fallback={<PageSkeleton />}><Houses /></Suspense>;
}
