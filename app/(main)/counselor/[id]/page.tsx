import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { setCounselorStatus } from "@/app/actions/counselor";
import { HelpNow } from "@/components/help-now";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { ReplyForm } from "../forms";
import { COUNSELOR_TOPICS as TOPICS } from "@/lib/labels";

async function Thread({ params }: { params: PageProps<"/counselor/[id]">["params"] }) {
  const { id } = await params;
  const me = await getMe();
  if (!me || !me.onboarded_at || me.deactivated_at) redirect("/login");
  const supabase = await createClient();
  const [{ data: r }, { data: messages }] = await Promise.all([
    supabase.from("counselor_requests").select("*, student:profiles!counselor_requests_student_id_fkey(full_name, grade)").eq("id", id).maybeSingle(),
    supabase.from("counselor_messages").select("id, sender_id, body, created_at").eq("request_id", id).order("created_at"),
  ]);
  // The security rules return nothing unless you are the student or the counselor.
  if (!r) notFound();
  const isCounselor = me.role === "counselor";

  return (
    <div className="space-y-4">
      <PageHeader title={isCounselor ? (r.student?.full_name ?? "Student") : "Private conversation"} back="/counselor" />
      <p className="text-xs text-black/50">
        🔒 {TOPICS[r.topic]}{r.urgent && " · urgent"}{isCounselor && r.student ? ` · grade ${r.student.grade}` : ""} · only the student and the counselor can see this
      </p>
      {!isCounselor && <HelpNow />}
      <div className="space-y-2">
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "rounded-br-md bg-brand-700 text-white" : "rounded-bl-md bg-white shadow-sm"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? "text-white/70" : "text-black/40"}`}>
                  {mine ? "You" : isCounselor ? "Student" : "Counselor"} · {formatDateTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {r.status === "closed" ? (
        <p className="rounded-xl bg-black/5 px-4 py-3 text-sm text-black/60">
          This conversation is closed. {isCounselor ? "" : "You can always start a new one."}
        </p>
      ) : (
        <ReplyForm requestId={r.id} />
      )}
      {isCounselor && (
        <form action={setCounselorStatus} className="flex gap-2">
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="status" value={r.status === "closed" ? "in_progress" : "closed"} />
          <SubmitButton className="btn-secondary w-full" pendingText="…">{r.status === "closed" ? "Re-open" : "Close conversation"}</SubmitButton>
        </form>
      )}
    </div>
  );
}

export default function CounselorThreadPage(props: PageProps<"/counselor/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Thread params={props.params} />
    </Suspense>
  );
}
