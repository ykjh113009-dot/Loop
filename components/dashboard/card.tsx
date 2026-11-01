import Link from "next/link";
import { LineIcon, type LineIconName } from "@/components/line-icon";

// The white rounded box every dashboard block sits in.
export function DashCard({
  title,
  href,
  linkLabel = "View all",
  className = "",
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`card p-4 lg:p-[18px] ${className}`}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight whitespace-nowrap">{title}</h2>
        {href && (
          <Link href={href} className="shrink-0 text-xs font-medium text-brand-700 hover:underline">
            {linkLabel}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

// A quiet message for a card that has nothing to show yet.
export function CardEmpty({ icon, children }: { icon?: LineIconName; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-brand-50/70 px-4 py-6 text-center text-sm text-ink-2">
      {icon && <LineIcon name={icon} className="size-6 text-brand-600" />}
      <p>{children}</p>
    </div>
  );
}

// The round tile that holds a small icon.
export function IconTile({ name, className = "" }: { name: LineIconName; className?: string }) {
  return (
    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-sage-soft/70 text-brand-700 ${className}`}>
      <LineIcon name={name} className="size-5" />
    </span>
  );
}

// Grey placeholder shown while a card loads.
export function CardSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`card animate-pulse p-4 lg:p-[18px] ${className}`} aria-label="Loading">
      <div className="mb-4 h-4 w-32 rounded bg-black/10" />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-black/[0.07]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded bg-black/10" />
              <div className="h-3 w-1/2 rounded bg-black/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
