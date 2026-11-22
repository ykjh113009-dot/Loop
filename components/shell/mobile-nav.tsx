"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { NavIcon } from "@/components/nav-icon";
import { NavTree } from "@/components/shell/nav-tree";
import type { ShellUser } from "@/components/shell/profile-menu";
import { CATEGORIES, counselorLink } from "@/lib/nav";
import { signOut } from "@/app/actions/auth";
import type { Badges } from "@/lib/badges";
import { makeT, type Locale } from "@/lib/i18n";

// The phone's menu: a drawer with the same five categories as the computer's sidebar.
export function MobileNav({ user, badges, locale, search = "", pathname: pathnameProp }: { user: ShellUser | null; badges: Badges; locale: Locale; search?: string; pathname: string | null }) {
  const t = makeT(locale);
  const pathname = pathnameProp;
  // The drawer belongs to the page it was opened on, so moving to another page closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = pathname !== null && openAt === pathname;
  const setOpen = useCallback((v: boolean) => setOpenAt(v ? pathname : null), [pathname]);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, setOpen]);

  const support = counselorLink(user);
  return (
    <>
      <button ref={button} type="button" onClick={() => setOpen(true)} aria-label={t("Open the menu")} aria-expanded={open} className="-ms-1 rounded-full p-2 text-ink lg:hidden" data-open-menu>
        <Menu className="size-6" strokeWidth={1.9} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden" data-drawer>
          <button type="button" aria-label={t("Close the menu")} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/35" />
          <div ref={panel} role="dialog" aria-modal="true" aria-label={t("Menu")} className="absolute inset-y-0 start-0 flex w-[min(86vw,320px)] flex-col bg-cream px-3.5 pt-[max(1rem,env(safe-area-inset-top))] pb-4 shadow-xl">
            <div className="flex items-center justify-between px-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand image */}
              <img src="/brand/loop-wordmark.png" alt="Loop" width={1148} height={520} className="h-10 w-auto" />
              <button type="button" onClick={() => { setOpen(false); button.current?.focus(); }} aria-label={t("Close the menu")} className="rounded-full p-2 text-ink-2 hover:bg-brand-700/5"><X className="size-5" aria-hidden="true" /></button>
            </div>
            <nav aria-label={t("Menu")} className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <NavTree categories={CATEGORIES} badges={badges} locale={locale} search={search} pathname={pathname} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="mt-2 space-y-0.5 border-t border-brand-700/10 pt-2">
              {user && <Link href={`/profile/${user.id}`} className="flex items-center gap-2.5 rounded-xl px-2 py-2"><Avatar avatar={user.avatar} size="sm" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="block truncate text-xs text-ink-2">{user.label}</span></span></Link>}
              {support && <Link href={support.href} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-2"><NavIcon name="lock" className="size-4" />{t(support.label)}</Link>}
              {user && <Link href="/settings" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-2"><NavIcon name="settings" className="size-4" />{t("Settings")}</Link>}
              {user && <form action={signOut}><button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-2">{t("Sign out")}</button></form>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
