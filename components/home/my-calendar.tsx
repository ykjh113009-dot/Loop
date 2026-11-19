import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { getUpcomingEvents } from "@/lib/dashboard";
import { localDayKey, localParts, formatDate } from "@/lib/time";


export async function MyCalendar() {
  await requireMe();
  const { t, locale } = await getT();
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
      <p className="mb-3 text-center text-[17px] font-semibold" data-calendar-month>{new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { timeZone: "Asia/Hebron", month: "long", year: "numeric" }).format(now)}</p>
      {events.length === 0 ? (
        <p className="rounded-xl bg-sage-soft/40 px-4 py-6 text-center text-sm text-ink-2">{t("No upcoming events yet")}</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="flex items-center gap-3.5">
                <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-sage-soft/70 leading-none" aria-hidden="true">
                  <span className="text-lg font-semibold text-brand-900">{localParts(e.starts_at).day}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{e.title}</span>
                  <span className="block truncate text-xs text-ink-2">{label(e.starts_at)} · {time.format(new Date(e.starts_at))}{e.ends_at ? ` – ${time.format(new Date(e.ends_at))}` : ""}{e.location ? ` · ${e.location}` : ""}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
