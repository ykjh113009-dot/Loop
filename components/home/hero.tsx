import { requireMe } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { localParts } from "@/lib/time";

export async function HomeHero() {
  const me = await requireMe();
  const { t, locale } = await getT();
  const hour = localParts(new Date()).hour;
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = me.full_name.split(" ")[0];
  return (
    <section className="relative isolate h-[210px] overflow-hidden rounded-3xl bg-gradient-to-b from-sage-soft/55 to-cream lg:h-[250px]" data-banner data-home-hero>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand artwork */}
      <img src="/brand/home-hero.png" alt="" width={635} height={256} className="pointer-events-none absolute end-0 bottom-0 -z-10 h-full w-auto max-w-[80%] object-contain object-right-bottom rtl:-scale-x-100" data-home-art />
      <div className="relative z-10 px-5 pt-5 lg:px-8 lg:pt-8">
        <h1 className="font-heading text-[26px] leading-[1.1] font-semibold tracking-tight text-brand-900 lg:text-[40px]" data-banner-title>
          {t(part)}{locale === "ar" ? "،" : ","}<br />{first}! <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-2 inline-block border-b-2 border-brand-700/25 pb-0.5 text-[13px] text-ink-2 lg:mt-3 lg:text-[15px]">{t("Welcome back to Loop. Let's make today count!")}</p>
      </div>
    </section>
  );
}
