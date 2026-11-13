import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { reviewAdminApplication } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { AdminNav } from "@/components/admin-nav";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Admin applications" };

const ROLE_NAMES: Record<string, string> = { moderator: "Moderator", admin: "Admin", super_admin: "Super Admin" };

async function Applications() {
  const me = await requireMe("admin");
  if (!me.isSuperAdmin) {
    return <p className="card p-4 text-sm text-black/60">Only Super Admins can read and review admin applications.</p>;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_applications")
    .select(
      "id, requested_role, position, motivation, contribution, experience, status, assigned_role, review_note, created_at, reviewed_at, applicant:profiles!admin_applications_applicant_id_fkey(id, full_name, avatar, grade, role, private:private_profiles(email)), reviewer:profiles!admin_applications_reviewed_by_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  const pending = (data ?? []).filter((a) => a.status === "pending");
  const reviewed = (data ?? []).filter((a) => a.status !== "pending");

  return (
    <div className="space-y-4">
      {pending.length === 0 && <Empty emoji="✅" title="No applications waiting">New applications appear here and you get a notification.</Empty>}
      {pending.map((a) => (
        <article key={a.id} className="card space-y-3 p-4">
          <div className="flex items-center gap-3">
            <Avatar avatar={a.applicant?.avatar ?? "a01"} size="md" />
            <div className="min-w-0 flex-1">
              <Link href={`/admin/students/${a.applicant?.id}`} className="font-semibold hover:underline">{a.applicant?.full_name}</Link>
              <p className="truncate text-sm text-black/55">{a.applicant?.private?.email}</p>
            </div>
            <span className="chip bg-amber-50 text-amber-900">Wants: {ROLE_NAMES[a.requested_role]}</span>
          </div>
          <dl className="space-y-2 text-sm">
            <div><dt className="label">Current position</dt><dd>{a.position || "Not given"}{a.applicant?.grade ? ` · Grade ${a.applicant.grade}` : ""}</dd></div>
            <div><dt className="label">Why they want the role</dt><dd className="whitespace-pre-wrap">{a.motivation}</dd></div>
            <div><dt className="label">What they plan to contribute</dt><dd className="whitespace-pre-wrap">{a.contribution}</dd></div>
            <div><dt className="label">Relevant experience</dt><dd className="whitespace-pre-wrap">{a.experience || "Not given"}</dd></div>
          </dl>
          <p className="text-xs text-black/45">Sent {formatDateTime(a.created_at)}</p>
          <ActionForm action={reviewAdminApplication} className="flex flex-wrap gap-2 border-t border-black/5 pt-3">
            <input type="hidden" name="applicationId" value={a.id} />
            <select name="role" defaultValue={a.requested_role} className="input w-auto" aria-label="Role to give">
              <option value="moderator">Give: Moderator</option>
              <option value="admin">Give: Admin</option>
              {me.isOwner && <option value="super_admin">Give: Super Admin</option>}
            </select>
            <input name="note" maxLength={500} placeholder="Note to the applicant (optional)" className="input min-w-40 flex-1" />
            <SubmitButton name="decision" value="approve" className="btn-primary" pendingText="…">Approve</SubmitButton>
            <SubmitButton name="decision" value="reject" className="btn-danger" pendingText="…">Reject</SubmitButton>
          </ActionForm>
        </article>
      ))}

      {reviewed.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Reviewed</h2>
          <ul className="space-y-2 text-sm">
            {reviewed.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span className={`chip ${a.status === "approved" ? "bg-brand-50 text-brand-800" : "bg-red-50 text-red-800"}`}>
                  {a.status === "approved" ? `Approved as ${ROLE_NAMES[a.assigned_role ?? ""] ?? ""}` : "Rejected"}
                </span>
                <span className="font-medium">{a.applicant?.full_name}</span>
                <span className="text-black/45">
                  asked for {ROLE_NAMES[a.requested_role]} · by {a.reviewer?.full_name ?? "a former admin"} · {a.reviewed_at && formatDateTime(a.reviewed_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function AdminApplicationsPage() {
  return (
    <>
      <PageHeader title="Admin" />
      <AdminNav current="/admin/applications" />
      <Suspense fallback={<PageSkeleton />}>
        <Applications />
      </Suspense>
    </>
  );
}
