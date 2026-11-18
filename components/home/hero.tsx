import { requireMe } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { localParts } from "@/lib/time";
import { LoopDog } from "@/components/mascot";

// A soft campus drawing behind the greeting: hills, trees and the school.
function Campus() {
  return (
    <svg viewBox="0 0 520 200" className="h-full w-full" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      <path d="M0 150 C80 110 160 140 240 120 S400 90 520 130 V200 H0Z" fill="#dfe8d2" opacity=".75" />
      <path d="M0 175 C100 150 200 170 300 155 S450 145 520 165 V200 H0Z" fill="#cfdcc0" opacity=".8" />
      <g transform="translate(330 70)">
        <rect x="0" y="40" width="130" height="62" rx="3" fill="#f6f1e3" stroke="#b9c7a8" />
        <rect x="45" y="22" width="40" height="80" fill="#efe8d4" stroke="#b9c7a8" />
        <path d="M40 24 L65 6 L90 24Z" fill="#8aa37a" />
        <g fill="#cbd9d6" stroke="#9db3ad" strokeWidth="1">
          {[8, 24, 98, 112].map((x) => <rect key={x} x={x} y="52" width="10" height="14" rx="1" />)}
          {[8, 24, 98, 112].map((x) => <rect key={"b" + x} x={x} y="76" width="10" height="14" rx="1" />)}
          <rect x="58" y="76" width="14" height="26" rx="2" fill="#8aa37a" stroke="#6f8a62" />
        </g>
        <line x1="65" y1="6" x2="65" y2="-14" stroke="#6f8a62" strokeWidth="2" />
        <path d="M65 -14 h14 l-4 5 4 5 h-14Z" fill="#8aa37a" />
      </g>
      {[[300, 120, 1], [480, 128, 0.85], [505, 132, 0.7]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-2" y="18" width="4" height="22" fill="#9c8466" />
          <circle cx="0" cy="8" r="17" fill="#9dba8c" />
          <circle cx="-9" cy="16" r="11" fill="#8aab7b" />
        </g>
      ))}
    </svg>
  );
}

export async function HomeHero() {
  const me = await requireMe();
  const { t, locale } = await getT();
  const hour = localParts(new Date()).hour;
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = me.full_name.split(" ")[0];
  return (
    <section className="relative isolate h-[210px] overflow-hidden rounded-3xl bg-gradient-to-b from-sage-soft/55 to-cream lg:h-[250px]" data-banner data-home-hero>
      <div className="pointer-events-none absolute inset-y-0 end-0 -z-10 w-[75%] opacity-90 lg:w-[60%]"><Campus /></div>
      <div className="relative z-10 px-5 pt-5 lg:px-8 lg:pt-8">
        <h1 className="font-heading text-[26px] leading-[1.1] font-semibold tracking-tight text-brand-900 lg:text-[40px]" data-banner-title>
          {t(part)}{locale === "ar" ? "،" : ","}<br />{first}! <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-2 inline-block border-b-2 border-brand-700/25 pb-0.5 text-[13px] text-ink-2 lg:mt-3 lg:text-[15px]">{t("Welcome back to Loop. Let's make today count!")}</p>
      </div>
      <div className="pointer-events-none absolute start-1/2 bottom-0 -translate-x-1/2 rtl:translate-x-1/2" aria-hidden="true">
        <div className="h-[130px] w-[165px] overflow-hidden lg:h-[200px] lg:w-[260px]"><LoopDog mood="happy" className="w-full" /></div>
      </div>
    </section>
  );
}
