import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate, localDayKey } from "@/lib/time";
import { deleteHours } from "@/app/actions/volunteering";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { LogHoursForm } from "./log-form";

export const metadata = { title: "Volunteering" };

const STATUS: Record<string, string> = { pending: "⏳ Waiting", approved: "✅ Approved", rejected: "✕ Not approved" };

async function Volunteering() {
  const me = await requireMe();
  if (!me.isStudent) redirect("/more");
  const supabase = await createClient();
  const { data } = await supabase
    .from("volunteer_entries")
    .select("id, organization, description, activity_date, hours, status, review_note")
    .eq("profile_id", me.id)
    .order("activity_date", { ascending: false });
  const entries = data ?? [];
  const approved = entries.filter((e) => e.status === "approved").reduce((s, e) => s + Number(e.hours), 0);
  const pending = entries.filter((e) => e.status === "pending").reduce((s, e) => s + Number(e.hours), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card bg-brand-700 p-4 text-white">
          <p className="text-xs text-white/75">Approved hours</p>
          <p className="text-3xl font-bold tabular-nums">{approved}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-black/50">Waiting for approval</p>
          <p className="text-3xl font-bold tabular-nums">{pending}</p>
        </div>
      </div>
      {approved > 0 && (
        <Link href="/volunteering/certificate" className="btn-secondary w-full">📄 Get my certificate</Link>
      )}

      {!me.isSuspended && <LogHoursForm today={localDayKey(new Date())} />}

      {entries.length > 0 && (
        <section>
          <h2 className="section-title">My hours</h2>
          <ul className="card divide-y divide-black/5">
            {entries.map((e) => (
              <li key={e.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{e.organization}</p>
                    <p className="text-xs text-black/50">{formatShortDate(e.activity_date)} · {Number(e.hours)} h</p>
                  </div>
                  <span className="shrink-0 text-xs">{STATUS[e.status]}</span>
                </div>
                {e.description && <p className="mt-1 text-black/65">{e.description}</p>}
                {e.review_note && <p className="mt-1 text-xs text-black/50">Moderator: {e.review_note}</p>}
                {e.status === "pending" && (
                  <form action={deleteHours} className="mt-1">
                    <input type="hidden" name="id" value={e.id} />
                    <SubmitButton className="text-xs text-black/40 hover:text-red-600" pendingText="…">Delete</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function VolunteeringPage() {
  return (
    <>
      <PageHeader title="Volunteering hours" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Volunteering />
      </Suspense>
    </>
  );
}
