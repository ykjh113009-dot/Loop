"use client";

import { usePathname } from "next/navigation";
import { ShellChrome } from "@/components/shell/shell-chrome";
import type { ShellUser } from "@/components/shell/profile-menu";
import { useBadges } from "@/lib/use-badges";
import { RewardToasts } from "@/components/rewards/reward-toasts";
import type { Badges } from "@/lib/badges";
import type { Locale } from "@/lib/i18n";

// The real frame: knows which page is open and keeps the counters fresh.
export function ShellFrame({ user, initial, locale }: { user: ShellUser | null; initial: Badges; locale: Locale }) {
  const pathname = usePathname();
  const badges = useBadges(user?.id ?? null, initial);
  return (
    <>
      <ShellChrome user={user} badges={badges} pathname={pathname} locale={locale} />
      {user?.isStudent && <RewardToasts userId={user.id} />}
    </>
  );
}
