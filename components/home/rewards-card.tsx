import Link from "next/link";
import { Gift } from "lucide-react";
import { getT } from "@/lib/i18n-server";
import { GiftScene } from "@/components/art/scenes";

export async function RewardsCard() {
  const { t } = await getT();
  return (
    <section className="flex flex-col rounded-2xl border border-brand-700/10 bg-white/80 p-4 lg:p-5" data-card="rewards">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold"><Gift className="size-5 text-brand-700" strokeWidth={1.8} aria-hidden="true" />{t("Rewards Shop")}</h2>
        <Link href="/shop" className="text-xs font-medium text-brand-700 hover:underline">{t("See all")} →</Link>
      </header>
      <div className="relative flex flex-1 items-center gap-3 overflow-hidden rounded-xl bg-sage-soft/60 p-3">
        <GiftScene className="h-20 w-auto shrink-0" />
        <div className="min-w-0">
          <p className="text-[15px] leading-tight font-semibold">{t("Redeem your Loop Points!")}</p>
          <Link href="/shop" className="btn-primary mt-2 inline-flex px-4 py-1.5 text-sm">{t("Go to Shop")} →</Link>
        </div>
      </div>
    </section>
  );
}
