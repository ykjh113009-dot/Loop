import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LineIcon } from "@/components/line-icon";
import { CardEmpty, DashCard } from "@/components/dashboard/card";

const RANK_STYLE = [
  "bg-amber-100 text-amber-800 ring-1 ring-amber-300/60",
  "bg-sky text-sky-900 ring-1 ring-sky-300/70",
  "bg-orange-100 text-orange-800 ring-1 ring-orange-300/60",
  "bg-black/[0.05] text-ink-2",
];

// Grades are ranked by average points per student (never individual students).
export async function LeaderboardCard() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data } = await supabase.rpc("grade_leaderboard", { p_period: "week" });
  const rows = data ?? [];
  return (
    <DashCard title="Grade Leaderboard" href="/leaderboard">
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
