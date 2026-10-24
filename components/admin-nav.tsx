import Link from "next/link";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ current }: { current: string }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-black/5 p-1">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`shrink-0 flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium ${current === l.href ? "bg-white shadow-sm" : "text-black/55"}`}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
