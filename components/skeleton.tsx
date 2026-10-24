// Grey placeholder shown while a page loads on slow internet.
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-label="Loading">
      <div className="h-6 w-40 rounded-lg bg-black/10" />
      <div className="card h-24" />
      <div className="card h-24" />
      <div className="card h-24" />
    </div>
  );
}
