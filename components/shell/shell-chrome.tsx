import Link from "next/link";
import { Leaves } from "@/components/botanical";
import { LineIcon, type LineIconName } from "@/components/line-icon";
import { ProfileMenu, type ShellUser } from "@/components/shell/profile-menu";
import type { Badges } from "@/lib/badges";

type NavItem = { href: string; label: string; icon: LineIconName; also?: string[]; badge?: keyof Badges };

const SIDEBAR: NavItem[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/community", label: "Community", icon: "community", also: ["/clubs"] },
  { href: "/messages", label: "Chats", icon: "chat", badge: "messages" },
  { href: "/events", label: "Calendar", icon: "calendar" },
  { href: "/challenges", label: "Activities", icon: "trophy", also: ["/polls", "/leaderboard"] },
  { href: "/market", label: "Marketplace", icon: "store" },
  { href: "/more", label: "More", icon: "dots", also: ["/tutors", "/tawjihi", "/volunteering", "/council", "/suggestions", "/points", "/counselor", "/people", "/announcements", "/search"] },
];

const TABS: NavItem[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/community", label: "Community", icon: "community", also: ["/clubs"] },
  { href: "/events", label: "Calendar", icon: "calendar" },
  { href: "/more", label: "More", icon: "dots", also: ["/messages", "/challenges", "/market", "/tutors", "/tawjihi", "/volunteering", "/council", "/suggestions", "/points", "/counselor", "/people", "/polls", "/leaderboard", "/announcements", "/search"] },
];

const isActive = (pathname: string, item: NavItem) =>
  [item.href, ...(item.also ?? [])].some((h) => pathname === h || pathname.startsWith(h + "/"));

function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-bold text-white">
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

// Everything that frames a page: sidebar and top bar on a computer, header,
// bottom tabs and the floating "new post" button on a phone.
// It has no hooks, so it can also be drawn as the loading placeholder (pathname = null).
export function ShellChrome({ user, badges, pathname }: { user: ShellUser | null; badges: Badges; pathname: string | null }) {
  const current = pathname ?? "";
  const showFab = !!user && (current === "/home" || current === "/community");

  return (
    <>
      {/* ---------- computer: sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col overflow-hidden px-5 pt-6 pb-6 print:hidden lg:flex">
        <Wordmark className="h-11 w-auto" />
        <nav aria-label="Main" className="mt-8">
          <ul className="space-y-1">
            {SIDEBAR.map((item) => {
              const active = isActive(current, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition-colors ${
                      active ? "bg-sage-soft/80 text-brand-900" : "text-ink-2 hover:bg-brand-700/5 hover:text-ink"
                    }`}
                  >
                    <LineIcon name={item.icon} className={`size-5 ${active ? "text-brand-700" : ""}`} strokeWidth={active ? 2 : 1.7} />
                    {item.label}
                    {item.badge && badges[item.badge] ? (
                      <span className="ml-auto min-w-5 rounded-full bg-red-600 px-1.5 text-center text-[11px] leading-5 font-bold text-white">
                        {badges[item.badge]}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="relative mt-auto">
          <Leaves className="pointer-events-none absolute -bottom-6 -left-8 w-56" />
          <p className="relative text-[13px] leading-snug text-ink-2">
            One Loop.
            <br />
            Endless Possibilities.
          </p>
        </div>
      </aside>

      {/* ---------- computer: top bar ---------- */}
      <header className="fixed top-0 right-0 left-[236px] z-20 hidden h-[72px] items-center gap-4 px-8 print:hidden lg:flex">
        <form action="/search" method="get" role="search" className="relative max-w-[640px] flex-1">
          <LineIcon name="search" className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-ink-2" />
          <input
            name="q"
            type="search"
            maxLength={50}
            placeholder="Search in Loop…"
            aria-label="Search in Loop"
            className="h-11 w-full rounded-full border border-brand-700/10 bg-brand-50/70 pr-4 pl-11 text-sm outline-none placeholder:text-ink-2/70 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
          />
        </form>
        <div className="ml-auto flex items-center gap-1.5">
          {user && (
            <>
              <Link href="/notifications" aria-label="Notifications" className="relative rounded-full p-2.5 text-ink hover:bg-brand-700/5">
                <LineIcon name="bell" className="size-[22px]" />
                <Count n={badges.notifications} />
              </Link>
              <Link href="/messages" aria-label="Messages" className="relative rounded-full p-2.5 text-ink hover:bg-brand-700/5">
                <LineIcon name="chat" className="size-[22px]" />
                <Count n={badges.messages} />
              </Link>
              <div className="ml-2">
                <ProfileMenu user={user} />
              </div>
            </>
          )}
        </div>
      </header>

      {/* ---------- phone: header ---------- */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-brand-700/5 bg-cream/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden lg:hidden">
        <Wordmark className="h-8 w-auto" />
        {user && (
          <div className="flex items-center gap-0.5">
            <Link href="/notifications" aria-label="Notifications" className="relative rounded-full p-2 text-ink">
              <LineIcon name="bell" className="size-[22px]" />
              <Count n={badges.notifications} />
            </Link>
            <Link href="/messages" aria-label="Messages" className="relative rounded-full p-2 text-ink">
              <LineIcon name="chat" className="size-[22px]" />
              <Count n={badges.messages} />
            </Link>
            <ProfileMenu user={user} compact />
          </div>
        )}
      </header>

      {/* ---------- phone: floating new post ---------- */}
      {showFab && (
        <Link
          href={current === "/home" ? "#composer" : "/home#composer"}
          aria-label="New post"
          className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-[0_10px_24px_-8px_rgba(58,82,48,0.8)] active:scale-95 print:hidden lg:hidden"
        >
          <LineIcon name="pencil" className="size-6" />
        </Link>
      )}

      {/* ---------- phone: bottom tabs ---------- */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-700/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden lg:hidden">
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map((tab) => {
            const active = isActive(current, tab);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-brand-700" : "text-ink-2"}`}
                >
                  <LineIcon name={tab.icon} className="size-6" strokeWidth={active ? 2.1 : 1.7} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
