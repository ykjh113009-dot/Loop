import { Suspense } from "react";
import { getT } from "@/lib/i18n-server";

// The illustrated page banners (public/banners). The words are part of the picture, so they stay English there;
// the same words are also in the page for screen readers, and Arabic readers get a plain banner in their own language.
const SIZE: Record<string, [number, number]> = {
  dashboard: [1123, 277], clubs: [1123, 279], calendar: [1123, 241], "learning-hub": [1122, 247], profile: [1123, 202], announcements: [1123, 207],
  community: [1125, 279], market: [1125, 283], leaderboards: [1123, 238], events: [1125, 249], chat: [1123, 205], rewards: [1125, 207],
};
export type BannerName = keyof typeof SIZE;

async function Banner({ name, title, subtitle, className = "" }: { name: BannerName; title: string; subtitle: string; className?: string }) {
  const { t, locale } = await getT();
  if (locale === "ar") {
    return (
      <section className={`rounded-3xl border border-brand-700/10 bg-gradient-to-r from-sage-soft/80 via-brand-100/70 to-brand-50 px-6 py-7 ${className}`} data-banner data-image-banner>
        <h1 className="font-heading text-3xl font-semibold text-brand-900" data-banner-title>{t(title)}</h1>
        <p className="mt-1 text-ink-2">{t(subtitle)}</p>
      </section>
    );
  }
  const [w, h] = SIZE[name];
  return (
    <section className={className} data-banner data-image-banner={name}>
      <h1 className="sr-only" data-banner-title>{title}</h1>
      <p className="sr-only">{subtitle}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed, local illustration */}
      <img src={`/banners/${name}.webp`} alt="" width={w} height={h} className="block h-auto w-full select-none" draggable={false} />
    </section>
  );
}

// Reading the language needs the request, so it streams in behind a banner-shaped placeholder.
export function ImageBanner(props: { name: BannerName; title: string; subtitle: string; className?: string }) {
  const [w, h] = SIZE[props.name];
  return (
    <Suspense fallback={<div className={`w-full rounded-3xl bg-sage-soft/40 ${props.className ?? ""}`} style={{ aspectRatio: `${w} / ${h}` }} />}>
      <Banner {...props} />
    </Suspense>
  );
}
