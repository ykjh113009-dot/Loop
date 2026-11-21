// POSTPONED: admin tools for the redeemable rewards (handing over prizes, adding rewards, showing or hiding them). Not routed.
import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { handleRedemption, saveReward, setRewardActive } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { AdminNav } from "@/components/admin-nav";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { PhotoField } from "@/components/photo-field";
import { Top10Forms } from "./top10-forms";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "Rewards" };

async function Rewards() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data: roles } = await supabase.from("leadership_roles").select("kind").eq("profile_id", me.id).eq("kind", "school_staff");
  if (!me.isAdmin && (roles ?? []).length === 0) return <p className="card p-4 text-sm text-black/60">Only admins and school staff can open this page.</p>;
  const [{ data: t10settings }, { data: t10prizes }] = await Promise.all([
    supabase.from("top10_settings").select("period, rules").maybeSingle(),
    supabase.from("top10_prizes").select("place, title, description").order("place"),
  ]);
  const [{ data: rewards }, { data: waiting }] = await Promise.all([
    supabase.from("rewards").select("id, name, description, cost, kind, stock, active, per_student_limit").order("kind").order("cost"),
    supabase.from("reward_redemptions").select("id, cost, created_at, reward:rewards(name), profile:profiles!reward_redemptions_profile_id_fkey(full_name, grade)").eq("status", "pending").order("created_at"),
  ]);
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="section-title">Prizes to hand over ({(waiting ?? []).length})</h2>
        {(waiting ?? []).length === 0 && <p className="card p-4 text-sm text-black/55">Nothing waiting.</p>}
        {(waiting ?? []).map((w) => (
          <article key={w.id} className="card space-y-2 p-4" data-redemption={w.id}>
            <p className="text-sm"><strong>{w.profile?.full_name}</strong>{w.profile?.grade && <span className="text-black/45"> · Grade {w.profile.grade}</span>} asked for <strong>{w.reward?.name}</strong> <span className="text-black/45">({w.cost} points · {timeAgo(w.created_at)})</span></p>
            <ActionForm action={handleRedemption} className="flex flex-wrap gap-2">
              <input type="hidden" name="redemptionId" value={w.id} />
              <input name="note" maxLength={300} placeholder="Note, e.g. where to collect it" aria-label="Note" className="input min-w-40 flex-1 py-1.5 text-sm" />
              <SubmitButton name="decision" value="fulfil" className="btn-primary px-3 py-1.5" pendingText="…">Handed over</SubmitButton>
              <SubmitButton name="decision" value="cancel" className="btn-secondary px-3 py-1.5" pendingText="…">Cancel and refund</SubmitButton>
            </ActionForm>
          </article>
        ))}
      </section>

      <ActionForm action={saveReward} className="card space-y-2 p-4">
        <h2 className="font-semibold">Add a school-approved prize</h2>
        <input name="name" required minLength={2} maxLength={80} placeholder="e.g. Free lunch voucher" aria-label="Prize name" className="input" />
        <input name="description" maxLength={300} placeholder="Details (optional)" aria-label="Details" className="input" />
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-sm"><span className="label">Cost in points</span><input name="cost" type="number" min={1} required defaultValue={100} className="input" /></label>
          <label className="text-sm"><span className="label">How many (empty = no limit)</span><input name="stock" type="number" min={0} className="input" /></label>
          <label className="text-sm"><span className="label">Per student</span><input name="limit" type="number" min={1} max={10} defaultValue={1} className="input" /></label>
        </div>
        <PhotoField schoolId={me.school_id} userId={me.id} label="Add a picture (optional)" />
        <SubmitButton className="btn-primary w-full">Add prize</SubmitButton>
      </ActionForm>

      <Top10Forms settings={t10settings} prizes={t10prizes ?? []} />

      <section className="card p-4">
        <h2 className="font-semibold">All rewards</h2>
        <ul className="mt-2 divide-y divide-black/5 text-sm">
          {(rewards ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1"><strong>{r.name}</strong> <span className="text-black/50">· {r.cost} points · {r.kind === "prize" ? `prize${r.stock !== null ? `, ${r.stock} left` : ""}` : "unlockable colour"}</span></span>
              <ActionForm action={setRewardActive}>
                <input type="hidden" name="rewardId" value={r.id} /><input type="hidden" name="active" value={String(!r.active)} />
                <SubmitButton className={r.active ? "btn-secondary px-3 py-1 text-xs" : "btn-primary px-3 py-1 text-xs"} pendingText="…">{r.active ? "Hide from shop" : "Show in shop"}</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function AdminRewardsPage() {
  return (
    <>
      <PageHeader title="Admin" />
      <AdminNav current="/admin/rewards" />
      <Suspense fallback={<PageSkeleton />}>
        <Rewards />
      </Suspense>
    </>
  );
}
