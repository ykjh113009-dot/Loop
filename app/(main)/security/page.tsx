import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { MfaPanel } from "./mfa-panel";

export const metadata = { title: "Security" };

const EVENTS: Record<string, string> = {
  sign_in: "Signed in",
  new_device: "New browser or device",
  mfa_enabled: "Two-step sign-in turned on",
  mfa_disabled: "Two-step sign-in turned off",
  mfa_verified: "Two-step sign-in passed",
};

// Turns a long browser description into something readable, e.g. "Chrome on Windows".
function browserName(ua: string | null) {
  if (!ua) return "Unknown browser";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const system = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return system ? `${browser} on ${system}` : browser;
}

async function Security() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("security_events")
    .select("id, kind, user_agent, created_at")
    .eq("profile_id", me.id)
    .order("created_at", { ascending: false })
    .limit(15);
  const adminRole = me.role === "admin" || me.role === "super_admin";

  return (
    <div className="space-y-4">
      <MfaPanel required={adminRole && me.school.admin_mfa_required} needsStep={me.needsMfa} />

      <section className="card p-4">
        <h2 className="font-semibold">How you sign in</h2>
        <p className="mt-1 text-sm text-black/60">
          You sign in with your school Google account. Loop never sees or stores your password, and nobody (not even
          admins) can read it. To change your password or recover your account, use your Google account settings or
          ask the school&apos;s Google administrator.
        </p>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Recent activity on your account</h2>
        <ul className="mt-2 divide-y divide-black/5 text-sm">
          {(events ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-2 py-2">
              <span className={e.kind === "new_device" ? "font-semibold text-amber-800" : "font-medium"}>{EVENTS[e.kind] ?? e.kind}</span>
              <span className="text-black/55">{browserName(e.user_agent)}</span>
              <span className="ml-auto text-xs text-black/45">{formatDateTime(e.created_at)}</span>
            </li>
          ))}
          {(events ?? []).length === 0 && <li className="py-2 text-black/55">Nothing recorded yet.</li>}
        </ul>
        <p className="mt-2 text-xs text-black/50">See something that was not you? Tell an admin straight away.</p>
      </section>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <>
      <PageHeader title="Security" />
      <Suspense fallback={<PageSkeleton />}>
        <Security />
      </Suspense>
    </>
  );
}
