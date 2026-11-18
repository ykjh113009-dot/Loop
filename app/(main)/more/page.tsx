import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { NavIcon } from "@/components/nav-icon";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { CATEGORIES, counselorLink } from "@/lib/nav";

export const metadata = { title: "Menu" };

// The whole of Loop in one list: the same five categories the sidebar shows.
async function Menu() {
  const me = await requireMe();
  const { t } = await getT();
  const support = counselorLink(me);
  return (
    <div className="space-y-5">
      {CATEGORIES.map((cat) => (
        <section key={cat.key} data-nav-group={cat.label}>
          <h2 className="section-title"><Link href={cat.href} className="hover:underline">{t(cat.label)}</Link></h2>
          <ul className="card divide-y divide-black/5 overflow-hidden">
            {cat.children.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex items-center gap-3.5 px-4 py-3 text-[15px] font-medium hover:bg-black/[0.02]">
                  <NavIcon name={item.icon} className="size-5 shrink-0 text-brand-700" />
                  <span className="flex-1">{t(item.label)}</span>
                  {item.soon && <span className="rounded-full bg-brand-700/10 px-2 py-0.5 text-[11px] text-brand-800">{t("Soon")}</span>}
                  <span className="text-black/30 rtl:-scale-x-100">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {support && (
        <Link href={support.href} className="card flex items-center gap-3 border-brand-200 bg-brand-50 p-4 font-semibold text-brand-900">
          <NavIcon name="lock" className="size-5" />{t(support.label)}
        </Link>
      )}
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
