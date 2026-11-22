"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Leaves } from "@/components/botanical";
import { Avatar } from "@/components/avatar";
import { NavIcon } from "@/components/nav-icon";
import { NavTree } from "@/components/shell/nav-tree";
import type { ShellUser } from "@/components/shell/profile-menu";
import { CATEGORIES, counselorLink } from "@/lib/nav";
import { signOut } from "@/app/actions/auth";
import type { Badges } from "@/lib/badges";
import { makeT, type Locale } from "@/lib/i18n";

const KEY = "loop_sidebar";
const EVENT = "loop-sidebar-change";
const subscribe = (cb: () => void) => { window.addEventListener(EVENT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); }; };
const read = () => { try { return localStorage.getItem(KEY) === "collapsed"; } catch { return false; } };

// The computer's sidebar: logo, the five categories, and a small area for profile, settings and sign out.
// It can be folded down to icons; the choice is remembered on this device.
export function Sidebar({ user, badges, locale, search = "", pathname }: { user: ShellUser | null; badges: Badges; locale: Locale; search?: string; pathname: string | null }) {
  const t = makeT(locale);
  // The folded/open choice lives on this device; the server always draws it open and the browser corrects it.
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  useEffect(() => { document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "open"; }, [collapsed]);
  const toggle = () => { try { localStorage.setItem(KEY, collapsed ? "open" : "collapsed"); } catch { /* ignore */ } window.dispatchEvent(new Event(EVENT)); };

  const support = counselorLink(user);
  return (
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-[var(--sidebar-w,236px)] flex-col overflow-hidden px-3.5 pt-5 pb-4 transition-[width] print:hidden lg:flex" data-sidebar-root aria-label={t("Sidebar")}>
      <div className={`flex items-center ${collapsed ? "flex-col gap-3" : "justify-between"} px-1.5`}>
        <Link href="/home" aria-label="Loop home" className="inline-flex">
          {collapsed
            // eslint-disable-next-line @next/next/no-img-element -- static brand image
            ? <img src="/brand/loop-icon-192.png" alt="Loop" width={40} height={40} className="size-10" />
            // eslint-disable-next-line @next/next/no-img-element -- static brand image
            : <img src="/brand/loop-wordmark.png" alt="Loop" width={1148} height={520} className="h-11 w-auto" />}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? t("Expand the sidebar") : t("Collapse the sidebar")}
          aria-pressed={collapsed}
          className="rounded-full border border-brand-700/10 bg-white/70 p-1.5 text-ink-2 hover:bg-white"
          data-sidebar-toggle
        >
          {collapsed ? <ChevronsRight className="size-4 rtl:rotate-180" strokeWidth={2} aria-hidden="true" /> : <ChevronsLeft className="size-4 rtl:rotate-180" strokeWidth={2} aria-hidden="true" />}
        </button>
      </div>

      <nav aria-label="Main" className="relative z-10 mt-5 min-h-0 flex-1 overflow-y-auto pe-0.5 [scrollbar-width:thin]">
        <NavTree categories={CATEGORIES} badges={badges} locale={locale} search={search} pathname={pathname} collapsed={collapsed} />
      </nav>

      {/* Profile, settings and sign out stay out of the five categories. */}
      <div className="relative z-10 mt-2 space-y-0.5 border-t border-brand-700/10 pt-2" data-sidebar-utility>
        {user && (
          <Link href={`/profile/${user.id}`} title={collapsed ? user.name : undefined} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-brand-700/5">
            <Avatar avatar={user.avatar} size="sm" />
            {!collapsed && <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{user.name}</span><span className="block truncate text-[11px] text-ink-2">{user.label}</span></span>}
          </Link>
        )}
        {support && (
          <Link href={support.href} title={collapsed ? t(support.label) : undefined} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-brand-700/5 hover:text-ink ${collapsed ? "justify-center" : ""}`}>
            <NavIcon name="lock" className="size-4 shrink-0" /><span className={collapsed ? "sr-only" : "truncate"}>{t(support.label)}</span>
          </Link>
        )}
        {user && (
          <Link href="/settings" title={collapsed ? t("Settings") : undefined} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-brand-700/5 hover:text-ink ${collapsed ? "justify-center" : ""}`}>
            <NavIcon name="settings" className="size-4 shrink-0" /><span className={collapsed ? "sr-only" : "truncate"}>{t("Settings")}</span>
          </Link>
        )}
        {user && (
          <form action={signOut}>
            <button className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-brand-700/5 hover:text-ink ${collapsed ? "justify-center" : ""}`} title={collapsed ? t("Sign out") : undefined}>
              <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H10" /><path d="M14.5 8l4 4-4 4" /><path d="M18.5 12H9.5" /></svg>
              <span className={collapsed ? "sr-only" : "truncate"}>{t("Sign out")}</span>
            </button>
          </form>
        )}
      </div>
      {!collapsed && <Leaves className="pointer-events-none absolute -bottom-8 -start-10 -z-0 w-48 opacity-60" />}
    </aside>
  );
}
