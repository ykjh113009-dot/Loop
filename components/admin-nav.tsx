import Link from "next/link";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/students", label: "Accounts" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/leadership", label: "Leadership" },
  { href: "/admin/points", label: "Points" },
  { href: "/admin/rewards", label: "Top 10 Prizes" },
  { href: "/admin/houses", label: "Houses" },
  { href: "/admin/applications", label: "Admin applications" },
  { href: "/admin/log", label: "Activity log" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ current }: { current: string }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-black/5 p-1">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`shrink-0 flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap ${current === l.href ? "bg-brand-700 text-white shadow-sm" : "text-black/55 hover:bg-sage-soft/60"}`}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
