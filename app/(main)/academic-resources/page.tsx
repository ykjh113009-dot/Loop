import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { AddCategoryForm } from "./forms";

export const metadata = { title: "Academic Resources" };

async function Categories() {
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const [{ data: cats }, { data: res }] = await Promise.all([
    supabase.from("study_categories").select("id, slug, name, emoji, sort").order("sort").order("name"),
    supabase.from("study_resources").select("category_id"),
  ]);
  const count = new Map<string, number>();
  for (const r of res ?? []) count.set(r.category_id, (count.get(r.category_id) ?? 0) + 1);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-sm text-black/60">{t("Study materials, organised by subject. Pick one to see what is available.")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(cats ?? []).map((c) => (
          <Link key={c.id} href={`/academic-resources/${c.slug}`} className="card flex items-center gap-3 p-4 hover:bg-black/[0.02]" data-category={c.slug}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sage-soft/60 text-2xl">{c.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-black/50">{t("{n} resources", { n: count.get(c.id) ?? 0 })}</p>
            </div>
            <span className="text-black/30 rtl:-scale-x-100">›</span>
          </Link>
        ))}
      </div>
      {me.isAdmin && <details className="card p-4"><summary className="cursor-pointer font-semibold">{t("Add a subject")}</summary><div className="mt-3"><AddCategoryForm locale={locale} /></div></details>}
    </div>
  );
}

export default function AcademicResourcesPage() {
  return (
    <>
      <PageHeader title="Academic Resources" />
      <Suspense fallback={<PageSkeleton />}><Categories /></Suspense>
    </>
  );
}
