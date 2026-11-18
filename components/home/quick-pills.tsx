import Link from "next/link";
import { Trophy, BookOpen, CalendarDays, Store } from "lucide-react";
import { getT } from "@/lib/i18n-server";

const PILLS = [
  { href: "/challenges", label: "Join a Challenge", Icon: Trophy },
  { href: "/academic-resources", label: "Explore Library", Icon: BookOpen },
  { href: "/events", label: "Check Events", Icon: CalendarDays },
  { href: "/marketplace", label: "Marketplace", Icon: Store },
];

export async function QuickPills() {
  const { t } = await getT();
  return (
    <nav aria-label="Quick actions" className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:grid lg:grid-cols-4" data-quick-actions>
      {PILLS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} className="flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-2xl border border-brand-700/10 bg-white/80 px-4 text-sm font-medium text-ink hover:bg-white lg:shrink">
          <Icon className="size-5 text-brand-700" strokeWidth={1.8} aria-hidden="true" />{t(label)}
        </Link>
      ))}
    </nav>
  );
}
