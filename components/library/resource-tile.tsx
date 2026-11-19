import Link from "next/link";
import { Star, Eye, Download } from "lucide-react";
import { LIBRARY_TYPES, type LibraryResource } from "@/lib/library";
import { SaveBookmark } from "@/components/library/save-bookmark";
import type { T } from "@/lib/i18n";

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));

// One resource as a tile: cover, title, who shared it, and how well it is liked.
export function ResourceTile({ r, cover, saved, t }: { r: LibraryResource; cover: string | null; saved: boolean; t: T }) {
  const type = LIBRARY_TYPES[r.type] ?? LIBRARY_TYPES.other;
  const by = r.source === "official" ? (r.author || "Loop") : (r.submitter?.full_name ?? r.author ?? "Loop");
  return (
    <article className="relative flex flex-col gap-2 rounded-3xl border border-brand-700/10 bg-white/85 p-3.5 shadow-[0_1px_2px_rgba(40,60,40,0.04)]" data-resource={r.id}>
      <Link href={`/academic-resources/resource/${r.id}`} className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-sage-soft to-[#dbe5cc] text-4xl after:absolute after:inset-0 after:rounded-3xl" aria-label={r.title}>
        {cover
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          ? <img src={cover} alt="" className="size-full object-cover" />
          : <span aria-hidden="true">{type.emoji}</span>}
      </Link>
      <div className="absolute end-2.5 top-2.5"><SaveBookmark id={r.id} saved={saved} label={t("Save to My Library")} savedLabel={t("Saved to My Library")} /></div>
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-[16px] leading-snug font-semibold">{r.title}</h3>
        <p className="mt-0.5 truncate text-[13px] text-ink-2">
          {t("By")} {by}
          {r.source === "official" ? <span className="ms-1.5 rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-semibold text-white" data-source="official">✓ {t("Official")}</span> : <span className="ms-1.5 rounded-full bg-sage-soft/70 px-1.5 py-0.5 text-[10px] font-semibold text-brand-900" data-source="community">{t("Community")}</span>}
        </p>
        <p className="truncate text-[12px] text-ink-2">{r.subject?.name} · {t(type.label)}</p>
      </div>
      <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
        <span className="inline-flex items-center gap-1 font-medium text-ink" title={t("Rating")}><Star className="size-4 fill-amber-400 text-amber-500" aria-hidden="true" /><span data-stat="rating">{r.rating_count > 0 ? Number(r.rating_avg).toFixed(1) : "–"}</span></span>
        <span className="inline-flex items-center gap-1" title={t("Views")}><Eye className="size-4" aria-hidden="true" /><span data-stat="views">{k(r.views_count)}</span></span>
        {!!r.file_name && <span className="inline-flex items-center gap-1" title={t("Downloads")}><Download className="size-4" aria-hidden="true" /><span data-stat="downloads">{k(r.downloads_count)}</span></span>}
      </p>
    </article>
  );
}
