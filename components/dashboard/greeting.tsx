import { requireMe } from "@/lib/auth";
import { localParts, localWeekday } from "@/lib/time";
import { LineIcon } from "@/components/line-icon";
import { Sprig } from "@/components/botanical";

const MESSAGES = [
  "Keep going, great things are ahead.",
  "A fresh week. Make it count.",
  "Small steps every day add up.",
  "Be kind, stay curious.",
  "Your ideas make this school better.",
  "Almost the weekend. Finish strong.",
  "Rest, recharge, and try something new.",
];

// "Good afternoon, Yousef!" in Palestine time, with a short encouraging line.
export async function Greeting() {
  const me = await requireMe();
  const now = new Date();
  const hour = localParts(now).hour;
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-700/10 bg-gradient-to-r from-sage-soft/80 via-brand-100/80 to-brand-50 px-5 py-5 lg:px-6 lg:py-7">
      <div className="relative z-10 flex items-center gap-3.5 pr-20 lg:pr-0">
        <LineIcon name={hour < 18 ? "sun" : "moon"} className="size-7 shrink-0 text-amber-500" strokeWidth={1.8} />
        <div>
          <h1 className="font-heading text-[22px] leading-tight font-semibold tracking-tight lg:text-[28px]">
            Good {part}, {me.full_name.split(" ")[0]}!
          </h1>
          <p className="mt-1 text-sm text-ink-2">{MESSAGES[localWeekday(now)]}</p>
        </div>
      </div>
      <Sprig className="pointer-events-none absolute -right-3 -bottom-3 h-[100px] w-auto opacity-90 lg:right-6 lg:-bottom-6 lg:h-[170px]" />
    </section>
  );
}
