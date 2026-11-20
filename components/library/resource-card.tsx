import { TypeIcon } from "@/components/library/type-icon";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { StatRow } from "@/components/library/stars";
import { LIBRARY_TYPES, type LibraryResource } from "@/lib/library";
import type { T } from "@/lib/i18n";
import { Glyph } from "@/components/glyph";

export function SourceChip({ source, t }: { source: string; t: T }) {
  return source === "official"
    ? <span className="chip bg-brand-700 text-white" data-source="official"><Glyph e="✓" /> {t("Official")}</span>
    : <span className="chip bg-sage-soft/70 text-brand-900" data-source="community">{t("Community")}</span>;
}

export function ResourceCard({ r, cover, t, extra }: { r: LibraryResource; cover: string | null; t: T; extra?: React.ReactNode }) {
  const type = LIBRARY_TYPES[r.type] ?? LIBRARY_TYPES.other;
  return (
    <div className="card flex gap-3 p-3" data-resource={r.id}>
      <Link href={`/academic-resources/resource/${r.id}`} className="flex h-24 w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sage-soft/50 text-3xl" aria-hidden="true" tabIndex={-1}>
        {cover
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          ? <img src={cover} alt="" className="size-full object-cover" />
          : <TypeIcon type={r.type} className="size-8 text-brand-800/80" />}
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceChip source={r.source} t={t} />
          <span className="text-xs text-black/50">{r.subject?.name} · {t(type.label)}</span>
        </div>
        <Link href={`/academic-resources/resource/${r.id}`} className="line-clamp-2 font-semibold leading-snug hover:underline">{r.title}</Link>
        {r.submitter && (
          <p className="flex items-center gap-1.5 text-xs text-black/55">
            <Avatar avatar={r.submitter.avatar} size="xs" /><span className="truncate">{r.submitter.full_name}</span>
          </p>
        )}
        <StatRow views={r.views_count} downloads={r.downloads_count} rating={r.rating_avg} ratingCount={r.rating_count} reviews={r.review_count} showDownloads={!!r.file_name} />
        {extra}
      </div>
    </div>
  );
}
