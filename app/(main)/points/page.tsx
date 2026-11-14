import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { POINT_REASONS, mergeRules } from "@/lib/points";
import { timeAgo, weekStart } from "@/lib/time";
import { claimPoints } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { LevelCard, type MyPoints } from "@/components/level-card";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "My points" };

const STATUS: Record<string, string> = { pending: "bg-amber-50 text-amber-900", approved: "bg-brand-50 text-brand-800", rejected: "bg-red-50 text-red-800" };

async function Points() {
  const me = await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  if (!me.isStudent) {
    return <p className="text-sm text-black/60">{t("Points are for current students. Alumni and staff don't collect points.")}</p>;
  }
  const [{ data: ledger }, { data: badges }, { data: mine }, { data: my }, { data: defaults }, { data: overrides }, { data: claims }] = await Promise.all([
    supabase.from("points_ledger").select("id, points, reason, created_at").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(60),
    supabase.from("badges").select("code, name, emoji, description").order("sort"),
    supabase.from("profile_badges").select("badge_code, earned_at").eq("profile_id", me.id),
    supabase.rpc("my_points"),
    supabase.from("point_rule_defaults").select("*"),
    supabase.from("point_rules").select("reason, points, daily_limit, weekly_limit, enabled"),
    supabase.from("point_claims").select("id, reason, description, status, points, review_note, created_at").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const rows = ledger ?? [];
  const since = weekStart().toISOString();
  const week = rows.filter((r) => r.created_at >= since).reduce((sum, r) => sum + r.points, 0);
  const earned = new Map((mine ?? []).map((b) => [b.badge_code, b.earned_at]));
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

      <section>
        <h2 className="section-title">{t("Badges")} ({earned.size}/{badges?.length ?? 0})</h2>
        <div className="grid grid-cols-3 gap-2">
          {(badges ?? []).map((b) => {
            const has = earned.has(b.code);
            return (
              <div key={b.code} className={`card p-3 text-center ${has ? "" : "opacity-45 grayscale"}`} title={b.description}>
                <div className="text-3xl">{b.emoji}</div>
                <p className="mt-1 text-xs leading-tight font-semibold">{b.name}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-black/50">{b.description}</p>
              </div>
            );
          })}
        </div>
      </section>

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

      <section>
        <h2 className="section-title">{t("History")}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-black/50">{t("No points yet. Join a club to get started!")}</p>
        ) : (
          <ul className="card divide-y divide-black/5 text-sm">
            {rows.slice(0, 40).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <span className="min-w-0 flex-1 truncate">{POINT_REASONS[r.reason] ?? r.reason}</span>
                <span className="text-xs text-black/40">{timeAgo(r.created_at)}</span>
                <span className="w-10 text-end font-semibold tabular-nums text-brand-700">+{r.points}</span>
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
      <PageHeader title="My points & badges" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Points />
      </Suspense>
    </>
  );
}
