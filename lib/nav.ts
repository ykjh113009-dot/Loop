import type { NavIconName } from "@/components/nav-icon";
import type { Badges } from "@/lib/badges";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  /** Other paths that belong to this page, so it stays highlighted. */
  also?: string[];
  badge?: keyof Badges;
  /** A page that explains what is coming; the feature itself is not built yet. */
  soon?: boolean;
};
export type NavCategory = { key: string; href: string; label: string; icon: NavIconName; children: NavItem[] };

// The five main categories, with every feature in its place.
export const CATEGORIES: NavCategory[] = [
  {
    key: "home", href: "/home", label: "Home", icon: "home",
    children: [{ href: "/home", label: "Dashboard", icon: "home", also: ["/post"] }],
  },
  {
    key: "community", href: "/clubs", label: "Community", icon: "users",
    children: [
      { href: "/clubs", label: "Clubs", icon: "clubs" },
      { href: "/groups", label: "Groups", icon: "groups" },
      { href: "/messages", label: "Chats", icon: "chat", badge: "messages" },
      { href: "/polls", label: "Polls", icon: "polls" },
      { href: "/saved", label: "Saved", icon: "saved" },
    ],
  },
  {
    key: "school-life", href: "/school-life", label: "School Life", icon: "calendar",
    children: [
      { href: "/events", label: "Calendar & Events", icon: "calendar" },
      { href: "/challenges", label: "Activities & Challenges", icon: "trophy", also: ["/competitions"] },
      { href: "/houses", label: "Houses", icon: "houses" },
      { href: "/leaderboard", label: "Leaderboards", icon: "medal" },
      { href: "/council", label: "Student Council", icon: "council", also: ["/suggestions", "/leadership", "/announcements"] },
      { href: "/volunteering", label: "Volunteering", icon: "heart" },
      { href: "/passport", label: "Loop Passport", icon: "passport" },
      { href: "/campus", label: "Campus Map & Directory", icon: "map", soon: true },
    ],
  },
  {
    key: "learning-hub", href: "/learning-hub", label: "Learning Hub", icon: "book",
    children: [
      { href: "/academic-resources", label: "Academic Library", icon: "library" },
      { href: "/tutors", label: "Tutors Directory", icon: "tutors" },
    ],
  },
  {
    key: "marketplace", href: "/marketplace", label: "Marketplace", icon: "store",
    children: [
      { href: "/market", label: "Student Marketplace", icon: "store" },
      { href: "/shop", label: "Rewards Shop", icon: "gift" },
      { href: "/shop?tab=top10", label: "Top 10 Prizes", icon: "crown" },
    ],
  },
];

// The support link sits with the profile controls, not in the five categories.
export const counselorLink = (user: { isStudent: boolean; isCounselor: boolean } | null) =>
  user?.isCounselor ? { href: "/counselor", label: "Counselor inbox" } : user?.isStudent ? { href: "/counselor", label: "Talk to the counselor" } : null;

// Is this page (and, for a category, any of its pages) the one being viewed?
export function pageActive(pathname: string, search: string, item: NavItem) {
  const [path, query] = item.href.split("?");
  if (query) return pathname === path && search.includes(query);
  // Rewards Shop is active on /shop unless the Top 10 tab is open.
  if (path === "/shop") return (pathname === "/shop" || pathname.startsWith("/shop/")) && !search.includes("tab=top10");
  return [path, ...(item.also ?? [])].some((h) => pathname === h || pathname.startsWith(h + "/"));
}
export function categoryActive(pathname: string, search: string, cat: NavCategory) {
  return pathname === cat.href || cat.children.some((c) => pageActive(pathname, search, c));
}

// The label used in tabs and breadcrumbs.
export const ROUTES: Record<string, { category: string; label: string }> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.children.map((i) => [i.href.split("?")[0], { category: c.key, label: i.label }])),
);
