"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ClubTabs({ clubId }: { clubId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/clubs/${clubId}`, label: "Feed" },
    { href: `/clubs/${clubId}/chat`, label: "Chat" },
    { href: `/clubs/${clubId}/members`, label: "Members" },
  ];
  return (
    <div className="mt-4 flex gap-1 rounded-xl bg-black/5 p-1">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`flex-1 rounded-lg py-1.5 text-center text-sm font-medium ${
            pathname === t.href ? "bg-white text-black shadow-sm" : "text-black/55"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
