import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { requestLeadershipRole } from "@/app/actions/account";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { LEADERSHIP_KINDS, leadershipLabel } from "@/lib/leadership";

export const metadata = { title: "Leadership roles" };

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Waiting for review", className: "bg-amber-50 text-amber-900" },
  approved: { label: "Approved", className: "bg-brand-50 text-brand-800" },
  rejected: { label: "Not approved", className: "bg-red-50 text-red-800" },
};

async function Leadership() {
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data: roles }, { data: requests }, { data: memberships }] = await Promise.all([
    supabase.from("leadership_roles").select("id, kind, scope, club:clubs(name)").eq("profile_id", me.id).order("assigned_at"),
    supabase
      .from("leadership_requests")
      .select("id, kind, scope, status, review_note, created_at, club:clubs(name)")
      .eq("profile_id", me.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("club_members").select("club:clubs(id, name, status)").eq("profile_id", me.id),
  ]);
  const clubs = (memberships ?? []).flatMap((m) => (m.club && m.club.status === "approved" ? [m.club] : []));

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="font-semibold">Your roles</h2>
        {(roles ?? []).length === 0 ? (
          <p className="mt-1 text-sm text-black/55">You have no leadership role yet. You can ask for one below.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {(roles ?? []).map((r) => (
              <li key={r.id} className="chip bg-brand-50 text-brand-800">{leadershipLabel(r.kind, r.scope, r.club?.name)}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-black/50">
          You can hold more than one role. Once a role is given, only a Super Admin can change or remove it.
        </p>
      </section>

      {me.isStudent && !me.isSuspended && (
        <section className="card p-4">
          <h2 className="font-semibold">Ask for a role</h2>
          <ActionForm action={requestLeadershipRole} className="mt-3 space-y-3">
            <label className="block">
              <span className="label">Role</span>
              <select name="kind" className="input" defaultValue="class_rep">
                {LEADERSHIP_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Class (class representatives) or position (council)</span>
              <input name="scope" maxLength={60} placeholder="e.g. 11A" className="input" />
            </label>
            <label className="block">
              <span className="label">Club (club leaders only)</span>
              <select name="clubId" className="input" defaultValue="">
                <option value="">Choose a club you are in</option>
                {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Why should you have this role?</span>
              <textarea name="reason" required minLength={10} maxLength={1000} rows={3} className="input resize-none" />
            </label>
            <SubmitButton className="btn-primary w-full">Send request</SubmitButton>
          </ActionForm>
        </section>
      )}

      {(requests ?? []).length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Your requests</h2>
          <ul className="space-y-2 text-sm">
            {(requests ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span className={`chip ${STATUS[r.status].className}`}>{STATUS[r.status].label}</span>
                <span>{leadershipLabel(r.kind, r.scope, r.club?.name)}</span>
                <span className="text-black/45">{formatDateTime(r.created_at)}</span>
                {r.review_note && <span className="w-full text-black/60">Note: {r.review_note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function LeadershipPage() {
  return (
    <>
      <PageHeader title="Leadership roles" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Leadership />
      </Suspense>
    </>
  );
}
