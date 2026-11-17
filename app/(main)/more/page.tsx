import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { LineIcon } from "@/components/line-icon";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { navFor } from "@/lib/nav";

export const metadata = { title: "Menu" };

// The phone's menu: exactly the list the computer's sidebar shows.
async function Menu() {
  const me = await requireMe();
  const { t } = await getT();
  return (
    <div className="space-y-5">
      {navFor(me).map((group) => (
        <section key={group.title} data-nav-group={group.title}>
          <h2 className="section-title">{t(group.title)}</h2>
          <ul className="card divide-y divide-black/5 overflow-hidden">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium hover:bg-black/[0.02]">
                  <LineIcon name={item.icon} className="size-5 shrink-0 text-brand-700" />
                  <span className="flex-1">{t(item.label)}</span>
                  <span className="text-black/30 rtl:-scale-x-100">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function MorePage() {
  return (
    <>
      <PageHeader title="Menu" />
      <Suspense fallback={<PageSkeleton />}>
        <Menu />
      </Suspense>
    </>
  );
}
