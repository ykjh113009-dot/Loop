import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getT } from "@/lib/i18n-server";
import { PageBanner } from "@/components/ui/page-banner";
import type { SceneName } from "@/components/art/scenes";

// A page for a feature that is planned but not built yet. It says so plainly and points to what works today.
export async function ComingSoon({
  title, subtitle, scene, intro, expect, meanwhile,
}: { title: string; subtitle: string; scene: SceneName; intro: string; expect: string[]; meanwhile: { href: string; label: string }[] }) {
  const { t } = await getT();
  return (
    <div className="space-y-5" data-coming-soon>
      <PageBanner title={t(title)} subtitle={t(subtitle)} scene={scene} />
      <section className="card space-y-4 p-5">
        <span className="chip bg-brand-50 text-brand-800"><Sparkles className="size-3.5" aria-hidden="true" /> {t("Coming soon")}</span>
        <p className="text-[15px]">{t(intro)}</p>
        <div>
          <h2 className="section-title">{t("What to expect")}</h2>
          <ul className="list-disc space-y-1 ps-5 text-sm text-ink-2">{expect.map((e) => <li key={e}>{t(e)}</li>)}</ul>
        </div>
        <p className="text-sm text-ink-2">{t("This is not available yet, so there is nothing to show. In the meantime:")}</p>
        <div className="flex flex-wrap gap-2">{meanwhile.map((m) => <Link key={m.href} href={m.href} className="btn-secondary">{t(m.label)}</Link>)}</div>
      </section>
    </div>
  );
}
