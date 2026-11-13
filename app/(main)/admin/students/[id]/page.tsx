import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { setAlumni, resetAccountMfa, setDeactivated, setRestriction, unsuspendMember, updateMember } from "@/app/actions/admin";
import { suspendStudent } from "@/app/actions/moderation";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

const ROLE_RANK: Record<string, number> = { moderator: 1, admin: 2, super_admin: 3 };
const RESTRICTIONS: Record<string, string> = {
  posting: "Posting",
  commenting: "Commenting and answering",
  messaging: "Messaging",
  creating_groups: "Creating clubs and groups",
  publishing: "Publishing (events, listings, suggestions)",
};

async function Student({ params }: { params: PageProps<"/admin/students/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe("admin");
  const supabase = await createClient();
  const [{ data: s }, { data: history }, { data: restrictions }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar, grade, role, is_owner, alumni_year, suspended_until, suspension_reason, deactivated_at, created_at, private:private_profiles(email)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("moderation_log").select("id, action, details, created_at").eq("target_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("account_restrictions").select("kind, until, reason").eq("profile_id", id).gt("until", new Date().toISOString()),
  ]);
  if (!s) notFound();
  const isMe = s.id === me.id;
  const suspended = s.suspended_until && new Date(s.suspended_until) > new Date();
  // Admins manage accounts below their own role. Only Super Admins change roles,
  // and only the owner appoints Super Admins. The database enforces all of this.
  const rank = (role: string) => ROLE_RANK[role] ?? 0;
  const canManage = !isMe && !s.is_owner && (me.isOwner || rank(me.role) > rank(s.role));
  const canChangeRole = !isMe && me.isSuperAdmin && !s.is_owner && (me.isOwner || s.role !== "super_admin");

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
              <select name="role" defaultValue={s.role} disabled={!canChangeRole} className="input">
                <option value="student">Student</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
                {(me.isOwner || s.role === "super_admin") && <option value="super_admin">Super Admin</option>}
                <option value="counselor">School counselor (staff)</option>
              </select>
              {!canChangeRole && <input type="hidden" name="role" value={s.role} />}
            </label>
          </div>
          <p className="text-xs text-black/50">
            {!me.isSuperAdmin && "Only a Super Admin can change roles. "}
            Moderators review reports. Admins also manage accounts, announcements and events. Super Admins manage admins and settings. The
            counselor is an adult staff member who reads the private &quot;Talk to the counselor&quot; messages — nobody else can.
          </p>
          <SubmitButton className="btn-primary w-full">Save</SubmitButton>
        </ActionForm>
      </section>

      {canManage && s.role !== "counselor" && (
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Alumni mentor</h2>
          <p className="text-sm text-black/55">
            Graduates who help in the Tawjihi corner. They don&apos;t have a grade, don&apos;t collect points, and can&apos;t send
            private messages to students.
          </p>
          <ActionForm action={setAlumni} className="flex gap-2">
            <input type="hidden" name="profileId" value={s.id} />
            <input name="alumni_year" type="number" min={1990} max={2100} defaultValue={s.alumni_year ?? ""} placeholder="Graduation year, empty = current student" className="input" />
            <SubmitButton className="btn-secondary shrink-0">Save</SubmitButton>
          </ActionForm>
        </section>
      )}

      {canManage && (
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Suspension</h2>
          {suspended ? (
            <>
              <p className="text-sm text-red-800">
                Suspended {new Date(s.suspended_until!).getFullYear() > 9000 ? "for now" : `until ${formatDateTime(s.suspended_until!)}`}. Reason: {s.suspension_reason}
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
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="custom">Custom…</option>
              </select>
              <input name="customDays" type="number" min={1} max={365} placeholder="Days (custom)" aria-label="Custom number of days" className="input w-32" />
              <input name="reason" required maxLength={200} placeholder="Reason (the student sees this)" className="input min-w-40 flex-1" />
              <SubmitButton className="btn-danger" pendingText="…">Suspend</SubmitButton>
            </ActionForm>
          )}
        </section>
      )}

      {canManage && me.isSuperAdmin && (s.role === "admin" || s.role === "super_admin") && (
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Two-step sign-in</h2>
          <p className="text-sm text-black/55">Lost phone or authenticator app? Reset it so they can set it up again.</p>
          <ActionForm action={resetAccountMfa}>
            <input type="hidden" name="profileId" value={s.id} />
            <SubmitButton className="btn-secondary w-full">Reset two-step sign-in</SubmitButton>
          </ActionForm>
        </section>
      )}

      {canManage && (
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Paused activities</h2>
          <p className="text-sm text-black/55">Pause one thing without suspending the whole account. The student is told why.</p>
          {(restrictions ?? []).map((r) => (
            <div key={r.kind} className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="min-w-0 flex-1">
                <strong>{RESTRICTIONS[r.kind]}</strong> paused until {formatDateTime(r.until)}. Reason: {r.reason}
              </span>
              <ActionForm action={setRestriction}>
                <input type="hidden" name="profileId" value={s.id} />
                <input type="hidden" name="kind" value={r.kind} />
                <SubmitButton className="btn-secondary px-3 py-1.5" pendingText="…">Lift</SubmitButton>
              </ActionForm>
            </div>
          ))}
          <ActionForm action={setRestriction} className="flex flex-wrap gap-2">
            <input type="hidden" name="profileId" value={s.id} />
            <select name="kind" className="input w-auto" aria-label="Activity to pause">
              {Object.entries(RESTRICTIONS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
            </select>
            <input name="days" type="number" min={1} max={365} defaultValue={7} aria-label="Days" className="input w-24" />
            <input name="reason" required maxLength={200} placeholder="Reason (the student sees this)" className="input min-w-40 flex-1" />
            <SubmitButton className="btn-danger" pendingText="…">Pause</SubmitButton>
          </ActionForm>
        </section>
      )}

      {canManage && (
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">{s.deactivated_at ? "Account removed" : "Remove account"}</h2>
          <p className="text-sm text-black/55">
            {s.deactivated_at
              ? "This student can't use Loop and is hidden from everyone."
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
