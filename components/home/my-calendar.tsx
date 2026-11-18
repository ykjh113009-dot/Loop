import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { getUpcomingEvents } from "@/lib/dashboard";
import { localDayKey, formatDate } from "@/lib/time";

const DOTS = ["bg-brand-700", "bg-sky-500", "bg-violet-400"];

export async function MyCalendar() {
  await requireMe();
  const { t } = await getT();
  const events = (await getUpcomingEvents()).slice(0, 3);
  const now = new Date();
  const today = localDayKey(now);
  const tomorrow = localDayKey(new Date(now.getTime() + 86400000));
  const label = (iso: string) => { const k = localDayKey(iso); return k === today ? t("Today") : k === tomorrow ? t("Tomorrow") : formatDate(iso); };
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hebron", hour: "numeric", minute: "2-digit", hour12: true });
  return (
    <section className="rounded-2xl border border-brand-700/10 bg-white/80 p-4 lg:p-5" data-card="calendar">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold"><CalendarDays className="size-5 text-brand-700" strokeWidth={1.8} aria-hidden="true" />{t("My Calendar")}</h2>
        <Link href="/events" className="text-xs font-medium text-brand-700 hover:underline">{t("See all")} →</Link>
      </header>
      {events.length === 0 ? (
        <p className="rounded-xl bg-sage-soft/40 px-4 py-6 text-center text-sm text-ink-2">{t("No upcoming events yet")}</p>
      ) : (
        <ol className="relative space-y-4 ps-5 before:absolute before:inset-y-1 before:start-[5px] before:w-px before:bg-brand-700/15">
          {events.map((e, i) => (
            <li key={e.id} className="relative">
              <span className={`absolute -start-5 top-1 size-[11px] rounded-full ring-4 ring-white ${DOTS[i % 3]}`} aria-hidden="true" />
              <Link href={`/events/${e.id}`} className="block">
                <span className="block text-xs font-semibold text-ink-2">{label(e.starts_at)}</span>
                <span className="block text-[15px] font-semibold">{e.title}</span>
                <span className="block text-xs text-ink-2">{time.format(new Date(e.starts_at))}{e.ends_at ? ` – ${time.format(new Date(e.ends_at))}` : ""}{e.location ? ` · ${e.location}` : ""}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
