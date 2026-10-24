import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "More" };

type Tile = { href: string; emoji: string; title: string; text: string; studentsOnly?: boolean };

const SECTIONS: { title: string; tiles: Tile[] }[] = [
  {
    title: "Learn together",
    tiles: [
      { href: "/tutors", emoji: "📚", title: "Tutors & study buddies", text: "Get help or help a classmate" },
      { href: "/tawjihi", emoji: "🎓", title: "Tawjihi corner", text: "Questions answered by alumni" },
    ],
  },
  {
    title: "Get involved",
    tiles: [
      { href: "/challenges", emoji: "🏁", title: "Weekly challenge", text: "Earn points for your grade", studentsOnly: true },
      { href: "/leaderboard", emoji: "🏆", title: "Grade leaderboard", text: "Which grade is on top?" },
      { href: "/polls", emoji: "📊", title: "Polls", text: "Have your say" },
      { href: "/volunteering", emoji: "💚", title: "Volunteering hours", text: "Log hours, get a certificate", studentsOnly: true },
      { href: "/market", emoji: "🛍️", title: "Buy, sell & swap", text: "Meet at school, no online payments" },
    ],
  },
  {
    title: "Your school",
    tiles: [
      { href: "/council", emoji: "🗳️", title: "Student council", text: "Members and elections" },
      { href: "/suggestions", emoji: "💡", title: "Suggestion box", text: "Ideas to make school better" },
      { href: "/points", emoji: "⭐", title: "My points & badges", text: "Only you can see your points", studentsOnly: true },
    ],
  },
];

async function More() {
  const me = await requireMe();
  return (
    <div className="space-y-6">
      {/* The counselor button is always easy to find, but quiet. */}
      {me.isStudent && (
        <Link href="/counselor" className="card flex items-center gap-3 border-brand-200 bg-brand-50 p-4">
          <span className="text-2xl">🫶</span>
          <span className="flex-1">
            <span className="block font-semibold text-brand-900">Talk to the counselor</span>
            <span className="block text-sm text-brand-900/70">Private. Only you and the school counselor can see it.</span>
          </span>
          <span className="text-brand-700">→</span>
        </Link>
      )}
      {me.isCounselor && (
        <Link href="/counselor" className="card flex items-center gap-3 border-brand-200 bg-brand-50 p-4">
          <span className="text-2xl">🔒</span>
          <span className="flex-1 font-semibold text-brand-900">Counselor inbox</span>
          <span className="text-brand-700">→</span>
        </Link>
      )}
      {SECTIONS.map((section) => (
        <section key={section.title}>
          <h2 className="section-title">{section.title}</h2>
          <div className="grid grid-cols-2 gap-2">
            {section.tiles
              .filter((t) => !t.studentsOnly || me.isStudent)
              .map((t) => (
                <Link key={t.href} href={t.href} className="card p-3 hover:bg-black/[0.02]">
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="mt-1 block text-sm leading-tight font-semibold">{t.title}</span>
                  <span className="mt-0.5 block text-xs text-black/50">{t.text}</span>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <Suspense fallback={<PageSkeleton />}>
        <More />
      </Suspense>
    </>
  );
}
