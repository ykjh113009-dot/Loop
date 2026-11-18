import Link from "next/link";
import { Flame, Star, ArrowRight } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { localParts, localWeekday } from "@/lib/time";
import { LoopDog } from "@/components/mascot";

const MESSAGES = [
  "Keep going, great things are ahead.",
  "A fresh week. Make it count.",
  "Small steps every day add up.",
  "Be kind, stay curious.",
  "Your ideas make this school better.",
  "Almost the weekend. Finish strong.",
  "Rest, recharge, and try something new.",
];

// "Good afternoon, Sarah!" in Palestine time, with your real streak and points and the Loop dog.
export async function Greeting() {
  const me = await requireMe();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const [{ data: pts }, { data: streak }] = me.isStudent ? await Promise.all([supabase.rpc("my_points"), supabase.rpc("my_streak")]) : [{ data: null }, { data: null }];
  const balance = pts ? Number((pts as unknown as { balance: number }).balance) : null;
  const days = streak ? Number((streak as unknown as { current: number }).current) : null;
  const now = new Date();
  const hour = localParts(now).hour;
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-700/10 bg-gradient-to-r from-sage-soft/80 via-brand-100/80 to-brand-50 px-5 py-5 lg:px-7 lg:py-7" data-banner>
      <div className="relative z-10 max-w-[62%] sm:max-w-[58%]">
        <h1 className="font-heading text-[22px] leading-tight font-semibold tracking-tight lg:text-[30px]">
          {t(part)}{locale === "ar" ? "،" : ","} {me.full_name.split(" ")[0]}!
        </h1>
        <p className="mt-1 text-sm text-ink-2 lg:text-base">{t(MESSAGES[localWeekday(now)])}</p>
        {(balance !== null || days !== null) && (
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold" data-home-stats>
            {days !== null && <span className="inline-flex items-center gap-1.5"><Flame className="size-4 text-orange-500" strokeWidth={2} aria-hidden="true" />{t("{n} day streak", { n: days })}</span>}
            {balance !== null && <span className="inline-flex items-center gap-1.5"><Star className="size-4 fill-amber-400 text-amber-500" strokeWidth={1.8} aria-hidden="true" />{t("{n} points", { n: balance.toLocaleString("en") })}</span>}
          </p>
        )}
        <Link href={`/profile/${me.id}`} className="btn-primary mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm">
          {t("View Your Profile")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>
      <div className="pointer-events-none absolute inset-y-0 end-1 flex w-[40%] items-end justify-end lg:end-6 lg:w-[34%]" aria-hidden="true">
        <LoopDog mood="happy" className="mb-[-16px] h-[125%] w-auto max-w-full" />
      </div>
    </section>
  );
}
