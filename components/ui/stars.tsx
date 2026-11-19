import { Star } from "lucide-react";

// Five stars, filled up to the rating.
export function Stars({ value, className = "size-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${className} ${i <= Math.round(value) ? "fill-amber-400 text-amber-500" : "text-black/20"}`} strokeWidth={1.6} aria-hidden="true" />
      ))}
    </span>
  );
}
