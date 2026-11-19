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
    <section className="overflow-hidden rounded-3xl" data-banner data-home-hero>
      <h1 className="sr-only" data-banner-title>{t(part)}{locale === "ar" ? "،" : ","} {first}! {t("Keep learning, keep growing")}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand artwork */}
      <img src="/brand/home-banner.webp" alt="" width={2000} height={750} className="block h-auto w-full" data-home-art fetchPriority="high" />
    </section>
  );
}
