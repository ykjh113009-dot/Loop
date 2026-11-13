import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { AdminNav } from "@/components/admin-nav";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Activity log" };

const SECURITY: Record<string, string> = {
  sign_in: "Signed in",
  new_device: "Signed in from a new browser or device",
  mfa_enabled: "Turned on two-step sign-in",
  mfa_disabled: "Turned off two-step sign-in",
  mfa_verified: "Passed two-step sign-in",
};

async function Log() {
  await requireMe("admin");
  const supabase = await createClient();
  const [{ data: actions }, { data: security }] = await Promise.all([
    supabase
      .from("moderation_log")
      .select("id, action, details, created_at, actor:profiles!moderation_log_actor_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("security_events")
      .select("id, kind, ip, created_at, person:profiles!security_events_profile_id_fkey(full_name, role)")
      .neq("kind", "sign_in")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="font-semibold">Admin and moderator actions</h2>
        <p className="mt-1 text-xs text-black/50">Every important action is recorded here. Entries can never be edited or deleted.</p>
        <ul className="mt-3 divide-y divide-black/5 text-sm">
          {(actions ?? []).map((a) => (
            <li key={a.id} className="py-2">
              <p>
                <strong>{a.actor?.full_name ?? "Automatic"}</strong>{" "}
                <span className="chip">{a.action.replaceAll("_", " ")}</span> {a.details}
              </p>
              <p className="text-xs text-black/45">{formatDateTime(a.created_at)}</p>
            </li>
          ))}
          {(actions ?? []).length === 0 && <li className="py-2 text-black/55">Nothing recorded yet.</li>}
        </ul>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Security alerts</h2>
        <p className="mt-1 text-xs text-black/50">New devices and changes to two-step sign-in. Passwords are never stored or shown.</p>
        <ul className="mt-3 divide-y divide-black/5 text-sm">
          {(security ?? []).map((e) => (
            <li key={e.id} className="py-2">
              <p><strong>{e.person?.full_name}</strong> · {SECURITY[e.kind] ?? e.kind}</p>
              <p className="text-xs text-black/45">{formatDateTime(e.created_at)}{e.ip ? ` · ${e.ip}` : ""}</p>
            </li>
          ))}
          {(security ?? []).length === 0 && <li className="py-2 text-black/55">No alerts.</li>}
        </ul>
      </section>
    </div>
  );
}

export default function AdminLogPage() {
  return (
    <>
      <PageHeader title="Admin" />
      <AdminNav current="/admin/log" />
      <Suspense fallback={<PageSkeleton />}>
        <Log />
      </Suspense>
    </>
  );
}
