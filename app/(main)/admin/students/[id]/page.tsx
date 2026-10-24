import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { setDeactivated, unsuspendMember, updateMember } from "@/app/actions/admin";
import { suspendStudent } from "@/app/actions/moderation";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

async function Student({ params }: { params: PageProps<"/admin/students/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe("admin");
  const supabase = await createClient();
  const [{ data: s }, { data: history }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar, grade, role, suspended_until, suspension_reason, deactivated_at, created_at, private:private_profiles(email)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("moderation_log").select("id, action, details, created_at").eq("target_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!s) notFound();
  const isMe = s.id === me.id;
  const suspended = s.suspended_until && new Date(s.suspended_until) > new Date();

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-3 p-4">
        <Avatar avatar={s.avatar} size="lg" />
        <div className="min-w-0">
          <Link href={`/profile/${s.id}`} className="text-lg font-bold hover:underline">{s.full_name}</Link>
          <p className="truncate text-sm text-black/55">{s.private?.email}</p>
          <p className="text-xs text-black/45">Joined {formatDateTime(s.created_at)}</p>
        </div>
      </div>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Grade and role</h2>
        <ActionForm action={updateMember} className="space-y-3">
          <input type="hidden" name="profileId" value={s.id} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="label">Grade</span>
              <select name="grade" defaultValue={s.grade ?? ""} className="input">
                {!s.grade && <option value="">Not set</option>}
                {me.school.grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="label">Role</span>
              <select name="role" defaultValue={s.role} disabled={isMe} className="input">
                <option value="student">Student</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
              {isMe && <input type="hidden" name="role" value={s.role} />}
            </label>
          </div>
          <p className="text-xs text-black/50">Moderators review reports and approve clubs and events. Admins can also manage accounts and settings.</p>
          <SubmitButton className="btn-primary w-full">Save</SubmitButton>
        </ActionForm>
      </section>

      {!isMe && (
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Suspension</h2>
          {suspended ? (
            <>
              <p className="text-sm text-red-800">
                Suspended {new Date(s.suspended_until!).getFullYear() > 9000 ? "until an admin lifts it" : `until ${formatDateTime(s.suspended_until!)}`}. Reason: {s.suspension_reason}
              </p>
              <ActionForm action={unsuspendMember}>
                <input type="hidden" name="profileId" value={s.id} />
                <SubmitButton className="btn-secondary w-full">Lift suspension</SubmitButton>
              </ActionForm>
            </>
          ) : (
            <ActionForm action={suspendStudent} className="flex flex-wrap gap-2">
              <input type="hidden" name="profileId" value={s.id} />
              <select name="days" className="input w-auto" aria-label="How long">
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="permanent">Until I lift it</option>
              </select>
              <input name="reason" required maxLength={200} placeholder="Reason (the student sees this)" className="input min-w-40 flex-1" />
              <SubmitButton className="btn-danger" pendingText="…">Suspend</SubmitButton>
            </ActionForm>
          )}
        </section>
      )}

      {!isMe && (
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">{s.deactivated_at ? "Account removed" : "Remove account"}</h2>
          <p className="text-sm text-black/55">
            {s.deactivated_at
              ? "This student can't use Pbs Go and is hidden from everyone."
              : "For students who left the school. They can't sign in to the app any more and disappear from lists. You can undo this."}
          </p>
          <ActionForm action={setDeactivated}>
            <input type="hidden" name="profileId" value={s.id} />
            <input type="hidden" name="deactivate" value={String(!s.deactivated_at)} />
            <SubmitButton className={s.deactivated_at ? "btn-secondary w-full" : "btn-danger w-full"}>
              {s.deactivated_at ? "Restore account" : "Remove account"}
            </SubmitButton>
          </ActionForm>
        </section>
      )}

      {history && history.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">History</h2>
          <ul className="space-y-1.5 text-sm">
            {history.map((h) => (
              <li key={h.id}>
                <span className="font-medium">{h.action.replace(/_/g, " ")}</span>
                <span className="text-black/60"> · {h.details}</span>
                <span className="block text-xs text-black/40">{formatDateTime(h.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function AdminStudentPage(props: PageProps<"/admin/students/[id]">) {
  return (
    <>
      <PageHeader title="Manage student" back="/admin/students" />
      <Suspense fallback={<PageSkeleton />}>
        <Student params={props.params} />
      </Suspense>
    </>
  );
}
