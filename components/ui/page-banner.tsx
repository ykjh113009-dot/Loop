import { Scene, type SceneName } from "@/components/art/scenes";
import { LoopDog, type DogMood } from "@/components/mascot";

// The big friendly header of a category page: what this place is, and what you can do here.
export function PageBanner({
  title, subtitle, note, scene, dog, children,
}: { title: string; subtitle: string; note?: string; scene?: SceneName; dog?: DogMood; children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-700/10 bg-gradient-to-r from-sage-soft/80 via-brand-100/70 to-brand-50 px-5 py-6 lg:px-7 lg:py-8" data-banner>
      <div className="relative z-10 max-w-[62%] space-y-1.5 sm:max-w-[55%]">
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight lg:text-[30px]" data-banner-title>{title}</h1>
        <p className="text-sm font-medium text-ink lg:text-base">{subtitle}</p>
        {note && <p className="text-xs text-ink-2 lg:text-sm">{note}</p>}
        {children && <div className="flex flex-wrap gap-2 pt-2">{children}</div>}
      </div>
      <div className="pointer-events-none absolute inset-y-0 end-0 flex w-[46%] items-end justify-end pe-2 sm:w-[44%] lg:pe-6" aria-hidden="true">
        {scene && <Scene name={scene} className="h-auto max-h-full w-full max-w-[380px] translate-y-1" />}
        {dog && <LoopDog mood={dog} className="mb-[-14px] h-[130%] w-auto max-w-full lg:h-[135%]" />}
      </div>
    </section>
  );
}
