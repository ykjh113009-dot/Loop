import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Grade leaderboard" };

const MEDALS = ["🥇", "🥈", "🥉"];

async function Leaderboard({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  const me = await requireMe();
  const { period: raw } = await searchParams;
  const period = raw === "all" ? "all" : "week";
  const supabase = await createClient();
  const { data } = await supabase.rpc("grade_leaderboard", { p_period: period });
  const rows = data ?? [];
  const max = Math.max(1, ...rows.map((r) => Number(r.avg_points)));

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-black/5 p-1">
        {[
          { id: "week", label: "This week" },
          { id: "all", label: "All time" },
        ].map((t) => (
          <Link
            key={t.id}
            href={`/leaderboard?period=${t.id}`}
            className={`flex-1 rounded-lg py-1.5 text-center text-sm font-medium ${period === t.id ? "bg-white shadow-sm" : "text-black/55"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <ol className="space-y-2">
        {rows.map((r, i) => {
          const mine = r.grade === me.grade;
          const avg = Number(r.avg_points);
          return (
            <li key={r.grade} className={`card p-4 ${mine ? "ring-2 ring-brand-600" : ""}`}>
              <div className="flex items-baseline justify-between">
                <p className="font-bold">
                  <span className="mr-1">{MEDALS[i] ?? `${i + 1}.`}</span> Grade {r.grade}
                  {mine && <span className="ml-2 chip bg-brand-50 text-brand-800">Your grade</span>}
                </p>
                <p className="text-sm tabular-nums">
                  <strong>{avg}</strong> <span className="text-black/50">points per student</span>
                </p>
              </div>
              <div className="mt-2 h-3 rounded-full bg-black/[0.06]">
                <div className="h-3 rounded-full bg-brand-600" style={{ width: `${Math.max(2, (avg / max) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-black/45">
                {r.points} points from {r.students} students
              </p>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-black/50">
        Grades are ranked by <strong>average points per student</strong>, so small and big grades compete fairly.
        Individual students are never ranked. {period === "week" && "The week starts on Sunday."}
      </p>
      {me.isStudent && (
        <Link href="/challenges" className="btn-primary w-full">🏁 Help your grade: do this week&apos;s challenge</Link>
      )}
    </div>
  );
}

export default function LeaderboardPage(props: PageProps<"/leaderboard">) {
  return (
    <>
      <PageHeader title="Grade leaderboard" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Leaderboard searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
