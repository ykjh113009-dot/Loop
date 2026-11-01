"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";
import { LineIcon, type LineIconName } from "@/components/line-icon";

export type ShellUser = {
  id: string;
  name: string;
  avatar: string;
  label: string;
  isStaff: boolean;
  isAdmin: boolean;
  isCounselor: boolean;
};

// The profile button in the top bar, with the small menu under it.
export function ProfileMenu({ user, compact = false }: { user: ShellUser; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items: { href: string; label: string; icon: LineIconName }[] = [
    { href: `/profile/${user.id}`, label: "My profile", icon: "user" },
    { href: "/profile/edit", label: "Edit profile", icon: "pencil" },
    { href: "/more", label: "More features", icon: "grid" },
  ];
  if (user.isCounselor) items.push({ href: "/counselor", label: "Counselor inbox", icon: "lock" });
  if (user.isStaff) items.push({ href: "/moderation", label: "Moderation", icon: "shield" });
  if (user.isAdmin) items.push({ href: "/admin", label: "Admin dashboard", icon: "chart" });

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Profile menu"
        className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 hover:bg-brand-700/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      >
        <Avatar avatar={user.avatar} size="md" className="ring-2 ring-white" />
        {!compact && (
          <>
            <span className="text-left leading-tight">
              <span className="block max-w-36 truncate text-sm font-semibold">{user.name}</span>
              <span className="block text-xs text-ink-2">{user.label}</span>
            </span>
            <LineIcon name="chevronDown" className="size-4 text-ink-2" />
          </>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-brand-700/10 bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(36,48,32,0.35)]">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-brand-50"
            >
              <LineIcon name={item.icon} className="size-[18px] text-brand-700" />
              {item.label}
            </Link>
          ))}
          <form action={signOut} className="mt-1 border-t border-brand-700/10 pt-1">
            <button role="menuitem" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-brand-50">
              <LineIcon name="logout" className="size-[18px] text-brand-700" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
