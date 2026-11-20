import { TypeIcon } from "@/components/library/type-icon";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { formatDate, formatDateTime } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { Avatar } from "@/components/avatar";
import { Stars, StatRow } from "@/components/library/stars";
import { SourceChip } from "@/components/library/resource-card";
import { ViewTracker } from "@/components/library/view-tracker";
import { LIBRARY_TYPES, RESOURCE_COLUMNS, STATUS_LABEL, signCovers, type LibraryResource } from "@/lib/library";
import { DeleteButton, FlagForm, RateForm, ResolveFlagForm, RestoreButton, SaveButton } from "./forms";
import { Glyph } from "@/components/glyph";

type Rating = { stars: number; review: string | null; updated_at: string; profile_id: string; author: { full_name: string; avatar: string } | null };

async function Resource({ params }: { params: PageProps<"/academic-resources/resource/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data } = await supabase.from("library_resources").select(RESOURCE_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as unknown as LibraryResource;
  const [{ data: canReview }, { data: ratingsData }, { data: saved }, { data: latest }] = await Promise.all([
    supabase.rpc("can_review_library"),
    supabase.from("library_ratings").select("stars, review, updated_at, profile_id, author:profiles!library_ratings_profile_id_fkey(full_name, avatar)").eq("resource_id", id).order("updated_at", { ascending: false }).limit(100),
    supabase.from("library_saves").select("resource_id").eq("resource_id", id).maybeSingle(),
    supabase.from("library_revisions").select("id, status, review_note, number").eq("resource_id", id).order("number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const ratings = (ratingsData ?? []) as unknown as Rating[];
  const mine = ratings.find((x) => x.profile_id === me.id) ?? null;
  const isOwner = r.submitter_id === me.id;
  const isPublic = !!r.published_at && r.visibility === "visible" && !r.deleted_at;
  const canEdit = r.source === "official" ? me.isAdmin : isOwner;
  const covers = await signCovers(supabase, [r.cover_path]);
  const cover = r.cover_path ? covers.get(r.cover_path) : null;
  const type = LIBRARY_TYPES[r.type] ?? LIBRARY_TYPES.other;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: ratings.filter((x) => x.stars === n).length }));
  const isPdfOrImage = r.file_mime === "application/pdf" || r.file_mime?.startsWith("image/");

  let flags: { id: string; reason: string; status: string; created_at: string }[] = [];
  let actions: { id: number; action: string; note: string; created_at: string }[] = [];
  if (canReview) {
    const [f, a] = await Promise.all([
      supabase.from("library_flags").select("id, reason, status, created_at").eq("resource_id", id).order("created_at", { ascending: false }),
      supabase.from("library_actions").select("id, action, note, created_at").eq("resource_id", id).order("created_at", { ascending: false }).limit(20),
    ]);
    flags = f.data ?? [];
    actions = a.data ?? [];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {isPublic && !isOwner && <ViewTracker id={r.id} />}
      {isOwner && latest && latest.status !== "approved" && (
        <p className={`rounded-xl p-3 text-sm ${latest.status === "rejected" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`} data-status={latest.status}>
          <strong>{t(STATUS_LABEL[latest.status])}</strong>
          {latest.status === "pending" && ` — ${isPublic ? t("Your update is waiting for review. The current version stays visible until it is approved.") : t("A reviewer will look at it soon. Only you and the reviewers can see it for now.")}`}
          {latest.status === "rejected" && latest.review_note && ` — ${latest.review_note}`}
        </p>
      )}
      {r.visibility !== "visible" && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{t("This resource is hidden from students.")}</p>}

      <div className="card flex gap-4 p-4">
        <div className="flex h-36 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sage-soft/50 ">
          {cover
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            ? <img src={cover} alt="" className="size-full object-cover" />
            : <TypeIcon type={r.type} className="size-12 text-brand-800/80" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <SourceChip source={r.source} t={t} />
            <Link href={`/academic-resources/${r.subject?.slug}`} className="chip bg-black/5">{r.subject?.name}</Link>
            <span className="chip bg-black/5">{t(type.label)}</span>
          </div>
          <h2 className="text-xl font-bold leading-snug" data-resource-title>{r.title}</h2>
          {r.author && <p className="text-sm text-black/60">{t("By {a}", { a: r.author })}</p>}
          {r.submitter && (
            <p className="flex items-center gap-2 text-sm text-black/60">
              <Avatar avatar={r.submitter.avatar} size="sm" />
              <span>{r.source === "official" ? t("Added by {n}", { n: r.submitter.full_name }) : t("Shared by {n}", { n: r.submitter.full_name })}</span>
              {r.published_at && <span className="text-black/40">· {formatDate(r.published_at)}</span>}
            </p>
          )}
          <StatRow views={r.views_count} downloads={r.downloads_count} rating={r.rating_avg} ratingCount={r.rating_count} reviews={r.review_count} showDownloads={!!r.file_name} />
        </div>
      </div>

      {r.description && <p className="whitespace-pre-wrap text-sm leading-relaxed text-black/75">{r.description}</p>}

      <div className="flex flex-wrap items-start gap-2">
        {r.file_name && isPdfOrImage && <Link href={`/academic-resources/resource/${r.id}/read`} className="btn-primary" data-read><Glyph e="📖" /> {t("Read in Loop")}</Link>}
        {r.file_name && r.downloadable && <a href={`/api/library/${r.id}/file?kind=download`} className="btn-secondary" data-download><Glyph e="⬇" /> {t("Download")}</a>}
        {r.link_url && <a href={r.link_url} target="_blank" rel="noopener noreferrer nofollow" className="btn-primary" data-open-link><Glyph e="↗" /> {t("Open Resource")}</a>}
        {isPublic && <SaveButton id={r.id} saved={!!saved} locale={locale} />}
        {canEdit && <Link href={`/academic-resources/resource/${r.id}/edit`} className="btn-ghost text-sm" data-edit><Glyph e="✏️" /> {t("Edit")}</Link>}
        {canEdit && <DeleteButton id={r.id} locale={locale} warn={t("Delete this resource? It will disappear from the library.")} />}
      </div>
      {r.link_url && <p className="text-xs text-black/45">{t("This opens on another website. Loop is not responsible for what is there.")}</p>}

      {isPublic && (
        <section className="space-y-4" data-section="ratings">
          <h2 className="section-title">{t("Ratings and reviews")}</h2>
          <div className="card flex items-center gap-5 p-4">
            <div className="text-center">
              <p className="text-3xl font-bold" data-avg>{r.rating_count ? Number(r.rating_avg).toFixed(1) : "–"}</p>
              <Stars value={r.rating_avg} />
              <p className="mt-1 text-xs text-black/50">{t("{n} ratings", { n: r.rating_count })}</p>
            </div>
            <ul className="min-w-0 flex-1 space-y-1" aria-label={t("Rating distribution")}>
              {dist.map((d) => (
                <li key={d.n} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-black/50">{d.n}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/5"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${ratings.length ? (d.c / ratings.length) * 100 : 0}%` }} /></span>
                  <span className="w-5 text-end text-black/45">{d.c}</span>
                </li>
              ))}
            </ul>
          </div>
          {isOwner ? <p className="text-sm text-black/50">{t("You cannot rate your own resource.")}</p> : (
            <div className="card space-y-2 p-4"><h3 className="font-semibold">{mine ? t("Your rating") : t("Rate this resource")}</h3><RateForm id={r.id} mine={mine} locale={locale} /></div>
          )}
          <ul className="space-y-3">
            {ratings.filter((x) => x.review).map((x) => (
              <li key={x.profile_id} className="card space-y-1 p-4" data-review>
                <div className="flex items-center gap-2">
                  {x.author && <Avatar avatar={x.author.avatar} size="sm" />}
                  <span className="text-sm font-semibold">{x.author?.full_name}</span>
                  <Stars value={x.stars} className="size-3.5" />
                  <span className="ms-auto text-xs text-black/40">{formatDate(x.updated_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-black/75">{x.review}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canReview && (
        <section className="card space-y-4 border-amber-200 p-4" data-section="reviewer">
          <h2 className="section-title"><Glyph e="🛡️" /> {t("Reviewer tools (internal)")}</h2>
          {r.visibility === "hidden" && <RestoreButton id={r.id} locale={locale} />}
          {r.deleted_at == null && <FlagForm id={r.id} locale={locale} />}
          {flags.length > 0 && (
            <ul className="space-y-3">
              {flags.map((f) => (
                <li key={f.id} className="space-y-2 rounded-xl bg-black/[0.03] p-3 text-sm">
                  <p><strong>{f.status === "open" ? t("Open flag") : t(f.status)}</strong> · {formatDateTime(f.created_at)}</p>
                  <p className="text-black/70">{f.reason}</p>
                  {f.status === "open" && <ResolveFlagForm id={f.id} locale={locale} />}
                </li>
              ))}
            </ul>
          )}
          {actions.length > 0 && (
            <details><summary className="cursor-pointer text-sm font-semibold">{t("Action record")}</summary>
              <ul className="mt-2 space-y-1 text-xs text-black/60">{actions.map((a) => <li key={a.id}>{formatDateTime(a.created_at)} · {a.action}{a.note ? ` — ${a.note}` : ""}</li>)}</ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

export default function ResourcePage(props: PageProps<"/academic-resources/resource/[id]">) {
  return (
    <>
      <PageHeader title="Resource" back="/academic-resources" />
      <Suspense fallback={<PageSkeleton />}><Resource params={props.params} /></Suspense>
    </>
  );
}
