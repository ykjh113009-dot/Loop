import Link from "next/link";
import { getT } from "@/lib/i18n-server";
import { NavIcon, type NavIconName } from "@/components/nav-icon";

const ACTIONS: { href: string; label: string; icon: NavIconName }[] = [
  { href: "/clubs", label: "Join a Club", icon: "clubs" },
  { href: "/academic-resources", label: "Browse Resources", icon: "library" },
  { href: "/events", label: "Explore Events", icon: "calendar" },
  { href: "/marketplace", label: "Visit Marketplace", icon: "store" },
];

export async function QuickActions() {
  const { t } = await getT();
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2.5 md:grid-cols-4 lg:gap-3">
      {ACTIONS.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className="card group flex min-h-[84px] flex-col items-center justify-center gap-2 px-2 py-3.5 text-center transition hover:-translate-y-0.5 hover:border-brand-700/25 hover:shadow-[0_8px_20px_-12px_rgba(36,48,32,0.35)] lg:min-h-[96px]"
        >
          <NavIcon name={a.icon} className="size-[26px] text-brand-700" strokeWidth={1.6} />
          <span className="text-[13px] font-medium">{t(a.label)}</span>
        </Link>
      ))}
    </nav>
  );
}
