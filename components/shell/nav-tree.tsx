"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { NavIcon } from "@/components/nav-icon";
import { categoryActive, pageActive, type NavCategory } from "@/lib/nav";
import type { Badges } from "@/lib/badges";
import { makeT, type Locale } from "@/lib/i18n";

// The five categories. Clicking one opens its page and shows what is inside; the active page is highlighted.
export function NavTree({
  categories, badges, locale, search = "", pathname: pathnameProp, collapsed = false, onNavigate,
}: { pathname: string | null; categories: NavCategory[]; badges: Badges; locale: Locale; search?: string; collapsed?: boolean; onNavigate?: () => void }) {
  const t = makeT(locale);
  const pathname = pathnameProp ?? "";
  // A category is open when you opened it yourself, or (until you decide otherwise) when you are inside it.
  const [manual, setManual] = useState<Record<string, boolean>>({});

  return (
    <ul className="space-y-1" data-nav-tree>
      {categories.map((cat) => {
        const active = categoryActive(pathname, search, cat);
        const expanded = !collapsed && (manual[cat.key] ?? active);
        return (
          <li key={cat.key} data-nav-category={cat.key}>
            <div className={`flex items-center rounded-xl ${active ? "bg-brand-700 text-white" : "hover:bg-sage-soft/50"}`}>
              <Link
                href={cat.href}
                title={collapsed ? t(cat.label) : undefined}
                aria-current={pathname === cat.href ? "page" : undefined}
                onClick={() => { setManual((o) => ({ ...o, [cat.key]: true })); onNavigate?.(); }}
                className={`flex min-w-0 flex-1 items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold ${collapsed ? "justify-center px-0" : ""} ${active ? "text-white" : "text-ink-2 hover:text-ink"}`}
              >
                <NavIcon name={cat.icon} className={`size-5 shrink-0 ${active ? "text-white" : ""}`} strokeWidth={active ? 2.2 : 1.8} />
                <span className={collapsed ? "sr-only" : "truncate"}>{t(cat.label)}</span>
              </Link>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setManual((o) => ({ ...o, [cat.key]: !expanded }))}
                  aria-expanded={expanded}
                  aria-label={`${t(cat.label)}: ${expanded ? t("Hide") : t("Show")}`}
                  className={`me-1.5 rounded-lg p-1.5 ${active ? "text-white hover:bg-white/15" : "text-ink-2 hover:bg-brand-700/10"}`}
                >
                  <ChevronDown className={`size-4 transition-transform ${expanded ? "" : "-rotate-90 rtl:rotate-90"}`} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </div>
            {expanded && (
              <ul className="mt-1 mb-2 ms-[1.65rem] space-y-0.5 border-s border-brand-700/15 ps-2.5" data-nav-children>
                {cat.children.map((item) => {
                  const here = pageActive(pathname, search, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={here ? "page" : undefined}
                        onClick={onNavigate}
                        className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[14px] ${here ? "bg-brand-700 font-semibold text-white" : "text-ink-2 hover:bg-sage-soft/50 hover:text-ink"}`}
                      >
                        <NavIcon name={item.icon} className={`size-4 shrink-0 ${here ? "text-white" : ""}`} strokeWidth={here ? 2.1 : 1.8} />
                        <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
                        {item.soon && <span className="rounded-full bg-brand-700/10 px-1.5 text-[10px] font-medium text-brand-800">{t("Soon")}</span>}
                        {item.badge && badges[item.badge] ? (
                          <span className="min-w-5 rounded-full bg-red-600 px-1.5 text-center text-[11px] leading-5 font-bold text-white">{badges[item.badge]}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
