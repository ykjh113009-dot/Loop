// POSTPONED: the Reward Shop where students spend points. Not routed. See ../README.md.
import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { handleRedemption, saveReward } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { AdminNav } from "@/components/admin-nav";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { PhotoField } from "@/components/photo-field";
import { signImages } from "@/lib/images";
import { formatDateTime, timeAgo } from "@/lib/time";
import { Top10Forms } from "@/app/(main)/admin/rewards/top10-forms";
import { CategorySelect, RewardRow } from "./reward-forms";

export const metadata = { title: "Rewards" };

const STATUS = { pending: "Waiting", fulfilled: "Handed over", cancelled: "Cancelled and refunded" } as const;

async function Rewards() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data: roles } = await supabase.from("leadership_roles").select("kind").eq("profile_id", me.id).eq("kind", "school_staff");
  if (!me.isAdmin && (roles ?? []).length === 0) return <p className="card p-4 text-sm text-black/60">Only admins and school staff can open this page.</p>;
  const [{ data: t10settings }, { data: t10prizes }, { data: rewards }, { data: records }] = await Promise.all([
    supabase.from("top10_settings").select("period, rules").maybeSingle(),
    supabase.from("top10_prizes").select("place, title, description, value, special, image_path").order("place"),
    supabase.from("rewards").select("id, name, description, cost, kind, stock, active, per_student_limit, category, image_path").order("kind").order("cost"),
    supabase.from("reward_redemptions").select("id, cost, status, note, created_at, handled_at, reward:rewards(name), profile:profiles!reward_redemptions_profile_id_fkey(full_name, grade)").order("created_at", { ascending: false }).limit(60),
  ]);
  const images = await signImages(supabase, [...(rewards ?? []).map((r) => r.image_path), ...(t10prizes ?? []).map((x) => x.image_path)]);
  const waiting = (records ?? []).filter((x) => x.status === "pending").reverse();
  const history = (records ?? []).filter((x) => x.status !== "pending");
  return (
    <div className="space-y-4">
      <section className="space-y-2" data-section="to-hand-over">
        <h2 className="section-title">Prizes to hand over ({waiting.length})</h2>
        {waiting.length === 0 && <p className="card p-4 text-sm text-black/55">Nothing waiting.</p>}
        {waiting.map((w) => (
          <article key={w.id} className="card space-y-2 p-4" data-redemption={w.id}>
            <p className="text-sm"><strong>{w.profile?.full_name}</strong>{w.profile?.grade && <span className="text-black/45"> · Grade {w.profile.grade}</span>} asked for <strong>{w.reward?.name}</strong> <span className="text-black/45">· {w.cost} LP · {timeAgo(w.created_at)}</span></p>
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
        <h2 className="font-semibold">Add a reward</h2>
        <input name="name" required minLength={2} maxLength={80} placeholder="e.g. Cinema tickets" aria-label="Reward name" className="input" />
        <input name="description" maxLength={300} placeholder="Short description" aria-label="Details" className="input" />
        <div className="grid gap-2 sm:grid-cols-4">
          <label className="text-sm"><span className="label">Cost in LP</span><input name="cost" type="number" min={1} required defaultValue={100} className="input" /></label>
          <label className="text-sm"><span className="label">How many (empty = no limit)</span><input name="stock" type="number" min={0} className="input" /></label>
          <label className="text-sm"><span className="label">Per student</span><input name="limit" type="number" min={1} max={10} defaultValue={1} className="input" /></label>
          <label className="text-sm"><span className="label">Category</span><CategorySelect defaultValue="gift_cards" /></label>
        </div>
        <PhotoField schoolId={me.school_id} userId={me.id} label="Add a picture (optional)" />
        <SubmitButton className="btn-primary w-full">Add reward</SubmitButton>
      </ActionForm>

      <section className="card p-4" data-section="all-rewards">
        <h2 className="font-semibold">All rewards</h2>
        <ul className="mt-2 divide-y divide-black/5">
          {(rewards ?? []).length === 0 && <li className="py-2 text-sm text-black/50">No rewards yet.</li>}
          {(rewards ?? []).map((r) => (
            <RewardRow key={r.id} schoolId={me.school_id} userId={me.id} reward={{ id: r.id, name: r.name, description: r.description, cost: r.cost, kind: r.kind, stock: r.stock, active: r.active, per_student_limit: r.per_student_limit, category: r.category, image: r.image_path ? images.get(r.image_path) ?? null : null }} />
          ))}
        </ul>
      </section>

      <section className="card p-4" data-section="redemption-records">
        <h2 className="font-semibold">Redemption records</h2>
        {history.length === 0 ? <p className="mt-2 text-sm text-black/50">Nothing handled yet.</p> : (
          <ul className="mt-2 divide-y divide-black/5 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 py-2" data-record={h.status}>
                <span className="min-w-0 flex-1 truncate"><strong>{h.profile?.full_name}</strong> · {h.reward?.name}</span>
                <span className={`chip ${h.status === "fulfilled" ? "bg-sage-soft text-brand-900" : ""}`}>{STATUS[h.status as keyof typeof STATUS] ?? h.status}</span>
                <span className="tabular-nums text-xs text-black/55">{h.cost} LP</span>
                <span className="text-xs text-black/45">{formatDateTime(h.handled_at ?? h.created_at)}</span>
                {h.note && <span className="w-full text-xs text-black/55">{h.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Top10Forms settings={t10settings} schoolId={me.school_id} userId={me.id}
        prizes={(t10prizes ?? []).map((x) => ({ place: x.place, title: x.title, description: x.description, value: x.value, special: x.special, image: x.image_path ? images.get(x.image_path) ?? null : null }))} />
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
