import Link from "next/link";
import { LineIcon, type LineIconName } from "@/components/line-icon";
import { IconTile } from "@/components/dashboard/card";

const ITEMS: { href: string; title: string; text: string; icon: LineIconName }[] = [
  { href: "/tutors", title: "Loop Academy", text: "Tutors and study buddies from your school", icon: "book" },
  { href: "/tawjihi", title: "Scholarships & Opportunities", text: "Ask alumni mentors about Tawjihi and university", icon: "graduation" },
  { href: "/volunteering", title: "Volunteering", text: "Log your hours and get a certificate", icon: "heart" },
];

export function Featured() {
  return (
    <section className="card p-4 lg:p-[18px]">
      <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Featured in Loop</h2>
      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-3">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className="flex items-center gap-3 rounded-xl border border-brand-700/10 px-3 py-3 hover:bg-brand-50">
            <IconTile name={i.icon} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-tight font-semibold">{i.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-ink-2">{i.text}</span>
            </span>
            <LineIcon name="chevronRight" className="size-4 shrink-0 text-ink-2" />
          </Link>
        ))}
      </div>
    </section>
  );
}
