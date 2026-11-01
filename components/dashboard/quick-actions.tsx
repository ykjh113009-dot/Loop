import Link from "next/link";
import { LineIcon, type LineIconName } from "@/components/line-icon";

const ACTIONS: { href: string; label: string; icon: LineIconName }[] = [
  { href: "/home#composer", label: "New Post", icon: "pencil" },
  { href: "/messages", label: "Messages", icon: "chat" },
  { href: "/events", label: "Calendar", icon: "calendar" },
  { href: "/challenges", label: "Activities", icon: "trophy" },
  { href: "/tutors", label: "Academy", icon: "book" },
  { href: "/more", label: "More", icon: "grid" },
];

export function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-3 gap-2.5 md:grid-cols-6 lg:gap-3">
      {ACTIONS.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className="card group flex min-h-[84px] flex-col items-center justify-center gap-2 px-2 py-3.5 text-center transition hover:-translate-y-0.5 hover:border-brand-700/25 hover:shadow-[0_8px_20px_-12px_rgba(36,48,32,0.35)] lg:min-h-[96px]"
        >
          <LineIcon name={a.icon} className="size-[26px] text-brand-700" strokeWidth={1.6} />
          <span className="text-[13px] font-medium">{a.label}</span>
        </Link>
      ))}
    </nav>
  );
}
