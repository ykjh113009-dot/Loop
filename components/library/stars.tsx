import { LineIcon } from "@/components/line-icon";

export function Stars({ value, className = "size-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" role="img" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(value) ? "" : "text-black/20"}>
          <svg viewBox="0 0 24 24" className={className} fill={n <= Math.round(value) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4l2.5 5.2 5.7.8-4.1 4 1 5.7L12 17l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />
          </svg>
        </span>
      ))}
    </span>
  );
}

export function StatRow({ views, downloads, rating, ratingCount, reviews, showDownloads = true }: { views: number; downloads: number; rating: number; ratingCount: number; reviews: number; showDownloads?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-black/55">
      <span className="inline-flex items-center gap-1" title="Views"><LineIcon name="eye" className="size-3.5" /><span data-stat="views">{views}</span></span>
      {showDownloads && <span className="inline-flex items-center gap-1" title="Downloads"><LineIcon name="download" className="size-3.5" /><span data-stat="downloads">{downloads}</span></span>}
      <span className="inline-flex items-center gap-1" title="Rating"><LineIcon name="star" className="size-3.5 text-amber-500" /><span data-stat="rating">{ratingCount > 0 ? Number(rating).toFixed(1) : "–"}</span><span className="text-black/35">({ratingCount})</span></span>
      <span className="inline-flex items-center gap-1" title="Reviews"><LineIcon name="comment" className="size-3.5" /><span data-stat="reviews">{reviews}</span></span>
    </p>
  );
}
