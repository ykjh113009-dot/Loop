import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { removeLeadershipRole, reviewLeadershipRequest } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { AdminNav } from "@/components/admin-nav";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { leadershipLabel } from "@/lib/leadership";

export const metadata = { title: "Leadership" };

async function Leadership() {
  const me = await requireMe("admin");
  const supabase = await createClient();
  const [{ data: requests }, { data: roles }] = await Promise.all([
    supabase
      .from("leadership_requests")
      .select("id, kind, scope, reason, created_at, profile_id, club:clubs(name), student:profiles!leadership_requests_profile_id_fkey(id, full_name, grade)")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("leadership_roles")
      .select("id, kind, scope, assigned_at, club:clubs(name), student:profiles!leadership_roles_profile_id_fkey(id, full_name, grade)")
      .order("kind")
      .order("assigned_at")
      .limit(500),
  ]);

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <h2 className="section-title">Requests waiting</h2>
        {(requests ?? []).length === 0 && <Empty emoji="✅" title="No requests waiting" />}
        {(requests ?? []).map((r) => (
          <article key={r.id} className="card space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/admin/students/${r.student?.id}`} className="font-semibold hover:underline">{r.student?.full_name}</Link>
              {r.student?.grade && <span className="text-sm text-black/45">Grade {r.student.grade}</span>}
              <span className="chip bg-amber-50 text-amber-900">{leadershipLabel(r.kind, r.scope, r.club?.name)}</span>
              <span className="ms-auto text-xs text-black/45">{formatDateTime(r.created_at)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{r.reason}</p>
            {r.profile_id === me.id ? (
              <p className="text-xs text-black/50">This is your own request. Another admin must review it.</p>
            ) : (
              <ActionForm action={reviewLeadershipRequest} className="flex flex-wrap gap-2 border-t border-black/5 pt-3">
                <input type="hidden" name="requestId" value={r.id} />
                <input name="note" maxLength={500} placeholder="Message to the student (required if you reject)" className="input min-w-40 flex-1" />
                <SubmitButton name="decision" value="approve" className="btn-primary" pendingText="…">Approve</SubmitButton>
                <SubmitButton name="decision" value="reject" className="btn-danger" pendingText="…">Reject</SubmitButton>
              </ActionForm>
            )}
          </article>
        ))}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Assigned roles <span className="font-normal text-black/45">({(roles ?? []).length})</span></h2>
        <p className="mt-1 text-xs text-black/50">Only a Super Admin can remove a role that was already given.</p>
        <ul className="mt-3 divide-y divide-black/5 text-sm">
          {(roles ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
              <Link href={`/profile/${r.student?.id}`} className="font-medium hover:underline">{r.student?.full_name}</Link>
              <span className="chip bg-brand-50 text-brand-800">{leadershipLabel(r.kind, r.scope, r.club?.name)}</span>
              {me.isSuperAdmin && (
                <ActionForm action={removeLeadershipRole} className="ms-auto">
                  <input type="hidden" name="roleId" value={r.id} />
                  <SubmitButton className="btn-secondary px-3 py-1.5" pendingText="…">Remove</SubmitButton>
                </ActionForm>
              )}
            </li>
          ))}
          {(roles ?? []).length === 0 && <li className="py-2 text-black/55">No leadership roles yet.</li>}
        </ul>
      </section>
    </div>
  );
}

export default function AdminLeadershipPage() {
  return (
    <>
      <PageHeader title="Admin" />
      <AdminNav current="/admin/leadership" />
      <Suspense fallback={<PageSkeleton />}>
        <Leadership />
      </Suspense>
    </>
  );
}
