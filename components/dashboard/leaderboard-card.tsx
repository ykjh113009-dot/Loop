import { requireMe } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { houseColor } from "@/lib/house";
import { LineIcon } from "@/components/line-icon";
import { CardEmpty, DashCard } from "@/components/dashboard/card";

const RANK_STYLE = [
  "bg-amber-100 text-amber-800 ring-1 ring-amber-300/60",
  "bg-sky text-sky-900 ring-1 ring-sky-300/70",
  "bg-orange-100 text-orange-800 ring-1 ring-orange-300/60",
  "bg-black/[0.05] text-ink-2",
];

// Houses when the school has set them up, otherwise grades (ranked by average
// points per student).
export async function LeaderboardCard() {
  const me = await requireMe();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: houses }, { data: myHouse }] = await Promise.all([
    supabase.rpc("house_leaderboard", { p_period: "week" }),
    supabase.rpc("my_house"),
  ]);
  if ((houses ?? []).length > 0) {
    return (
      <DashCard title={t("House Leaderboard")} href="/leaderboard">
        <ol className="space-y-1" data-card="houses">
          {(houses ?? []).map((h, i) => (
            <li key={h.house_id} className={`flex items-center gap-3 rounded-xl px-1.5 py-2 ${h.house_id === myHouse ? "bg-brand-50" : ""}`}>
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${RANK_STYLE[Math.min(i, 3)]}`}>{i + 1}</span>
              <span className="size-3 shrink-0 rounded-full" style={{ background: houseColor(h.color) }} aria-hidden="true" />
              <span className="flex-1 truncate text-sm font-medium">{h.emoji} {h.name}</span>
              <span className="text-sm font-semibold tabular-nums">{h.points}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] text-ink-2">{t("Points this week")}</p>
      </DashCard>
    );
  }
  const { data } = await supabase.rpc("grade_leaderboard", { p_period: "week" });
  const rows = data ?? [];
  return (
    <DashCard title={t("Grade Leaderboard")} href="/leaderboard">
      {rows.length === 0 ? (
        <CardEmpty icon="trophy">No points yet this week.</CardEmpty>
      ) : (
        <>
          <ol className="space-y-1">
            {rows.map((r, i) => (
              <li key={r.grade} className={`flex items-center gap-3 rounded-xl px-1.5 py-2 ${r.grade === me.grade ? "bg-brand-50" : ""}`}>
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${RANK_STYLE[Math.min(i, 3)]}`}>{i + 1}</span>
                <LineIcon name="shield" className="size-5 text-brand-600" />
                <span className="flex-1 text-sm font-medium">Grade {r.grade}</span>
                <span className="text-sm font-semibold tabular-nums">{Math.round(Number(r.avg_points))}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-ink-2">Average points per student this week</p>
        </>
      )}
    </DashCard>
  );
}
