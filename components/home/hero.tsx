import { Home } from "lucide-react";
import { BannerArt } from "@/components/ui/image-banner";
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
    <section className="relative isolate overflow-hidden rounded-3xl bg-[#e8efe6] px-5 py-6 lg:px-8 lg:py-8" data-banner data-home-hero>
      <BannerArt name="dashboard" />
      <div className="flex items-center gap-4 lg:gap-6">
        <span className="hidden size-20 shrink-0 items-center justify-center rounded-3xl bg-[#d3dfc3] text-brand-800 sm:flex lg:size-24" aria-hidden="true"><Home className="size-10 lg:size-12" strokeWidth={1.5} /></span>
        <div>
          <h1 className="font-heading text-[30px] leading-tight font-semibold text-brand-900 lg:text-[44px]" data-banner-title>{t(part)}{locale === "ar" ? "،" : ","} {first}!</h1>
          <p className="mt-2 max-w-md text-[13px] text-ink-2 lg:mt-3 lg:text-base">{t("Keep learning, keep growing")}</p>
        </div>
      </div>
    </section>
  );
}
