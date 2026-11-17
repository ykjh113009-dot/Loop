import type { LineIconName } from "@/components/line-icon";
import type { Badges } from "@/lib/badges";

export type NavItem = { href: string; label: string; icon: LineIconName; also?: string[]; badge?: keyof Badges; studentsOnly?: boolean };
export type NavGroup = { title: string; items: NavItem[] };

// Everything in Loop, grouped by topic. The sidebar (computer) and the More tab (phone) both show exactly this list.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Main",
    items: [
      { href: "/home", label: "Home", icon: "home" },
      { href: "/community", label: "Community", icon: "community", also: ["/saved", "/friends", "/people", "/post"] },
      { href: "/messages", label: "Chats", icon: "chat", badge: "messages" },
      { href: "/events", label: "Calendar", icon: "calendar" },
      { href: "/challenges", label: "Activities", icon: "trophy" },
    ],
  },
  {
    title: "Study",
    items: [
      { href: "/academic-resources", label: "Academic Resources", icon: "book" },
      { href: "/tutors", label: "Tutors Directory", icon: "tutor" },
      { href: "/opportunities", label: "University & Opportunities", icon: "graduation" },
      { href: "/tawjihi", label: "Tawjihi corner", icon: "flask" },
      { href: "/shop", label: "Rewards Shop", icon: "gift" },
    ],
  },
  {
    title: "Get involved",
    items: [
      { href: "/clubs", label: "Clubs", icon: "gamepad" },
      { href: "/groups", label: "Groups", icon: "comment" },
      { href: "/leaderboard", label: "Leaderboards", icon: "chart" },
      { href: "/polls", label: "Polls", icon: "pencil" },
      { href: "/competitions", label: "Competitions", icon: "ball" },
      { href: "/volunteering", label: "Volunteering hours", icon: "heart", studentsOnly: true },
      { href: "/market", label: "Buy, sell & swap", icon: "store" },
    ],
  },
  {
    title: "Your school",
    items: [
      { href: "/council", label: "Student council", icon: "library" },
      { href: "/suggestions", label: "Suggestion box", icon: "megaphone" },
      { href: "/leadership", label: "Leadership", icon: "shield" },
      { href: "/points", label: "My points & badges", icon: "star", studentsOnly: true },
    ],
  },
];

// The counselor entry is its own quiet group at the end.
export const counselorItem = (user: { isStudent: boolean; isCounselor: boolean } | null): NavItem | null =>
  user?.isCounselor ? { href: "/counselor", label: "Counselor inbox", icon: "lock" } : user?.isStudent ? { href: "/counselor", label: "Talk to the counselor", icon: "lock" } : null;

export function navFor(user: { isStudent: boolean; isCounselor: boolean } | null): NavGroup[] {
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.studentsOnly || user?.isStudent) }));
  const c = counselorItem(user);
  return c ? [...groups, { title: "Support", items: [c] }] : groups;
}

export const isActive = (pathname: string, item: NavItem) =>
  [item.href, ...(item.also ?? [])].some((h) => pathname === h || pathname.startsWith(h + "/"));
