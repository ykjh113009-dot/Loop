import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { ApplyWizard } from "./apply-wizard";
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
  // Same first steps as every student: set up the profile, then come back here for the application.
  if (!me.onboarded_at) redirect("/welcome?next=apply-admin");

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

  const status = alreadyAdmin ? "admin" : pending ? "pending" : "form";
  const past = (mine ?? []).map((a) => ({
    id: a.id,
    label: STATUS[a.status].label,
    className: STATUS[a.status].className,
    text: `Asked for ${ROLE_NAMES[a.requested_role]}${a.status === "approved" && a.assigned_role ? `, given ${ROLE_NAMES[a.assigned_role]}` : ""}`,
    when: formatDateTime(a.created_at),
    note: a.review_note,
  }));
  return (
    <ApplyWizard
      name={me.full_name}
      email={contact?.email ?? ""}
      avatar={me.avatar}
      schoolName={me.school.name}
      status={status}
      past={past}
      backHref="/home"
      backLabel={me.onboarded_at ? "Back to Loop" : "Continue to Loop"}
    />
  );
}

export default function ApplyAdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Application />
    </Suspense>
  );
}
