import { requireMe } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { localParts } from "@/lib/time";

// The welcome banner at the top of Home. The picture carries the words; the personal greeting stays in the page for screen readers.
export async function HomeHero() {
  const me = await requireMe();
  const { t, locale } = await getT();
  const hour = localParts(new Date()).hour;
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = me.full_name.split(" ")[0];
  return (
    <section className="overflow-hidden" data-banner data-home-hero>
      <h1 className="sr-only" data-banner-title>{t(part)}{locale === "ar" ? "،" : ","} {first}! {t("Keep learning, keep growing")}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed, local illustration */}
      <img src="/banners/dashboard.webp" alt="" width={1123} height={277} className="block h-auto w-full select-none" data-home-art fetchPriority="high" draggable={false} />
    </section>
  );
}
