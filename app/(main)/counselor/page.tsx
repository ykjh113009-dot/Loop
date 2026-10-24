import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { Empty } from "@/components/empty";
import { HelpNow } from "@/components/help-now";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { CounselorRequestForm } from "./forms";
import { COUNSELOR_TOPICS as TOPICS } from "@/lib/labels";

export const metadata = { title: "Talk to the counselor" };

const STATUS: Record<string, string> = { open: "New", in_progress: "Talking", closed: "Closed" };

async function Counselor() {
  // Suspended students can still use this page.
  const me = await getMe();
  if (!me || !me.onboarded_at || me.deactivated_at) redirect("/login");
  const supabase = await createClient();
  const isCounselor = me.role === "counselor";
  const { data } = await supabase
    .from("counselor_requests")
    .select("id, topic, urgent, status, created_at, last_message_at, student:profiles!counselor_requests_student_id_fkey(full_name, grade)")
    .order("last_message_at", { ascending: false })
    .limit(100);
  const requests = data ?? [];

  if (isCounselor) {
    const sorted = [...requests].sort((a, b) =>
      Number(b.status !== "closed") - Number(a.status !== "closed") || Number(b.urgent) - Number(a.urgent),
    );
    return (
      <div className="space-y-3">
        <PageHeader title="Counselor inbox" back="/more" />
        <p className="text-sm text-black/55">Only you (and any other counselor) can see these. School admins and moderators cannot.</p>
        {sorted.length === 0 ? <Empty emoji="🔒" title="No requests yet" /> : (
          <ul className="card divide-y divide-black/5">
            {sorted.map((r) => (
              <li key={r.id}>
                <Link href={`/counselor/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]">
                  <div className="min-w-0 flex-1">
                    <p className={r.status === "open" ? "font-bold" : "font-medium"}>
                      {r.urgent && r.status !== "closed" && <span className="mr-1 text-red-600">● Urgent</span>}
                      {r.student?.full_name} <span className="text-xs font-normal text-black/45">grade {r.student?.grade}</span>
                    </p>
                    <p className="text-xs text-black/50">{TOPICS[r.topic]} · {timeAgo(r.last_message_at)}</p>
                  </div>
                  <span className="chip">{STATUS[r.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (!me.isStudent) redirect("/more");
  const { data: hasCounselor } = await supabase.rpc("school_has_counselor");

  return (
    <div className="space-y-4">
      <PageHeader title="Talk to the counselor" back="/more" />
      <div className="card space-y-1 p-4 text-sm">
        <p className="text-base font-semibold">🫶 You don&apos;t have to handle it alone</p>
        <p className="text-black/65">
          Send a private message to the school counselor. <strong>Only you and the counselor</strong> can read it — not
          your classmates, not the student moderators, not the school admins.
        </p>
      </div>
      <HelpNow />
      {hasCounselor ? (
        <CounselorRequestForm />
      ) : (
        <p className="card p-4 text-sm text-black/65">
          Your school hasn&apos;t added a counselor to Pbs Go yet. Please talk to a teacher or adult you trust at school.
        </p>
      )}
      {requests.length > 0 && (
        <section>
          <h2 className="section-title">My conversations</h2>
          <ul className="card divide-y divide-black/5">
            {requests.map((r) => (
              <li key={r.id}>
                <Link href={`/counselor/${r.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-black/[0.02]">
                  <span>{TOPICS[r.topic]} · {timeAgo(r.last_message_at)}</span>
                  <span className="chip">{STATUS[r.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function CounselorPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Counselor />
    </Suspense>
  );
}
