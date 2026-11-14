import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { formatDateTime, timeAgo } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { AssignmentForm, CompleteForm, ReviewApplication, StatusButtons } from "../../volunteer-forms";

export const metadata = { title: "Manage volunteers" };

async function Manage({ params }: { params: PageProps<"/volunteering/manage/[id]">["params"] }) {
  const { id } = await params;
  await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: o } = await supabase.from("volunteer_opportunities").select("*, event:events(id, title)").eq("id", id).maybeSingle();
  if (!o) notFound();
  const { data: canManage } = await supabase.rpc("can_manage_opportunity", { p_opp: id });
  if (!canManage) redirect("/volunteering");
  const { data: apps } = await supabase
    .from("volunteer_applications")
    .select("id, status, message, responsibility, review_note, hours, created_at, profile:profiles!volunteer_applications_profile_id_fkey(id, full_name, grade)")
    .eq("opportunity_id", id).order("created_at");
  const all = apps ?? [];
  const accepted = all.filter((a) => a.status === "accepted");
  const done = all.filter((a) => a.status === "completed");
  const waiting = all.filter((a) => a.status === "pending");
  const other = all.filter((a) => a.status === "rejected" || a.status === "withdrawn");
  const who = (a: (typeof all)[number]) => `${a.profile?.full_name ?? "?"}${a.profile?.grade ? ` · ${t("grade")} ${a.profile.grade}` : ""}`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <article className="card space-y-2 p-4 text-sm">
        <h2 className="text-lg font-bold">{o.title}</h2>
        <p className="text-xs text-black/50">
          {o.event && <Link href={`/events/${o.event.id}`} className="underline">📅 {o.event.title}</Link>}
          {o.starts_at && ` · ${formatDateTime(o.starts_at)}`}{o.location && ` · ${o.location}`}
          {` · ${t("{a} of {b} spots taken", { a: accepted.length + done.length, b: o.spots ?? "∞" })}`}
        </p>
        {o.description && <p className="whitespace-pre-wrap text-black/75">{o.description}</p>}
        {o.requirements && <p className="text-black/60"><strong>{t("Needed")}:</strong> {o.requirements}</p>}
        <StatusButtons id={o.id} status={o.status} locale={locale} />
      </article>

      <section className="space-y-2">
        <h2 className="section-title">{t("Waiting for an answer")} ({waiting.length})</h2>
        {waiting.length === 0 ? <p className="card p-4 text-sm text-black/55">{t("No new applications.")}</p> : waiting.map((a) => (
          <article key={a.id} className="card space-y-2 p-4 text-sm">
            <p className="font-semibold">{who(a)} <span className="text-xs font-normal text-black/45">· {timeAgo(a.created_at)}</span></p>
            {a.message && <p className="text-black/70">“{a.message}”</p>}
            <ReviewApplication id={a.id} locale={locale} current="" />
          </article>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="section-title">{t("Volunteers")} ({accepted.length})</h2>
        {accepted.length === 0 ? <p className="card p-4 text-sm text-black/55">{t("Nobody accepted yet.")}</p> : accepted.map((a) => (
          <article key={a.id} className="card space-y-2 p-4 text-sm">
            <p className="font-semibold">{who(a)}</p>
            <AssignmentForm id={a.id} locale={locale} current={a.responsibility} />
            <CompleteForm id={a.id} locale={locale} />
            <details><summary className="cursor-pointer text-xs text-black/50">{t("Change my mind")}</summary><div className="mt-2"><ReviewApplication id={a.id} locale={locale} current={a.responsibility} /></div></details>
          </article>
        ))}
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">{t("Done")} ({done.length})</h2>
          <ul className="card divide-y divide-black/5 text-sm">
            {done.map((a) => <li key={a.id} className="flex justify-between px-4 py-2.5"><span>{who(a)}</span><span className="font-semibold text-brand-800">{Number(a.hours)} h</span></li>)}
          </ul>
        </section>
      )}
      {other.length > 0 && (
        <details className="card p-4 text-sm"><summary className="cursor-pointer text-black/55">{t("Declined and withdrawn")} ({other.length})</summary>
          <ul className="mt-2 space-y-1 text-black/60">{other.map((a) => <li key={a.id}>{who(a)} · {a.status === "rejected" ? t("declined") : t("withdrawn")}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

export default function ManageOpportunityPage(props: PageProps<"/volunteering/manage/[id]">) {
  return (
    <>
      <PageHeader title="Manage volunteers" back="/volunteering?tab=organize" />
      <Suspense fallback={<PageSkeleton />}><Manage params={props.params} /></Suspense>
    </>
  );
}
