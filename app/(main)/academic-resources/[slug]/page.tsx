import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { timeAgo } from "@/lib/time";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { AddResourceForm, RemoveResource } from "../forms";

const KIND: Record<string, string> = { link: "🔗", pdf: "📄", video: "🎬", notes: "📝", practice: "✏️", other: "📎" };

async function Category({ params }: { params: PageProps<"/academic-resources/[slug]">["params"] }) {
  const { slug } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: cat } = await supabase.from("study_categories").select("id, name, emoji").eq("slug", slug).maybeSingle();
  if (!cat) notFound();
  const [{ data: items }, { data: canAdd }, { data: staff }] = await Promise.all([
    supabase.from("study_resources").select("id, title, description, url, kind, created_at, added_by, author:profiles!study_resources_added_by_fkey(full_name)").eq("category_id", cat.id).order("created_at", { ascending: false }),
    supabase.rpc("can_add_resources"),
    supabase.rpc("can_manage_study_opportunities"),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-xl bg-sage-soft/60 text-3xl">{cat.emoji}</span><h2 className="text-xl font-bold">{cat.name}</h2></div>
      {(items ?? []).length === 0 ? (
        <Empty emoji={cat.emoji} title={t("No resources here yet")}>{canAdd ? t("Be the first to add one below.") : t("Approved tutors and staff add study materials here.")}</Empty>
      ) : (
        <ul className="space-y-2">
          {(items ?? []).map((r) => (
            <li key={r.id} className="card flex items-start gap-3 p-4">
              <span className="text-2xl">{KIND[r.kind]}</span>
              <div className="min-w-0 flex-1">
                <a href={r.url} target="_blank" rel="noreferrer noopener" className="font-semibold text-brand-800 hover:underline">{r.title}</a>
                {r.description && <p className="text-sm text-black/65">{r.description}</p>}
                <p className="mt-0.5 truncate text-xs text-black/40">{new URL(r.url).hostname} · {r.author?.full_name ?? ""} · {timeAgo(r.created_at)}</p>
              </div>
              {(r.added_by === me.id || me.isAdmin || staff) && <RemoveResource id={r.id} label={t("Remove")} />}
            </li>
          ))}
        </ul>
      )}
      {canAdd && <section className="card space-y-2 p-4"><h3 className="font-semibold">{t("Add a resource")}</h3><AddResourceForm categoryId={cat.id} locale={locale} /></section>}
    </div>
  );
}

export default function CategoryPage(props: PageProps<"/academic-resources/[slug]">) {
  return (
    <>
      <PageHeader title="Academic Resources" back="/academic-resources" />
      <Suspense fallback={<PageSkeleton />}><Category params={props.params} /></Suspense>
    </>
  );
}
