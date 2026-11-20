import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatShortDate, localDayKey } from "@/lib/time";
import { getT } from "@/lib/i18n-server";
import { deleteHours } from "@/app/actions/volunteering";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { LogHoursForm } from "./log-form";
import { ApplyForm, WithdrawButton } from "./volunteer-forms";
import { Empty } from "@/components/empty";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Volunteering" };

const STATUS: Record<string, string> = { pending: "Waiting", approved: "Approved", rejected: "Not approved" };

async function Hours() {
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
        <Link href="/volunteering/certificate" className="btn-secondary w-full"><Glyph e="📄" /> Get my certificate</Link>
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


const APP_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Waiting", cls: "bg-amber-50 text-amber-800" },
  accepted: { label: "You are in", cls: "bg-brand-50 text-brand-800" },
  completed: { label: "Done", cls: "bg-brand-50 text-brand-800" },
  rejected: { label: "Not this time", cls: "bg-black/5 text-black/55" },
  withdrawn: { label: "Withdrawn", cls: "bg-black/5 text-black/55" },
};

async function Hub({ searchParams }: { searchParams: PageProps<"/volunteering">["searchParams"] }) {
  const me = await requireMe();
  if (!me.isStudent) redirect("/more");
  const { tab: raw } = await searchParams;
  const tab = raw === "mine" || raw === "organize" || raw === "hours" ? raw : "browse";
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: canPublish } = await supabase.rpc("can_publish_volunteering");
  const tabs = [["browse", t("Opportunities")], ["mine", t("My volunteering")], ...(canPublish ? [["organize", t("Organize")]] : []), ["hours", t("My hours")]] as const;

  let body: React.ReactNode = null;
  if (tab === "browse") {
    const { data: opps } = await supabase
      .from("volunteer_opportunities")
      .select("id, title, description, requirements, location, starts_at, spots, status, created_by, event:events(id, title, status)")
      .in("status", ["open"])
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(60);
    const ids = (opps ?? []).map((o) => o.id);
    const { data: mine } = ids.length ? await supabase.from("volunteer_applications").select("id, opportunity_id, status").eq("profile_id", me.id).in("opportunity_id", ids) : { data: [] };
    const visible = (opps ?? []).filter((o) => !o.event || o.event.status === "approved");
    body = visible.length === 0 ? (
      <Empty emoji="💚" title={t("No volunteer opportunities right now")}>{t("Event organizers and club leaders post them here.")}</Empty>
    ) : (
      <div className="space-y-3">
        {visible.map((o) => {
          const app = (mine ?? []).find((a) => a.opportunity_id === o.id && a.status !== "withdrawn");
          return (
            <article key={o.id} className="card space-y-2 p-4 text-sm">
              <h2 className="font-bold">{o.title}</h2>
              <p className="text-xs text-black/50">
                {o.event ? <Link href={`/events/${o.event.id}`} className="text-brand-700 underline"><Glyph e="📅" /> {o.event.title}</Link> : <><Glyph e="💚" /> {t("School volunteering")}</>}
                {o.starts_at && ` · ${formatDateTime(o.starts_at)}`}{o.location && ` · ${o.location}`}{o.spots && ` · ${t("{n} spots", { n: o.spots })}`}
              </p>
              {o.description && <p className="whitespace-pre-wrap text-black/75">{o.description}</p>}
              {o.requirements && <p className="text-black/60"><strong>{t("Needed")}:</strong> {o.requirements}</p>}
              {app ? (
                <div className="flex items-center justify-between"><span className={`chip ${APP_STATUS[app.status].cls}`}>{t(APP_STATUS[app.status].label)}</span>
                  {(app.status === "pending" || app.status === "accepted") && <WithdrawButton id={app.id} locale={locale} />}</div>
              ) : o.created_by === me.id ? (
                <Link href={`/volunteering/manage/${o.id}`} className="btn-secondary w-full">{t("Manage volunteers")}</Link>
              ) : !me.isSuspended ? <ApplyForm id={o.id} locale={locale} /> : null}
            </article>
          );
        })}
      </div>
    );
  } else if (tab === "mine") {
    const { data: apps } = await supabase
      .from("volunteer_applications")
      .select("id, status, responsibility, review_note, hours, created_at, opportunity:volunteer_opportunities(id, title, starts_at, location, event:events(id, title))")
      .eq("profile_id", me.id)
      .order("created_at", { ascending: false });
    body = (apps ?? []).length === 0 ? (
      <Empty emoji="💚" title={t("You have not applied yet")}><Link href="/volunteering" className="text-brand-700 underline">{t("Browse opportunities")}</Link></Empty>
    ) : (
      <ul className="space-y-3">
        {(apps ?? []).map((a) => (
          <li key={a.id} className="card space-y-1.5 p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{a.opportunity?.title}</p>
              <span className={`chip shrink-0 ${APP_STATUS[a.status].cls}`}>{t(APP_STATUS[a.status].label)}</span>
            </div>
            <p className="text-xs text-black/50">
              {a.opportunity?.event && <Link href={`/events/${a.opportunity.event.id}`} className="underline"><Glyph e="📅" /> {a.opportunity.event.title}</Link>}
              {a.opportunity?.starts_at && ` · ${formatDateTime(a.opportunity.starts_at)}`}{a.opportunity?.location && ` · ${a.opportunity.location}`}
            </p>
            {a.responsibility && <p className="rounded-xl bg-brand-50 p-3 text-brand-900"><strong>{t("Your role")}:</strong> {a.responsibility}</p>}
            {a.review_note && <p className="text-black/60">“{a.review_note}”</p>}
            {a.status === "completed" && a.hours && <p className="font-semibold text-brand-800">{t("{n} hours recorded", { n: Number(a.hours) })}</p>}
            {(a.status === "pending" || a.status === "accepted") && <WithdrawButton id={a.id} locale={locale} />}
          </li>
        ))}
      </ul>
    );
  } else if (tab === "organize") {
    const { data: mineOpps } = await supabase
      .from("volunteer_opportunities").select("id, title, status, spots, starts_at, event:events(id, title)")
      .eq("created_by", me.id).order("created_at", { ascending: false }).limit(60);
    const ids = (mineOpps ?? []).map((o) => o.id);
    const { data: counts } = ids.length ? await supabase.from("volunteer_applications").select("opportunity_id, status").in("opportunity_id", ids) : { data: [] };
    body = (
      <div className="space-y-3">
        <Link href="/volunteering/new" className="btn-primary w-full">+ {t("Publish an opportunity")}</Link>
        {(mineOpps ?? []).length === 0 ? <Empty emoji="💚" title={t("You have not published anything yet")} /> : (
          <ul className="space-y-2">
            {(mineOpps ?? []).map((o) => {
              const list = (counts ?? []).filter((c) => c.opportunity_id === o.id);
              const waiting = list.filter((c) => c.status === "pending").length;
              return (
                <li key={o.id}>
                  <Link href={`/volunteering/manage/${o.id}`} className="card flex items-center gap-3 p-4 text-sm hover:bg-black/[0.02]">
                    <div className="min-w-0 flex-1"><p className="font-semibold">{o.title}</p>
                      <p className="text-xs text-black/50">{o.event ? `${o.event.title} · ` : ""}{t("{n} accepted", { n: list.filter((c) => c.status === "accepted" || c.status === "completed").length })}{o.spots ? ` / ${o.spots}` : ""}</p></div>
                    {waiting > 0 && <span className="chip bg-amber-50 text-amber-800">{t("{n} waiting", { n: waiting })}</span>}
                    {o.status !== "open" && <span className="chip bg-black/5 text-black/55">{o.status === "closed" ? t("Closed") : t("Cancelled")}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  } else {
    body = <Hours />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-black/5 p-1" role="tablist">
        {tabs.map(([id, label]) => (
          <Link key={id} role="tab" aria-selected={tab === id} href={id === "browse" ? "/volunteering" : `/volunteering?tab=${id}`} className={`flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap ${tab === id ? "bg-brand-700 text-white shadow-sm" : "text-black/55 hover:bg-sage-soft/60"}`}>{label}</Link>
        ))}
      </div>
      {body}
    </div>
  );
}

export default function VolunteeringPage(props: PageProps<"/volunteering">) {
  return (
    <>
      <PageHeader title="Volunteering" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Hub searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
