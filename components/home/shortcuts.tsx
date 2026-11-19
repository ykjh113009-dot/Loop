import Link from "next/link";
import { BookOpen, CalendarDays, Megaphone, Store, type LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n-server";

const CARDS: { href: string; title: string; text: string; action: string; Icon: LucideIcon }[] = [
  { href: "/academic-resources", title: "Academic Library", text: "Study resources for all subjects", action: "Explore", Icon: BookOpen },
  { href: "/events", title: "Events", text: "Discover upcoming events", action: "View Events", Icon: CalendarDays },
  { href: "/announcements", title: "Announcements", text: "Stay updated with important news", action: "Read All", Icon: Megaphone },
  { href: "/marketplace", title: "Marketplace", text: "Buy, sell and explore", action: "Visit Shop", Icon: Store },
];

// Four doors to the rest of Loop, at the bottom of Home.
export async function Shortcuts() {
  const { t } = await getT();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-shortcuts>
      {CARDS.map(({ href, title, text, action, Icon }) => (
        <section key={href} className="relative isolate flex min-h-[150px] flex-col overflow-hidden rounded-3xl border border-brand-700/10 bg-white/85 p-5 shadow-[0_1px_2px_rgba(40,60,40,0.04)]" data-shortcut={title}>
          <Icon className="pointer-events-none absolute -end-2 -bottom-3 -z-10 size-28 text-sage-soft" strokeWidth={1.2} aria-hidden="true" />
          <h2 className="flex items-center gap-2 text-[17px] font-semibold"><Icon className="size-5 text-brand-700" strokeWidth={1.8} aria-hidden="true" />{t(title)}</h2>
          <p className="mt-1 text-sm text-ink-2">{t(text)}</p>
          <Link href={href} className="mt-auto inline-flex w-fit items-center rounded-full border border-brand-700/15 bg-sage-soft/50 px-4 py-2 text-sm font-medium text-brand-900 hover:bg-sage-soft">{t(action)} →</Link>
        </section>
      ))}
    </div>
  );
}
