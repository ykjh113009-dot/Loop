import Link from "next/link";
import { Pencil } from "lucide-react";
import { NavIcon } from "@/components/nav-icon";
import { MobileNav } from "@/components/shell/mobile-nav";
import { ProfileMenu, type ShellUser } from "@/components/shell/profile-menu";
import { Sidebar } from "@/components/shell/sidebar";
import { CATEGORIES, categoryActive } from "@/lib/nav";
import type { Badges } from "@/lib/badges";
import { makeT, type Locale } from "@/lib/i18n";

// The five categories as phone tabs (short names).
const TAB_LABEL: Record<string, string> = { home: "Home", community: "Community", "school-life": "School", "learning-hub": "Learn", marketplace: "Market" };

function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -top-0.5 -end-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-bold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}

function Wordmark({ className }: { className: string }) {
  return (
    <Link href="/home" aria-label="Loop home" className="inline-flex">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/loop-wordmark.png" alt="Loop" width={574} height={240} className={className} />
    </Link>
  );
}

function PointsPill({ points, label }: { points: number | null; label: string }) {
  if (points === null) return null;
  return (
    <Link href="/points" aria-label={label} className="inline-flex items-center gap-1.5 rounded-full border border-brand-700/10 bg-white/80 px-3 py-1.5 text-sm font-semibold text-brand-900 hover:bg-white" data-points-pill>
      <NavIcon name="star" className="size-4 fill-amber-400 text-amber-500" strokeWidth={1.8} />
      <span className="tabular-nums">{points.toLocaleString("en")}</span>
      <span className="hidden text-xs font-medium text-ink-2 sm:inline">pts</span>
    </Link>
  );
}

// Everything that frames a page: sidebar and top bar on a computer; header, drawer and bottom tabs on a phone.
// It can also be drawn as the loading placeholder (pathname = null).
export function ShellChrome({ user, badges, pathname, locale = "en", search = "" }: { user: ShellUser | null; badges: Badges; pathname: string | null; locale?: Locale; search?: string }) {
  const t = makeT(locale);
  const current = pathname ?? "";
  const showFab = !!user && (current === "/home" || current === "/community");

  return (
    <>
      <Sidebar user={user} badges={badges} locale={locale} search={search} pathname={pathname} />

      {/* ---------- computer: top bar ---------- */}
      <header className="fixed top-0 end-0 start-[var(--sidebar-w,236px)] z-20 hidden h-[72px] items-center gap-4 px-8 transition-[inset] print:hidden lg:flex">
        <form action="/search" method="get" role="search" className="relative max-w-[640px] flex-1">
          <NavIcon name="search" className="pointer-events-none absolute top-1/2 start-4 size-[18px] -translate-y-1/2 text-ink-2" />
          <input
            name="q"
            type="search"
            maxLength={50}
            placeholder={t("Search in Loop…")}
            aria-label={t("Search in Loop")}
            className="h-11 w-full rounded-full border border-brand-700/10 bg-brand-50/70 pe-4 ps-11 text-sm outline-none placeholder:text-ink-2/70 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
          />
        </form>
        <div className="ms-auto flex items-center gap-1.5">
          {user && (
            <>
              {user.isStudent && <PointsPill points={user.points} label={t("My points")} />}
              <Link href="/notifications" aria-label={t("Notifications")} className="relative rounded-full p-2.5 text-ink hover:bg-brand-700/5">
                <NavIcon name="bell" className="size-[22px]" />
                <Count n={badges.notifications} />
              </Link>
              <Link href="/messages" aria-label={t("Messages")} className="relative rounded-full p-2.5 text-ink hover:bg-brand-700/5">
                <NavIcon name="chat" className="size-[22px]" />
                <Count n={badges.messages} />
              </Link>
              <div className="ms-2">
                <ProfileMenu user={user} locale={locale} />
              </div>
            </>
          )}
        </div>
      </header>

      {/* ---------- phone: header ---------- */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-1 border-b border-brand-700/5 bg-cream/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden lg:hidden">
        <div className="flex items-center gap-1">
          <MobileNav user={user} badges={badges} locale={locale} search={search} pathname={pathname} />
          <Wordmark className="h-8 w-auto" />
        </div>
        {user && (
          <div className="flex items-center gap-0.5">
            {user.isStudent && <PointsPill points={user.points} label={t("My points")} />}
            <Link href="/notifications" aria-label={t("Notifications")} className="relative rounded-full p-2 text-ink">
              <NavIcon name="bell" className="size-[22px]" />
              <Count n={badges.notifications} />
            </Link>
            <ProfileMenu user={user} compact locale={locale} />
          </div>
        )}
      </header>

      {/* ---------- phone: floating new post ---------- */}
      {showFab && (
        <Link
          href={current === "/home" ? "#composer" : "/home#composer"}
          aria-label={t("New post")}
          className="fixed end-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-[0_10px_24px_-8px_rgba(58,82,48,0.8)] active:scale-95 print:hidden lg:hidden"
        >
          <Pencil className="size-6" strokeWidth={1.9} aria-hidden="true" />
        </Link>
      )}

      {/* ---------- phone: bottom tabs (the five categories) ---------- */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-700/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden lg:hidden" data-bottom-tabs>
        <ul className="mx-auto flex max-w-2xl">
          {CATEGORIES.map((cat) => {
            const active = categoryActive(current, "", cat);
            return (
              <li key={cat.key} className="min-w-0 flex-1">
                <Link
                  href={cat.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium ${active ? "text-brand-700" : "text-ink-2"}`}
                >
                  <NavIcon name={cat.icon} className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                  <span className="truncate">{t(TAB_LABEL[cat.key])}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
