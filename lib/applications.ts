import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { leadershipLabel } from "@/lib/leadership";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AppKind = "admin" | "leadership";
export type AppView = {
  kind: AppKind;
  id: string;
  status: "pending" | "approved" | "rejected";
  /** What they asked for, and what they were actually given (these can differ). */
  requested: string;
  granted: string | null;
  position: string;
  note: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
  seen: boolean;
  /** Where "Go to My Dashboard" leads. Only used for approved applications. */
  dashboard: string;
  responsibilities: string;
  resubmit: string;
};

const ADMIN_ROLE: Record<string, { name: string; dashboard: string; about: string }> = {
  moderator: { name: "Moderator", dashboard: "/moderation", about: "Review reports, look after conversations and keep Loop a safe, kind place." },
  admin: { name: "Admin", dashboard: "/admin", about: "Look after students, content and settings so Loop runs well for the whole school." },
  super_admin: { name: "Super Admin", dashboard: "/admin", about: "Oversee admins and the platform, and decide on admin applications." },
};
const LEADERSHIP_ABOUT: Record<string, string> = {
  class_rep: "Be the voice of your class and bring ideas and concerns to the school.",
  club_leader: "Lead your club: welcome members, plan events and share news.",
  council_member: "Serve on the Student Council: review student proposals and help run student-led activities.",
  school_staff: "Support students and activities as designated school staff.",
};

type AdminRow = {
  id: string; status: string; requested_role: string; assigned_role: string | null; position: string; review_note: string | null;
  created_at: string; reviewed_at: string | null; decision_seen_at: string | null; reviewer: { full_name: string } | null;
};
type LeadRow = {
  id: string; status: string; kind: string; scope: string; review_note: string | null; created_at: string; reviewed_at: string | null;
  decision_seen_at: string | null; club: { name: string } | null; reviewer: { full_name: string } | null;
};

const fromAdmin = (a: AdminRow): AppView => {
  const given = a.assigned_role ? ADMIN_ROLE[a.assigned_role] : null;
  return {
    kind: "admin", id: a.id, status: a.status as AppView["status"], requested: ADMIN_ROLE[a.requested_role]?.name ?? a.requested_role,
    granted: given?.name ?? null, position: a.position, note: a.review_note, submittedAt: a.created_at, reviewedAt: a.reviewed_at,
    reviewer: a.reviewer?.full_name ?? null, seen: !!a.decision_seen_at, dashboard: given?.dashboard ?? "/home",
    responsibilities: given?.about ?? "", resubmit: "/apply-admin",
  };
};
const fromLead = (r: LeadRow): AppView => {
  const label = leadershipLabel(r.kind, r.scope, r.club?.name);
  return {
    kind: "leadership", id: r.id, status: r.status as AppView["status"], requested: label, granted: r.status === "approved" ? label : null,
    position: "", note: r.review_note, submittedAt: r.created_at, reviewedAt: r.reviewed_at, reviewer: r.reviewer?.full_name ?? null,
    seen: !!r.decision_seen_at, dashboard: "/leadership/dashboard", responsibilities: LEADERSHIP_ABOUT[r.kind] ?? "", resubmit: "/leadership",
  };
};

// The person's own applications (the database only returns their own), newest first.
export async function myApplications(supabase: Supabase, userId: string): Promise<AppView[]> {
  const [{ data: admin }, { data: lead }] = await Promise.all([
    supabase.from("admin_applications")
      .select("id, status, requested_role, assigned_role, position, review_note, created_at, reviewed_at, decision_seen_at, reviewer:profiles!admin_applications_reviewed_by_fkey(full_name)")
      .eq("applicant_id", userId).order("created_at", { ascending: false }).limit(10),
    supabase.from("leadership_requests")
      .select("id, status, kind, scope, review_note, created_at, reviewed_at, decision_seen_at, club:clubs(name), reviewer:profiles!leadership_requests_reviewed_by_fkey(full_name)")
      .eq("profile_id", userId).order("created_at", { ascending: false }).limit(10),
  ]);
  const all = [...((admin ?? []) as unknown as AdminRow[]).map(fromAdmin), ...((lead ?? []) as unknown as LeadRow[]).map(fromLead)];
  return all.sort((a, b) => (b.reviewedAt ?? b.submittedAt).localeCompare(a.reviewedAt ?? a.submittedAt));
}

// What to show right after signing in: a decision they have not seen yet, otherwise a waiting application.
export function pickGate(apps: AppView[]): AppView | null {
  return apps.find((a) => a.status !== "pending" && !a.seen) ?? apps.find((a) => a.status === "pending") ?? null;
}

// Where a person goes right after signing in.
export async function afterSignInPath(supabase: Supabase, userId: string, to = "/home") {
  const gate = pickGate(await myApplications(supabase, userId).catch(() => []));
  return gate ? `/application-update?next=${encodeURIComponent(to)}` : to;
}
