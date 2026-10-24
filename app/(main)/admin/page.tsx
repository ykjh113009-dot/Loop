import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin-nav";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Admin" };

type Stats = {
  students: number;
  students_in_club: number;
  by_grade: { grade: number | null; total: number; in_club: number }[];
  clubs_approved: number;
  clubs_pending: number;
  events_upcoming: number;
  rsvps_upcoming: number;
  posts_7d: number;
  messages_7d: number;
  active_7d: number;
  reports_open: number;
  reports_30d: number;
  suspended_now: number;
  top_clubs: { name: string; emoji: string; members: number }[];
};

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

function Tile({ label, value, sub, href }: { label: string; value: string | number; sub?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium text-black/50">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-black/50">{sub}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card p-4 hover:bg-black/[0.02]">{body}</Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

// One horizontal bar per row. The number is always written next to the bar,
// so nobody has to read the length alone.
function Bars({ rows }: { rows: { label: string; value: number; max: number; text: string }[] }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2 text-sm" title={`${r.label}: ${r.text}`}>
          <span className="truncate text-black/70">{r.label}</span>
          <span className="h-3 rounded-full bg-black/[0.06]">
            <span className="block h-3 rounded-full bg-brand-600" style={{ width: `${r.max ? Math.max(2, (r.value / r.max) * 100) : 0}%` }} />
          </span>
          <span className="text-right text-xs font-medium tabular-nums text-black/70">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

async function Dashboard() {
  const me = await requireMe("admin");
  const supabase = await createClient();
  const { data } = await supabase.rpc("school_stats");
  const s = data as unknown as Stats;
  const topMax = Math.max(1, ...s.top_clubs.map((c) => c.members));

  return (
    <div className="space-y-5">
      <p className="text-sm text-black/55">{me.school.name}</p>

      <div className="card bg-brand-700 p-5 text-white">
        <p className="text-sm text-white/75">Students in at least one club</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">{pct(s.students_in_club, s.students)}%</p>
        <p className="text-sm text-white/75">{s.students_in_club} of {s.students} students</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Active this week" value={s.active_7d} sub={`${pct(s.active_7d, s.students)}% posted, chatted or RSVPed`} />
        <Tile label="Clubs" value={s.clubs_approved} sub={s.clubs_pending ? `${s.clubs_pending} waiting for approval` : "none waiting"} href="/moderation?tab=approvals" />
        <Tile label="Upcoming events" value={s.events_upcoming} sub={`${s.rsvps_upcoming} RSVPs`} href="/events" />
        <Tile label="Posts this week" value={s.posts_7d} sub={`${s.messages_7d} chat messages`} />
        <Tile label="Open reports" value={s.reports_open} sub={`${s.reports_30d} sent in 30 days`} href="/moderation" />
        <Tile label="Suspended now" value={s.suspended_now} href="/admin/students?filter=suspended" />
      </div>

      <section className="card p-4">
        <h2 className="font-semibold">Club participation by grade</h2>
        <p className="mb-3 text-xs text-black/50">Share of each grade in at least one club. Grades are compared, never individual students.</p>
        <Bars
          rows={s.by_grade.map((g) => ({
            label: g.grade ? `Grade ${g.grade}` : "No grade",
            value: pct(g.in_club, g.total),
            max: 100,
            text: `${pct(g.in_club, g.total)}% (${g.in_club}/${g.total})`,
          }))}
        />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Biggest clubs <span className="font-normal text-black/45">(members)</span></h2>
        <Bars rows={s.top_clubs.map((c) => ({ label: `${c.emoji} ${c.name}`, value: c.members, max: topMax, text: String(c.members) }))} />
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Admin dashboard" />
      <AdminNav current="/admin" />
      <Suspense fallback={<PageSkeleton />}>
        <Dashboard />
      </Suspense>
    </>
  );
}
