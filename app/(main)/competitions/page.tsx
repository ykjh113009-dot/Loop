import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { formatDate } from "@/lib/time";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Competitions" };

async function Competitions() {
  await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const { data } = await supabase.from("competitions").select("id, name, description, kind, starts_at, ends_at").order("ends_at", { ascending: false }).limit(50);
  const now = new Date().toISOString();
  const open = (data ?? []).filter((c) => c.ends_at >= now);
  const past = (data ?? []).filter((c) => c.ends_at < now);
  const card = (c: NonNullable<typeof data>[number]) => (
    <Link key={c.id} href={`/competitions/${c.id}`} className="card block p-4 hover:bg-black/[0.02]">
      <p className="flex items-center gap-2 font-semibold">🏁 {c.name}<span className="chip bg-brand-50 text-brand-800">{c.kind === "house" ? t("Houses") : t("Teams")}</span></p>
      {c.description && <p className="mt-1 line-clamp-2 text-sm text-black/60">{c.description}</p>}
      <p className="mt-1 text-xs text-black/45">{formatDate(c.starts_at)} → {formatDate(c.ends_at)}</p>
    </Link>
  );
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {open.length === 0 && past.length === 0 && <Empty emoji="🏁" title={t("No competitions yet")}>{t("Admins and school staff create competitions for houses and teams.")}</Empty>}
      {open.length > 0 && <section className="space-y-2"><h2 className="section-title">{t("Open now")}</h2>{open.map(card)}</section>}
      {past.length > 0 && <section className="space-y-2"><h2 className="section-title">{t("Finished")}</h2>{past.map(card)}</section>}
    </div>
  );
}

export default function CompetitionsPage() {
  return (
    <>
      <PageHeader title="Competitions" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Competitions />
      </Suspense>
    </>
  );
}
