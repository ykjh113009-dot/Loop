import Link from "next/link";
import { NavIcon, type NavIconName } from "@/components/nav-icon";

export type TabItem = { href: string; label: string; icon?: NavIconName };

// The row of pills under a banner. It scrolls sideways inside itself on a small screen.
export function SectionTabs({ items, current, label }: { items: TabItem[]; current?: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]" data-section-tabs>
      <ul className="flex min-w-max gap-2 py-1">
        {items.map((it) => {
          const active = it.href === current;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${active ? "border-brand-700 bg-brand-700 text-white" : "border-brand-700/10 bg-white text-ink-2 hover:border-brand-700/25 hover:text-ink"}`}
              >
                {it.icon && <NavIcon name={it.icon} className="size-4" />}
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
