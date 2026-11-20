import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { OPP_CATEGORIES, oppCategory } from "@/lib/opportunities";
import { formatDate, localDayKey } from "@/lib/time";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "University & Opportunities" };

async function List({ searchParams }: { searchParams: PageProps<"/opportunities">["searchParams"] }) {
  await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const sp = await searchParams;
  const category = OPP_CATEGORIES.some((c) => c.id === sp.category) ? String(sp.category) : "";
  const when = sp.when === "all" ? "all" : "open";
  const q = typeof sp.q === "string" ? sp.q.replace(/[,()%*]/g, " ").trim().slice(0, 60) : "";
  const today = localDayKey(new Date());
  const { data: manage } = await supabase.rpc("can_manage_study_opportunities");
  let query = supabase.from("study_opportunities").select("id, category, title, organization, description, eligibility, deadline, is_sample, status").order("deadline", { ascending: true, nullsFirst: false }).limit(100);
  if (category) query = query.eq("category", category);
  if (when === "open") query = query.or(`deadline.is.null,deadline.gte.${today}`);
  if (q) query = query.or(`title.ilike.%${q}%,organization.ilike.%${q}%,description.ilike.%${q}%`);
  const { data } = await query;
  const link = (o: Record<string, string>) => `/opportunities?${new URLSearchParams({ ...(category ? { category } : {}), ...(when === "all" ? { when } : {}), ...(q ? { q } : {}), ...o })}`;
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <form action="/opportunities" className="flex gap-2">
        {category && <input type="hidden" name="category" value={category} />}
        {when === "all" && <input type="hidden" name="when" value="all" />}
        <input name="q" defaultValue={q} className="input" placeholder={t("Search opportunities")} aria-label={t("Search opportunities")} />
        <button className="btn-secondary shrink-0 px-3">{t("Search")}</button>
      </form>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Link href={link({ category: "" })} className={`chip shrink-0 ${!category ? "bg-brand-700 text-white" : ""}`}>{t("All")}</Link>
        {OPP_CATEGORIES.map((c) => (
          <Link key={c.id} href={link({ category: c.id })} className={`chip shrink-0 ${category === c.id ? "bg-brand-700 text-white" : ""}`}><Glyph e={c.emoji} /> {t(c.label)}</Link>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <Link href={link({ when: "open" })} className={`chip ${when === "open" ? "bg-brand-700 text-white" : ""}`}>{t("Open now")}</Link>
          <Link href={link({ when: "all" })} className={`chip ${when === "all" ? "bg-brand-700 text-white" : ""}`}>{t("Include past deadlines")}</Link>
        </div>
        {manage && <Link href="/opportunities/new" className="btn-primary px-3 py-1.5 text-sm">+ {t("Add")}</Link>}
      </div>
      {(data ?? []).length === 0 ? (
        <Empty emoji="🎓" title={t("No opportunities here yet")}>{manage ? t("Add the first one with the Add button.") : t("Admins and the Student Council add them as they find them.")}</Empty>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((o) => {
            const c = oppCategory(o.category);
            const past = !!o.deadline && o.deadline < today;
            return (
              <Link key={o.id} href={`/opportunities/${o.id}`} className="card block space-y-1.5 p-4 hover:bg-black/[0.02]" data-opportunity={o.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-brand-50 text-brand-800"><Glyph e={c.emoji} /> {t(c.label)}</span>
                  {o.is_sample && <span className="chip bg-amber-50 text-amber-800">{t("Sample")}</span>}
                  {o.status === "hidden" && <span className="chip bg-black/5">{t("Hidden")}</span>}
                  <span className={`ms-auto text-xs ${past ? "text-red-700" : "text-black/50"}`}>{o.deadline ? `${past ? t("Closed") : t("Deadline")} ${formatDate(`${o.deadline}T12:00:00Z`)}` : t("No deadline")}</span>
                </div>
                <h2 className="font-bold">{o.title}</h2>
                {o.organization && <p className="text-sm text-black/60">{o.organization}</p>}
                {o.description && <p className="line-clamp-2 text-sm text-black/70">{o.description}</p>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OpportunitiesPage(props: PageProps<"/opportunities">) {
  return (
    <>
      <PageHeader title="University & Opportunities" />
      <Suspense fallback={<PageSkeleton />}><List searchParams={props.searchParams} /></Suspense>
    </>
  );
}
