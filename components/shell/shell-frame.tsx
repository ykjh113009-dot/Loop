"use client";

import { usePathname } from "next/navigation";
import { ShellChrome } from "@/components/shell/shell-chrome";
import type { ShellUser } from "@/components/shell/profile-menu";
import { useBadges } from "@/lib/use-badges";
import type { Badges } from "@/lib/badges";

// The real frame: knows which page is open and keeps the counters fresh.
export function ShellFrame({ user, initial }: { user: ShellUser | null; initial: Badges }) {
  const pathname = usePathname();
  const badges = useBadges(user?.id ?? null, initial);
  return <ShellChrome user={user} badges={badges} pathname={pathname} />;
}
