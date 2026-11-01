import { Suspense } from "react";
import { getMe } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import { NO_BADGES } from "@/lib/badges";
import { Shell } from "@/components/shell/shell";
import { ShellChrome } from "@/components/shell/shell-chrome";

async function SuspendedBanner() {
  const me = await getMe();
  if (!me?.isSuspended || !me.suspended_until) return null;
  const permanent = new Date(me.suspended_until).getFullYear() > 9000;
  return (
    <div className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 print:hidden lg:mx-8">
      <p className="font-semibold">Your account is suspended {permanent ? "until further notice" : `until ${formatDateTime(me.suspended_until)}`}.</p>
      <p>You can still look around, but you can&apos;t post, chat or RSVP. Reason: {me.suspension_reason}</p>
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Suspense fallback={<ShellChrome user={null} badges={NO_BADGES} pathname={null} />}>
        <Shell />
      </Suspense>
      <div className="pt-14 print:pt-0 lg:pt-[72px] lg:pl-[236px] print:lg:pl-0">
        <Suspense>
          <SuspendedBanner />
        </Suspense>
        {/* The dashboard asks for the wide layout with data-wide; other pages stay in a narrow column. */}
        <main className="mx-auto w-full max-w-2xl px-4 py-4 pb-28 has-[[data-wide]]:max-w-[1360px] lg:px-8 lg:py-6 lg:pb-10 print:max-w-none print:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
