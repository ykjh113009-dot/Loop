import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { submitAdminApplication } from "@/app/actions/account";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Admin application" };

const ROLE_NAMES: Record<string, string> = { moderator: "Moderator", admin: "Admin", super_admin: "Super Admin" };
const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Waiting for review", className: "bg-amber-50 text-amber-900" },
  approved: { label: "Approved", className: "bg-brand-50 text-brand-800" },
  rejected: { label: "Not approved", className: "bg-red-50 text-red-800" },
};

async function Application() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.deactivated_at) redirect("/removed");

  const supabase = await createClient();
  const [{ data: mine }, { data: contact }] = await Promise.all([
    supabase
      .from("admin_applications")
      .select("id, requested_role, status, assigned_role, review_note, created_at")
      .eq("applicant_id", me.id)
      .order("created_at", { ascending: false }),
    supabase.from("private_profiles").select("email").eq("id", me.id).maybeSingle(),
  ]);
  const pending = (mine ?? []).some((a) => a.status === "pending");
  const alreadyAdmin = me.role === "admin" || me.role === "super_admin";

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Admin application</h1>
        <p className="mt-1 text-black/60">
          Admins and moderators help run Loop for {me.school.name}. A Super Admin reads every application. You get no
          admin access until it is approved, and you may be given a different role from the one you ask for.
        </p>
      </div>

      {(mine ?? []).length > 0 && (
        <section className="card space-y-2 p-4">
          <h2 className="font-semibold">Your applications</h2>
          <ul className="space-y-2 text-sm">
            {(mine ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span className={`chip ${STATUS[a.status].className}`}>{STATUS[a.status].label}</span>
                <span>
                  Asked for {ROLE_NAMES[a.requested_role]}
                  {a.status === "approved" && a.assigned_role && `, given ${ROLE_NAMES[a.assigned_role]}`}
                </span>
                <span className="text-black/45">{formatDateTime(a.created_at)}</span>
                {a.review_note && <span className="w-full text-black/60">Note: {a.review_note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {alreadyAdmin ? (
        <p className="card p-4 text-sm">You already have an admin account.</p>
      ) : pending ? (
        <p className="card p-4 text-sm">Your application is waiting for review. You will get a notification with the answer.</p>
      ) : (
        <ActionForm action={submitAdminApplication} className="card space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Full name</span>
              <input value={me.full_name} readOnly className="input bg-black/[0.03]" />
            </label>
            <label className="block">
              <span className="label">School email</span>
              <input value={contact?.email ?? ""} readOnly className="input bg-black/[0.03]" />
            </label>
          </div>
          <p className="-mt-2 text-xs text-black/50">Taken from your school Google account, so it cannot be changed here.</p>
          <label className="block">
            <span className="label">Role you are asking for</span>
            <select name="role" className="input" defaultValue="moderator">
              <option value="moderator">Moderator: reviews reports and removes harmful content</option>
              <option value="admin">Admin: also manages accounts, announcements and events</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Your position at school (optional)</span>
            <input name="position" maxLength={120} placeholder="e.g. Grade 11 student, teacher, activities coordinator" className="input" />
          </label>
          <label className="block">
            <span className="label">Why do you want this role?</span>
            <textarea name="motivation" required minLength={20} maxLength={1500} rows={3} className="input resize-none" />
          </label>
          <label className="block">
            <span className="label">What do you plan to contribute?</span>
            <textarea name="contribution" required minLength={20} maxLength={1500} rows={3} className="input resize-none" />
          </label>
          <label className="block">
            <span className="label">Relevant experience (optional)</span>
            <textarea name="experience" maxLength={1500} rows={3} className="input resize-none" />
          </label>
          <SubmitButton className="btn-primary w-full">Send application</SubmitButton>
        </ActionForm>
      )}

      <p className="text-center text-sm">
        <Link href="/home" className="font-semibold text-brand-700 hover:underline">
          {me.onboarded_at ? "Back to Loop" : "Continue to Loop"}
        </Link>
      </p>
    </>
  );
}

export default function ApplyAdminPage() {
  return (
    <main className="mx-auto max-w-xl space-y-5 px-5 py-8">
      <Suspense fallback={<PageSkeleton />}>
        <Application />
      </Suspense>
    </main>
  );
}
