export function Empty({ emoji = "🌱", title, children }: { emoji?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="card px-6 py-10 text-center">
      <div className="text-3xl">{emoji}</div>
      <p className="mt-2 font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-black/55">{children}</div>}
    </div>
  );
}
