import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { getLocale } from "@/lib/i18n-server";
import { AchievementGrid, type Ach } from "@/components/rewards/pin-badges";
import { leadershipLabel } from "@/lib/leadership";
import { formatDate } from "@/lib/time";
import { POINT_REASONS, mergeRules } from "@/lib/points";
import { weekStart } from "@/lib/time";
import { claimPoints } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { LevelCard, type MyPoints } from "@/components/level-card";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "My points" };

const STATUS: Record<string, string> = { pending: "bg-amber-50 text-amber-900", approved: "bg-brand-50 text-brand-800", rejected: "bg-red-50 text-red-800" };

async function Points() {
  const me = await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  if (!me.isStudent) {
    return <p className="text-sm text-black/60">{t("Points are for current students. Alumni and staff don't collect points.")}</p>;
  }
  const locale = await getLocale();
  const [{ data: ledger }, { data: ach }, { data: streak }, { data: roles }, { data: redemptions }, { data: my }, { data: defaults }, { data: overrides }, { data: claims }] = await Promise.all([
    supabase.from("points_ledger").select("id, points, reason, kind, note, created_at").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(60),
    supabase.rpc("my_achievements"),
    supabase.rpc("my_streak"),
    supabase.from("leadership_roles").select("id, kind, scope, club:clubs(name)").eq("profile_id", me.id),
    supabase.from("reward_redemptions").select("id, cost, status, created_at, reward:rewards(name)").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(20),
    supabase.rpc("my_points"),
    supabase.from("point_rule_defaults").select("*"),
    supabase.from("point_rules").select("reason, points, daily_limit, weekly_limit, enabled"),
    supabase.from("point_claims").select("id, reason, description, status, points, review_note, created_at").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const rows = ledger ?? [];
  const since = weekStart().toISOString();
  const week = rows.filter((r) => r.created_at >= since).reduce((sum, r) => sum + r.points, 0);
  const achievements = (ach ?? []) as unknown as Ach[];
  const st = streak as unknown as { current: number; longest: number; today_active: boolean; next: number | null; earned: number[]; week: { day: string; active: boolean }[] };
  const history = [
    ...rows.map((r) => ({ key: `l${r.id}`, at: r.created_at, label: POINT_REASONS[r.reason] ?? r.reason, note: r.note, n: r.points, spent: false })),
    ...(redemptions ?? []).filter((r) => r.status !== "cancelled").map((r) => ({ key: `r${r.id}`, at: r.created_at, label: `${t("Spent")}: ${(r.reward as unknown as { name: string } | null)?.name ?? t("Reward")}`, note: null as string | null, n: -r.cost, spent: true })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
  const rules = mergeRules(defaults ?? [], overrides ?? []);
  const auto = rules.filter((r) => !r.requires_verification && r.enabled && r.points > 0);
  const claimable = rules.filter((r) => r.requires_verification && r.enabled);
  const p = my as unknown as MyPoints;

  return (
    <div className="space-y-5">
      <LevelCard p={p} week={week} t={t} />
      <p className="text-sm text-black/55">
        {t("Your points are private. They add up for your grade, your house and the student leaderboard.")}{" "}
        <Link href="/leaderboard" className="text-brand-700 underline">{t("See the leaderboards")}</Link>
      </p>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">{t("Ask for points")}</h2>
        <p className="text-sm text-black/55">{t("Did something good that Loop cannot see by itself? Tell us. Staff check it before points are given.")}</p>
        <ActionForm action={claimPoints} className="space-y-2">
          <select name="reason" className="input" aria-label={t("What did you do?")} defaultValue={claimable[0]?.reason}>
            {claimable.map((r) => <option key={r.reason} value={r.reason}>{r.label} (+{r.points}{r.weekly_limit ? `, ${t("up to {n} a week", { n: r.weekly_limit })}` : ""})</option>)}
          </select>
          <textarea name="description" required minLength={5} maxLength={500} rows={2} className="input resize-none" placeholder={t("What did you do, and who can confirm it?")} aria-label={t("What did you do, and who can confirm it?")} />
          <SubmitButton className="btn-primary w-full">{t("Send request")}</SubmitButton>
        </ActionForm>
        {(claims ?? []).length > 0 && (
          <ul className="divide-y divide-black/5 text-sm">
            {(claims ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className={`chip ${STATUS[c.status]}`}>{t(c.status === "pending" ? "Waiting" : c.status === "approved" ? "Approved" : "Not approved")}</span>
                <span className="min-w-0 flex-1 truncate">{POINT_REASONS[c.reason] ?? c.reason}: {c.description}</span>
                {c.points && <strong className="tabular-nums text-brand-700">+{c.points}</strong>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3 p-4" data-streak>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold"><Glyph e="🔥" /> {t("Your streak")}</h2>
          <span className={`chip ${st.today_active ? "bg-brand-50 text-brand-800" : "bg-amber-50 text-amber-900"}`}>{st.today_active ? <><Glyph e="✓" /> {t("Today counts")}</> : t("Do one thing today to keep it")}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-2xl font-bold tabular-nums" data-testid="streak-current">{st.current}</p><p className="text-xs text-black/50">{t("Current")}</p></div>
          <div><p className="text-2xl font-bold tabular-nums" data-testid="streak-longest">{st.longest}</p><p className="text-xs text-black/50">{t("Longest")}</p></div>
          <div><p className="text-2xl font-bold tabular-nums">{st.next ? st.next - st.current : "–"}</p><p className="text-xs text-black/50">{st.next ? t("days to {n}", { n: st.next }) : t("all milestones done")}</p></div>
        </div>
        <div className="flex justify-center gap-1.5" aria-label={t("The last 7 days")}>
          {(st.week ?? []).map((d) => <span key={d.day} className={`size-6 rounded-full ${d.active ? "bg-brand-600" : "bg-black/10"}`} title={d.day} />)}
        </div>
        <p className="text-xs text-black/50">{t("A streak day needs you to sign in and do something real, like voting in a poll, saving a resource or joining a challenge. Refreshing does not count.")}</p>
        <p className="text-xs text-black/50">{t("Milestones")}: {[7, 14, 30, 60, 100].map((m) => <span key={m} className={`me-2 ${st.earned?.includes(m) ? "font-semibold text-brand-700" : ""}`}>{m}{st.earned?.includes(m) ? <Glyph e="✓" className="ms-0.5" /> : null}</span>)}</p>
      </section>

      <section>
        <h2 className="section-title">{t("Achievements")} ({achievements.filter((a) => a.unlocked).length}/{achievements.length})</h2>
        <AchievementGrid items={achievements} locale={locale} />
      </section>

      {(roles ?? []).length > 0 && (
        <section className="card p-4">
          <h2 className="font-semibold">{t("Your roles")}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">{(roles ?? []).map((r) => <span key={r.id} className="chip bg-brand-50 text-brand-800">{leadershipLabel(r.kind, r.scope, (r.club as unknown as { name: string } | null)?.name)}</span>)}</div>
        </section>
      )}

      <section>
        <h2 className="section-title">{t("How to earn points")}</h2>
        <ul className="card divide-y divide-black/5 text-sm">
          {[["Challenges", "set by each challenge"], ["Tutor a classmate", "15"], ["Volunteering", "10 per hour"]].map(([what, pts]) => (
            <li key={what} className="flex justify-between px-4 py-2"><span>{t(what)}</span><span className="font-semibold tabular-nums text-brand-700">+{pts}</span></li>
          ))}
          {auto.map((r) => (
            <li key={r.reason} className="flex justify-between gap-3 px-4 py-2">
              <span>{r.label}{r.daily_limit ? <span className="text-black/45"> · {t("up to {n} a day", { n: r.daily_limit })}</span> : null}</span>
              <span className="font-semibold tabular-nums text-brand-700">+{r.points}</span>
            </li>
          ))}
        </ul>
      </section>

      <section data-history>
        <h2 className="section-title">{t("History")}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-black/50">{t("No points yet. Join a club to get started!")}</p>
        ) : (
          <ul className="card divide-y divide-black/5 text-sm">
            {history.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-2 px-4 py-2">
                <span className="min-w-0 flex-1"><span className="block truncate">{r.label}</span>{r.note && <span className="block truncate text-xs text-black/45">{r.note}</span>}</span>
                <span className="text-xs text-black/40">{formatDate(r.at)}</span>
                <span className={`w-12 text-end font-semibold tabular-nums ${r.n < 0 ? "text-red-700" : "text-brand-700"}`}>{r.n > 0 ? "+" : ""}{r.n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function PointsPage() {
  return (
    <>
      <PageHeader title="My points & badges" back="/home" />
      <Suspense fallback={<PageSkeleton />}>
        <Points />
      </Suspense>
    </>
  );
}
