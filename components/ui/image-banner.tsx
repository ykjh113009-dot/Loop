import { Suspense } from "react";
import { BookOpen, CalendarDays, Gift, Home, Megaphone, MessageCircle, ShoppingCart, Ticket, Trophy, User, Users } from "lucide-react";
import { getT } from "@/lib/i18n-server";

// The page banners: a sharp icon tile, title and subtitle on soft green, like the Academic Library banner.
const ICONS = {
  dashboard: Home, community: Users, clubs: Users, market: ShoppingCart, calendar: CalendarDays, events: Ticket,
  leaderboards: Trophy, "learning-hub": BookOpen, chat: MessageCircle, announcements: Megaphone, rewards: Gift, profile: User,
};
export type BannerName = keyof typeof ICONS;

// Soft leaf-green shapes on the right, so the banner has the same calm look as the Academic Library one. No animals.
export function BannerArt({ name }: { name: BannerName }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 end-0 -z-10 hidden w-[42%] sm:block" aria-hidden="true" data-banner-art={name}>
      <span className="absolute -end-10 -top-16 size-64 rounded-full bg-[#d3dfc3]/70" />
      <span className="absolute end-24 -bottom-24 size-56 rounded-full bg-[#dbe7d2]/80" />
      <span className="absolute end-10 bottom-6 size-24 rounded-full bg-[#c7d8b8]/60" />
    </div>
  );
}

async function Banner({ name, title, subtitle, className = "", children }: { name: BannerName; title: string; subtitle: string; className?: string; children?: React.ReactNode }) {
  const { t } = await getT();
  const Icon = ICONS[name];
  return (
    <section className={`relative isolate overflow-hidden rounded-3xl bg-[#e8efe6] px-5 py-6 lg:px-8 lg:py-8 ${className}`} data-banner data-image-banner={name}>
      <BannerArt name={name} />
      <div className="flex items-center gap-4 lg:gap-6">
        <span className="hidden size-20 shrink-0 items-center justify-center rounded-3xl bg-[#d3dfc3] text-brand-800 sm:flex lg:size-24" aria-hidden="true"><Icon className="size-10 lg:size-12" strokeWidth={1.5} /></span>
        <div>
          <h1 className="font-heading text-[34px] leading-none font-semibold text-brand-900 lg:text-[48px]" data-banner-title>{t(title)}</h1>
          <p className="mt-2 max-w-md text-[13px] text-ink-2 lg:mt-3 lg:text-base">{t(subtitle)}</p>
          {children}
        </div>
      </div>
    </section>
  );
}

// Reading the language needs the request, so the words stream in behind a banner-shaped placeholder.
export function ImageBanner(props: { name: BannerName; title: string; subtitle: string; className?: string; children?: React.ReactNode }) {
  return (
    <Suspense fallback={<div className={`h-[116px] rounded-3xl bg-[#e8efe6] lg:h-[152px] ${props.className ?? ""}`} />}>
      <Banner {...props} />
    </Suspense>
  );
}
