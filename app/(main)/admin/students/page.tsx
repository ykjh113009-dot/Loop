import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin-nav";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Students" };

async function Students({ searchParams }: { searchParams: PageProps<"/admin/students">["searchParams"] }) {
  const me = await requireMe("admin");
  const supabase = await createClient();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 50) : "";
  const grade = typeof sp.grade === "string" ? Number(sp.grade) : null;
  const filter = typeof sp.filter === "string" ? sp.filter : "";

  let query = supabase
    .from("profiles")
    .select("id, full_name, avatar, grade, role, suspended_until, deactivated_at, onboarded_at, private:private_profiles(email)")
    .order("grade")
    .order("full_name")
    .limit(400);
  if (q) query = query.ilike("full_name", `%${q.replace(/[%_\\,()]/g, "")}%`);
  if (grade) query = query.eq("grade", grade);
  if (filter === "suspended") query = query.gt("suspended_until", new Date().toISOString());
  if (filter === "removed") query = query.not("deactivated_at", "is", null);
  else query = query.is("deactivated_at", null);
  if (filter === "staff") query = query.in("role", ["moderator", "admin"]);
  const { data } = await query;
  const students = data ?? [];

  const chip = (label: string, params: Record<string, string>) => {
    const href = `/admin/students?${new URLSearchParams(params)}`;
    const active = (params.filter ?? "") === filter && (params.grade ?? "") === (grade ? String(grade) : "");
    return <Link key={label} href={href} className={`chip shrink-0 ${active ? "bg-brand-700 text-white" : ""}`}>{label}</Link>;
  };

  return (
    <div className="space-y-3">
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search by name" className="input" aria-label="Search" />
        <button className="btn-primary">Search</button>
      </form>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {chip("Everyone", {})}
        {me.school.grades.map((g) => chip(`Grade ${g}`, { grade: String(g) }))}
        {chip("Moderators & admins", { filter: "staff" })}
        {chip("Suspended", { filter: "suspended" })}
        {chip("Removed", { filter: "removed" })}
      </div>
      <p className="text-xs text-black/50">{students.length} shown</p>
      {students.length === 0 ? (
        <Empty emoji="🔍" title="Nobody found" />
      ) : (
        <ul className="card divide-y divide-black/5">
          {students.map((s) => {
            const suspended = s.suspended_until && new Date(s.suspended_until) > new Date();
            return (
              <li key={s.id}>
                <Link href={`/admin/students/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02]">
                  <Avatar avatar={s.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.full_name}</p>
                    <p className="truncate text-xs text-black/45">{s.private?.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
                    <span className="text-black/60">{s.grade ? `Grade ${s.grade}` : "No grade"}</span>
                    {s.role !== "student" && <span className="font-semibold text-brand-700">{s.role}</span>}
                    {suspended && <span className="font-semibold text-red-700">suspended</span>}
                    {!s.onboarded_at && <span className="text-amber-700">not set up</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminStudentsPage(props: PageProps<"/admin/students">) {
  return (
    <>
      <PageHeader title="Students" />
      <AdminNav current="/admin/students" />
      <Suspense fallback={<PageSkeleton />}>
        <Students searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
