import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { houseColor } from "@/lib/house";
import { Avatar } from "@/components/avatar";
import { ImageBanner } from "@/components/ui/image-banner";
import { PageSkeleton } from "@/components/skeleton";
import { Glyph, Place } from "@/components/glyph";

export const metadata = { title: "Leaderboards" };


async function Leaderboard({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  const me = await requireMe();
  const { period: rawPeriod, view: rawView, grade: rawGrade } = await searchParams;
  const period = rawPeriod === "all" ? "all" : "week";
  const view = rawView === "grades" || rawView === "students" ? rawView : "houses";
  const grade = Number(rawGrade) || null;
  const supabase = await createClient();
  const { t } = await getT();
  const [{ data: houses }, { data: grades }, { data: students }, { data: myHouse }] = await Promise.all([
    view === "houses" ? supabase.rpc("house_leaderboard", { p_period: period }) : Promise.resolve({ data: [] }),
    view === "grades" ? supabase.rpc("grade_leaderboard", { p_period: period }) : Promise.resolve({ data: [] }),
    view === "students" ? supabase.rpc("individual_leaderboard", { p_period: period, p_grade: grade as unknown as number, p_limit: 20 }) : Promise.resolve({ data: [] }),
    supabase.rpc("my_house"),
  ]);
  const link = (o: Record<string, string>) => `/leaderboard?${new URLSearchParams({ view, period, ...(grade ? { grade: String(grade) } : {}), ...o })}`;
  const tabs = [["houses", t("Houses")], ["grades", t("Grades")], ["students", t("Students")]] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex gap-1 rounded-xl bg-black/5 p-1" role="tablist">
        {tabs.map(([id, label]) => (
          <Link key={id} role="tab" aria-selected={view === id} href={link({ view: id })} className={`flex-1 rounded-lg py-1.5 text-center text-sm font-medium ${view === id ? "bg-brand-700 text-white shadow-sm" : "text-black/55 hover:bg-sage-soft/60"}`}>{label}</Link>
        ))}
      </div>
      <div className="flex gap-1 rounded-xl bg-black/5 p-1">
        {[["week", t("This week")], ["all", t("All time")]].map(([id, label]) => (
          <Link key={id} href={link({ period: id })} className={`flex-1 rounded-lg py-1.5 text-center text-sm font-medium ${period === id ? "bg-brand-700 text-white shadow-sm" : "text-black/55 hover:bg-sage-soft/60"}`}>{label}</Link>
        ))}
      </div>

      {view === "houses" && (
        (houses ?? []).length === 0 ? (
          <p className="card p-4 text-sm text-black/60">{t("Houses have not been set up yet. An admin can do it in Admin, then Houses.")}</p>
        ) : (
          <ol className="space-y-2">
            {(() => {
              const max = Math.max(1, ...(houses ?? []).map((h) => Number(h.points)));
              return (houses ?? []).map((h, i) => (
                <li key={h.house_id} data-house={h.name} className={`card p-4 ${h.house_id === myHouse ? "ring-2 ring-brand-600" : ""}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-bold"><Place n={i + 1} className="me-1.5 align-middle" /> <Glyph e={h.emoji} /> {h.name}
                      {h.house_id === myHouse && <span className="chip ms-2 bg-brand-50 text-brand-800">{t("Your house")}</span>}
                    </p>
                    <p className="text-sm tabular-nums"><strong>{h.points}</strong> <span className="text-black/50">{t("points")}</span></p>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-black/[0.06]">
                    <div className="h-3 rounded-full" style={{ width: `${Math.max(2, (Number(h.points) / max) * 100)}%`, background: houseColor(h.color) }} />
                  </div>
                  <p className="mt-1 text-xs text-black/45">
                    {t("{a} from {n} students", { a: h.member_points, n: h.members })}{Number(h.bonus_points) > 0 ? ` · ${t("{b} from competitions", { b: h.bonus_points })}` : ""}
                  </p>
                </li>
              ));
            })()}
          </ol>
        )
      )}

      {view === "grades" && (
        <ol className="space-y-2">
          {(() => {
            const rows = grades ?? [];
            const max = Math.max(1, ...rows.map((r) => Number(r.avg_points)));
            return rows.map((r, i) => (
              <li key={r.grade} className={`card p-4 ${r.grade === me.grade ? "ring-2 ring-brand-600" : ""}`}>
                <div className="flex items-baseline justify-between">
                  <p className="font-bold"><Place n={i + 1} className="me-1.5 align-middle" /> {t("Grade {n}", { n: r.grade })}
                    {r.grade === me.grade && <span className="chip ms-2 bg-brand-50 text-brand-800">{t("Your grade")}</span>}</p>
                  <p className="text-sm tabular-nums"><strong>{Number(r.avg_points)}</strong> <span className="text-black/50">{t("points per student")}</span></p>
                </div>
                <div className="mt-2 h-3 rounded-full bg-black/[0.06]"><div className="h-3 rounded-full bg-brand-600" style={{ width: `${Math.max(2, (Number(r.avg_points) / max) * 100)}%` }} /></div>
                <p className="mt-1 text-xs text-black/45">{r.points} {t("points")} · {r.students} {t("students")}</p>
              </li>
            ));
          })()}
        </ol>
      )}

      {view === "students" && (
        <>
          <div className="flex flex-wrap gap-1.5 text-sm">
            <Link href={link({ grade: "" })} className={`chip ${!grade ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-900"}`}>{t("All grades")}</Link>
            {me.school.grades.map((g) => (
              <Link key={g} href={link({ grade: String(g) })} className={`chip ${grade === g ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-900"}`}>{t("Grade {n}", { n: g })}</Link>
            ))}
          </div>
          {(students ?? []).length === 0 ? (
            <p className="card p-4 text-sm text-black/60">{t("Nobody here yet.")}</p>
          ) : (
            <ol className="card divide-y divide-black/5">
              {(students ?? []).map((s, i) => (
                <li key={s.profile_id}>
                  <Link href={`/profile/${s.profile_id}`} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02] ${s.profile_id === me.id ? "bg-brand-50/60" : ""}`}>
                    <Place n={i + 1} />
                    <Avatar avatar={s.avatar} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.full_name}</span>
                      <span className="block text-xs text-black/45">{s.grade ? t("Grade {n}", { n: s.grade }) + (s.section ?? "") : ""} · {t("Level {n}", { n: s.level })}</span>
                    </span>
                    <strong className="tabular-nums text-brand-700">{s.points}</strong>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-black/50">{t("You can hide yourself from this list in Settings.")}</p>
        </>
      )}
      <p className="text-xs text-black/50">
        {view === "grades" ? t("Grades are ranked by average points per student, so small and big grades compete fairly.") : view === "houses" ? t("A house's score is all the points of its students plus competition points.") : ""}
        {period === "week" && ` ${t("The week starts on Sunday.")}`}
      </p>
      {me.isStudent && <Link href="/competitions" className="btn-primary w-full"><Glyph e="🏁" /> {t("Help your house: see the competitions")}</Link>}
    </div>
  );
}

export default function LeaderboardPage(props: PageProps<"/leaderboard">) {
  return (
    <>
      <ImageBanner name="leaderboards" title="Leaderboards" subtitle="See who's on top!" />
      <Suspense fallback={<PageSkeleton />}>
        <Leaderboard searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
