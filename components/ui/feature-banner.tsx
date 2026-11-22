import type { LucideIcon } from "lucide-react";

// A slim page header: title, one friendly line, and a big soft icon on the right.
export function FeatureBanner({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon: LucideIcon }) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-[#e9ead6] px-5 py-6 lg:px-8 lg:py-8" data-banner>
      <div className="pointer-events-none absolute -end-10 -top-16 -z-10 size-64 rounded-full bg-[#dbe5cc]" aria-hidden="true" />
      <div className="pointer-events-none absolute end-24 -bottom-24 -z-10 size-56 rounded-full bg-[#d3dfc3]/70" aria-hidden="true" />
      <Icon className="pointer-events-none absolute end-6 top-1/2 size-20 -translate-y-1/2 text-brand-800 lg:end-14 lg:size-28" strokeWidth={1.6} aria-hidden="true" />
      <div className="max-w-[70%]">
        <h1 className="font-heading text-[30px] leading-none font-semibold text-brand-900 lg:text-[44px]" data-banner-title>{title}</h1>
        <p className="mt-2 text-[13px] text-ink-2 lg:mt-3 lg:text-base">{subtitle}</p>
      </div>
    </section>
  );
}
