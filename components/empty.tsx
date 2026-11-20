import { Glyph } from "@/components/glyph";

export function Empty({ emoji = "🌱", title, children }: { emoji?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="card px-6 py-10 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-sage-soft text-2xl text-brand-800" aria-hidden="true"><Glyph e={emoji} strokeWidth={1.5} /></span>
      <p className="mt-3 font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-black/55">{children}</div>}
    </div>
  );
}
