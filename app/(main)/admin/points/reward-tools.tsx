import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { POINT_REASONS } from "@/lib/points";
import { formatDateTime } from "@/lib/time";
import { adjustPoints, reversePoints, setAchievement } from "@/app/actions/rewards";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { Glyph } from "@/components/glyph";

type Stats = { points_7d: number; points_30d: number; earners_7d: number; spent_30d: number; adjustments_30d: number; achievements_30d: number; top_reasons: { reason: string; points: number; n: number }[] };
type Summary = { xp: number; spent: number; balance: number; level: number; level_name: string; streak: number; longest: number };

// Statistics, unusual activity, student lookup (with adjustments and reversals) and achievement settings.
export async function RewardTools({ q, profileId, isAdmin }: { q: string; profileId: string; isAdmin: boolean }) {
  const supabase = await createClient();
  const term = q.replace(/[%_,()"'\\*:]/g, " ").trim().slice(0, 40);
  const [{ data: stats }, { data: suspicious }, { data: badges }, found, selected] = await Promise.all([
    supabase.rpc("reward_stats"),
    supabase.rpc("suspicious_rewards"),
    supabase.from("badges").select("code, name, emoji, category, tier, threshold, points_reward, active, metric").not("metric", "is", null).order("sort"),
    term ? supabase.from("profiles").select("id, full_name, avatar, grade, section").is("deactivated_at", null).ilike("full_name", `%${term}%`).limit(8) : Promise.resolve({ data: [] }),
    /^[0-9a-f-]{36}$/.test(profileId)
      ? Promise.all([
          supabase.from("profiles").select("id, full_name, avatar, grade, section").eq("id", profileId).maybeSingle(),
          supabase.rpc("staff_points_summary", { p_profile: profileId }),
          supabase.from("points_ledger").select("id, points, reason, kind, note, created_at, reverses_id").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(50),
        ])
      : Promise.resolve(null),
  ]);
  const st = stats as unknown as Stats | null;
  const sum = selected ? (selected[1].data as unknown as Summary | null) : null;
  const person = selected ? selected[0].data : null;
  const rows = selected ? selected[2].data ?? [] : [];
  const reversed = new Set(rows.map((r) => r.reverses_id).filter((x): x is number => !!x));

  return (
    <div className="space-y-6" data-reward-tools>
      {st && (
        <section className="space-y-2" data-stats>
          <h2 className="section-title">Reward statistics</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[["Points given, 7 days", st.points_7d], ["Points given, 30 days", st.points_30d], ["Students earning, 7 days", st.earners_7d], ["Points spent, 30 days", st.spent_30d], ["Achievements, 30 days", st.achievements_30d], ["Hand adjustments, 30 days", st.adjustments_30d]].map(([label, n]) => (
              <div key={label as string} className="card p-3"><p className="text-xl font-bold tabular-nums">{n as number}</p><p className="text-xs text-black/50">{label}</p></div>
            ))}
          </div>
          {st.top_reasons.length > 0 && (
            <p className="text-xs text-black/55">Most points came from: {st.top_reasons.map((r) => `${POINT_REASONS[r.reason] ?? r.reason} (${r.points})`).join(" · ")}</p>
          )}
        </section>
      )}

      <section className="space-y-2" data-suspicious>
        <h2 className="section-title">Worth a look ({(suspicious ?? []).length})</h2>
        <p className="text-xs text-black/50">Students who earned an unusual amount in the last 24 hours. This is a prompt to check, not proof of anything.</p>
        {(suspicious ?? []).length === 0 ? <p className="card p-3 text-sm text-black/55">Nothing unusual.</p> : (
          <ul className="card divide-y divide-black/5 text-sm">
            {(suspicious ?? []).map((s) => (
              <li key={s.profile_id}><Link href={`/admin/points?profile=${s.profile_id}`} className="flex flex-wrap items-center gap-2 px-4 py-2 hover:bg-black/[0.02]">
                <strong className="min-w-32">{s.full_name}</strong><span className="tabular-nums text-brand-700">+{s.points_24h} in {s.entries_24h} rewards</span><span className="min-w-0 flex-1 truncate text-xs text-black/45">{s.reasons}</span></Link></li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" data-lookup>
        <h2 className="section-title">Student points and history</h2>
        <form action="/admin/points" method="get" className="flex gap-2" role="search">
          <input name="q" defaultValue={q} placeholder="Search a student by name" aria-label="Search a student by name" className="input flex-1" maxLength={40} />
          <button className="btn-secondary">Search</button>
        </form>
        {(found.data ?? []).length > 0 && (
          <ul className="card divide-y divide-black/5">
            {(found.data ?? []).map((p) => (
              <li key={p.id}><Link href={`/admin/points?profile=${p.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-black/[0.02]"><Avatar avatar={p.avatar} size="sm" /><span className="font-medium">{p.full_name}</span><span className="text-xs text-black/45">{p.grade ? `Grade ${p.grade}${p.section ?? ""}` : ""}</span></Link></li>
            ))}
          </ul>
        )}
        {person && sum && (
          <div className="card space-y-3 p-4" data-student={person.id}>
            <div className="flex items-center gap-3"><Avatar avatar={person.avatar} /><div><p className="font-semibold">{person.full_name}</p><p className="text-xs text-black/50">Level {sum.level} · {sum.level_name} · streak {sum.streak} (best {sum.longest})</p></div></div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><p className="text-xl font-bold tabular-nums" data-testid="adm-balance">{sum.balance}</p><p className="text-xs text-black/50">to spend</p></div>
              <div><p className="text-xl font-bold tabular-nums">{sum.xp}</p><p className="text-xs text-black/50">XP</p></div>
              <div><p className="text-xl font-bold tabular-nums">{sum.spent}</p><p className="text-xs text-black/50">spent</p></div>
            </div>
            {isAdmin && (
              <ActionForm action={adjustPoints} className="flex flex-wrap gap-2 border-t border-black/5 pt-3">
                <input type="hidden" name="profile" value={person.id} />
                <input name="points" type="number" min={-1000} max={1000} placeholder="+50 or -20" aria-label="Points to add or take away" required className="input w-32" />
                <input name="reason" required minLength={5} maxLength={300} placeholder="Reason (kept in the history)" aria-label="Reason" className="input min-w-48 flex-1" />
                <SubmitButton className="btn-primary" pendingText="…">Save adjustment</SubmitButton>
              </ActionForm>
            )}
            <ul className="divide-y divide-black/5 text-sm" data-ledger>
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1"><span className="block truncate">{POINT_REASONS[r.reason] ?? r.reason}{r.kind !== "earn" && <span className="chip ms-2 bg-amber-50 text-amber-900">{r.kind}</span>}{reversed.has(r.id) && <span className="chip ms-2 bg-black/5">reversed</span>}</span>{r.note && <span className="block truncate text-xs text-black/45">{r.note}</span>}</span>
                  <span className="text-xs text-black/40">{formatDateTime(r.created_at)}</span>
                  <strong className={`w-12 text-end tabular-nums ${r.points < 0 ? "text-red-700" : "text-brand-700"}`}>{r.points > 0 ? "+" : ""}{r.points}</strong>
                  {isAdmin && r.kind !== "reversal" && !reversed.has(r.id) && (
                    <details className="w-full">
                      <summary className="cursor-pointer text-xs text-black/50">Reverse this</summary>
                      <ActionForm action={reversePoints} className="mt-2 flex gap-2">
                        <input type="hidden" name="entry" value={r.id} />
                        <input name="reason" required minLength={5} maxLength={300} placeholder="Why was it wrong?" aria-label="Reason" className="input flex-1 py-1.5 text-sm" />
                        <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingText="…">Reverse</SubmitButton>
                      </ActionForm>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-2" data-achievement-settings>
        <h2 className="section-title">Achievements</h2>
        <p className="text-xs text-black/50">The bonus points each achievement gives, and whether it is on. Requirements are set in the system so they stay fair and checkable.</p>
        <ul className="space-y-2">
          {(badges ?? []).map((b) => (
            <li key={b.code}>
              <ActionForm action={setAchievement} className="card flex flex-wrap items-center gap-2 p-3 text-sm">
                <input type="hidden" name="code" value={b.code} />
                <span className="min-w-40 flex-1"><strong><Glyph e={b.emoji} /> {b.name}</strong><span className="ms-2 text-xs text-black/45">{b.category} · {b.tier} · needs {b.threshold}</span></span>
                <label className="flex items-center gap-1 text-xs">Bonus <input name="points" type="number" min={0} max={500} defaultValue={b.points_reward} className="input w-16 py-1 text-sm" /></label>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={b.active} className="size-4 accent-brand-700" /> On</label>
                <SubmitButton className="btn-secondary px-3 py-1 text-xs" pendingText="…">Save</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
