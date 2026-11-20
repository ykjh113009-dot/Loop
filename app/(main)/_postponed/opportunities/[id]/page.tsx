import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { oppCategory } from "@/lib/opportunities";
import { formatDate } from "@/lib/time";
import { deleteStudyOpportunity } from "@/app/actions/study";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Opportunity" };

async function Detail({ params }: { params: PageProps<"/opportunities/[id]">["params"] }) {
  const { id } = await params;
  await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const [{ data: o }, { data: manage }] = await Promise.all([
    supabase.from("study_opportunities").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("can_manage_study_opportunities"),
  ]);
  if (!o) notFound();
  const c = oppCategory(o.category);
  const docs = (Array.isArray(o.documents) ? o.documents : []) as { label: string; url: string }[];
  const block = (title: string, body: string) => body && <section><h3 className="section-title">{title}</h3><p className="text-sm whitespace-pre-wrap text-black/75">{body}</p></section>;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <article className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip bg-brand-50 text-brand-800"><Glyph e={c.emoji} /> {t(c.label)}</span>
          {o.is_sample && <span className="chip bg-amber-50 text-amber-800">{t("Sample data")}</span>}
        </div>
        <div><h2 className="text-xl font-bold">{o.title}</h2>{o.organization && <p className="text-black/60">{o.organization}</p>}</div>
        <p className="text-sm"><strong>{t("Deadline")}:</strong> {o.deadline ? formatDate(`${o.deadline}T12:00:00Z`) : t("No deadline")}</p>
        {block(t("About"), o.description)}
        {block(t("Who can apply"), o.eligibility)}
        {block(t("How to apply"), o.instructions)}
        {block(t("More information"), o.extra_info)}
        {docs.length > 0 && <section><h3 className="section-title">{t("Documents")}</h3><ul className="space-y-1 text-sm">{docs.map((d) => <li key={d.url}><a href={d.url} target="_blank" rel="noreferrer noopener" className="text-brand-700 underline"><Glyph e="📎" /> {d.label}</a></li>)}</ul></section>}
        {o.link && <a href={o.link} target="_blank" rel="noreferrer noopener" className="btn-primary w-full">{t("Open the application page")}</a>}
      </article>
      {manage && (
        <div className="flex gap-2">
          <Link href={`/opportunities/${o.id}/edit`} className="btn-secondary flex-1">{t("Edit")}</Link>
          <form action={deleteStudyOpportunity} className="flex-1"><input type="hidden" name="id" value={o.id} /><SubmitButton className="btn-danger w-full" pendingText="…">{t("Delete")}</SubmitButton></form>
        </div>
      )}
    </div>
  );
}

export default function OpportunityPage(props: PageProps<"/opportunities/[id]">) {
  return (
    <>
      <PageHeader title="Opportunity" back="/opportunities" />
      <Suspense fallback={<PageSkeleton />}><Detail params={props.params} /></Suspense>
    </>
  );
}
