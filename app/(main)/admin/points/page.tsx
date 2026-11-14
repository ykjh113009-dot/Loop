import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { POINT_REASONS, mergeRules } from "@/lib/points";
import { reviewClubAchievement, reviewPointClaim, saveRule } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { AdminNav } from "@/components/admin-nav";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "Points" };

async function PointsAdmin() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data: roles } = await supabase.from("leadership_roles").select("kind").eq("profile_id", me.id).eq("kind", "school_staff");
  const staff = (roles ?? []).length > 0;
  if (!me.isAdmin && !staff) return <p className="card p-4 text-sm text-black/60">Only admins and school staff can open this page.</p>;
  const [{ data: defaults }, { data: overrides }, { data: claims }, { data: achievements }] = await Promise.all([
    supabase.from("point_rule_defaults").select("*"),
    supabase.from("point_rules").select("reason, points, daily_limit, weekly_limit, enabled"),
    supabase.from("point_claims").select("id, reason, description, created_at, profile:profiles!point_claims_profile_id_fkey(id, full_name, grade)").eq("status", "pending").order("created_at"),
    supabase.from("club_achievements").select("id, title, description, club:clubs(name)").eq("status", "pending").order("created_at"),
  ]);
  const rules = mergeRules(defaults ?? [], overrides ?? []);
  const rulesLabel = new Map(rules.map((r) => [r.reason, r]));

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="section-title">Requests to check ({(claims ?? []).length})</h2>
        {(claims ?? []).length === 0 && <p className="card p-4 text-sm text-black/55">Nothing waiting.</p>}
        {(claims ?? []).map((c) => (
          <article key={c.id} className="card space-y-2 p-4" data-claim={c.id}>
            <p className="flex flex-wrap items-center gap-2 text-sm"><strong>{c.profile?.full_name}</strong>{c.profile?.grade && <span className="text-black/45">Grade {c.profile.grade}</span>}
              <span className="chip bg-amber-50 text-amber-900">{POINT_REASONS[c.reason] ?? c.reason}</span><span className="ms-auto text-xs text-black/40">{timeAgo(c.created_at)}</span></p>
            <p className="text-sm whitespace-pre-wrap">{c.description}</p>
            <ActionForm action={reviewPointClaim} className="flex flex-wrap gap-2 border-t border-black/5 pt-2">
              <input type="hidden" name="claimId" value={c.id} />
              <input name="points" type="number" min={1} max={100} defaultValue={rulesLabel.get(c.reason)?.points} aria-label="Points to give" className="input w-24 py-1.5 text-sm" />
              <input name="note" maxLength={300} placeholder="Note to the student (optional)" aria-label="Note" className="input min-w-40 flex-1 py-1.5 text-sm" />
              <SubmitButton name="decision" value="approve" className="btn-primary px-3 py-1.5" pendingText="…">Give points</SubmitButton>
              <SubmitButton name="decision" value="reject" className="btn-secondary px-3 py-1.5" pendingText="…">Decline</SubmitButton>
            </ActionForm>
          </article>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="section-title">Club achievements to check ({(achievements ?? []).length})</h2>
        {(achievements ?? []).map((a) => (
          <article key={a.id} className="card space-y-2 p-4" data-achievement={a.id}>
            <p className="text-sm"><strong>{a.club?.name}</strong>: {a.title}</p>
            {a.description && <p className="text-sm text-black/60">{a.description}</p>}
            <ActionForm action={reviewClubAchievement} className="flex flex-wrap gap-2">
              <input type="hidden" name="achievementId" value={a.id} />
              <input name="points" type="number" min={0} max={50} defaultValue={0} aria-label="Points for each member" className="input w-24 py-1.5 text-sm" />
              <span className="self-center text-xs text-black/50">points for each member</span>
              <SubmitButton name="decision" value="approve" className="btn-primary px-3 py-1.5" pendingText="…">Approve</SubmitButton>
              <SubmitButton name="decision" value="reject" className="btn-secondary px-3 py-1.5" pendingText="…">Reject</SubmitButton>
            </ActionForm>
          </article>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="section-title">Point rules</h2>
        {me.isAdmin ? (
          <p className="text-xs text-black/50">Change how many points each activity gives, the limits that stop farming, and whether it counts at all. Changes apply from now on.</p>
        ) : <p className="text-xs text-black/50">Only admins change the rules.</p>}
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.reason}>
              <ActionForm action={saveRule} className="card flex flex-wrap items-center gap-2 p-3 text-sm" >
                <input type="hidden" name="reason" value={r.reason} />
                <span className="min-w-40 flex-1"><strong>{r.label}</strong>{r.requires_verification && <span className="chip ms-2 bg-amber-50 text-amber-900">Checked by staff</span>}</span>
                <label className="flex items-center gap-1 text-xs">Points <input name="points" type="number" min={0} max={100} defaultValue={r.points} disabled={!me.isAdmin} className="input w-16 py-1 text-sm" /></label>
                <label className="flex items-center gap-1 text-xs">Per day <input name="daily_limit" type="number" min={0} defaultValue={r.daily_limit ?? ""} disabled={!me.isAdmin} placeholder="∞" className="input w-16 py-1 text-sm" /></label>
                <label className="flex items-center gap-1 text-xs">Per week <input name="weekly_limit" type="number" min={0} defaultValue={r.weekly_limit ?? ""} disabled={!me.isAdmin} placeholder="∞" className="input w-16 py-1 text-sm" /></label>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="enabled" defaultChecked={r.enabled} disabled={!me.isAdmin} className="size-4 accent-brand-700" /> On</label>
                {me.isAdmin && <SubmitButton className="btn-secondary px-3 py-1 text-xs" pendingText="…">Save</SubmitButton>}
              </ActionForm>
            </li>
          ))}
        </ul>
        <p className="text-xs text-black/50">Weekly challenges, volunteering and tutoring set their own points when they are approved. <Link href="/admin/rewards" className="underline">Manage the rewards shop</Link>.</p>
      </section>
    </div>
  );
}

export default function AdminPointsPage() {
  return (
    <>
      <PageHeader title="Admin" />
      <AdminNav current="/admin/points" />
      <Suspense fallback={<PageSkeleton />}>
        <PointsAdmin />
      </Suspense>
    </>
  );
}
