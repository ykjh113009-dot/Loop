import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, toLocalInput } from "@/lib/time";
import { addCouncilMember, createElection, removeCouncilMember } from "@/app/actions/council";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { StudentPicker } from "@/components/student-picker";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Student council" };

async function Council() {
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data: members }, { data: elections }] = await Promise.all([
    supabase.from("council_members").select("position, sort, profile:profiles(id, full_name, avatar, grade)").order("sort"),
    supabase.from("elections").select("id, title, opens_at, closes_at, eligible_grades").order("closes_at", { ascending: false }).limit(20),
  ]);
  const today = new Date();
  const now = today.toISOString();
  const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
  const nextWeek = new Date(today.getTime() + 7 * 24 * 3600 * 1000);

  return (
    <div className="space-y-5">
      <section>
        <h2 className="section-title">Council members</h2>
        {(members ?? []).length === 0 ? <Empty emoji="🗳️" title="No council members yet" /> : (
          <ul className="card divide-y divide-black/5">
            {(members ?? []).map((m) => m.profile && (
              <li key={m.profile.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/profile/${m.profile.id}`}><Avatar avatar={m.profile.avatar} /></Link>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.profile.full_name}</p>
                  <p className="text-xs text-black/50">{m.position} · Grade {m.profile.grade}</p>
                </div>
                {me.isAdmin && (
                  <ActionForm action={removeCouncilMember}>
                    <input type="hidden" name="profileId" value={m.profile.id} />
                    <SubmitButton className="text-xs text-black/40 hover:text-red-600" pendingText="…">Remove</SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
        <Link href="/suggestions" className="btn-secondary mt-3 w-full">💡 Send the council a suggestion</Link>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">Elections</h2>
        {(elections ?? []).length === 0 ? <Empty emoji="🗳️" title="No elections yet" /> : (elections ?? []).map((e) => {
          const state = e.opens_at > now ? "upcoming" : e.closes_at > now ? "open" : "closed";
          return (
            <Link key={e.id} href={`/council/elections/${e.id}`} className="card flex items-center gap-3 p-4 hover:bg-black/[0.02]">
              <span className="text-2xl">🗳️</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{e.title}</p>
                <p className="text-xs text-black/50">
                  {state === "upcoming" ? `Voting opens ${formatDateTime(e.opens_at)}` : state === "open" ? `Voting closes ${formatDateTime(e.closes_at)}` : `Closed ${formatDateTime(e.closes_at)}`}
                  {e.eligible_grades && ` · grade ${e.eligible_grades.join(", ")}`}
                </p>
              </div>
              <span className={`chip ${state === "open" ? "bg-brand-700 text-white" : ""}`}>
                {state === "open" ? "Vote now" : state === "upcoming" ? "Soon" : "Results"}
              </span>
            </Link>
          );
        })}
      </section>

      {me.isAdmin && (
        <section className="space-y-3">
          <h2 className="section-title">Admin tools</h2>
          <details className="card p-4">
            <summary className="cursor-pointer font-semibold">Add a council member</summary>
            <ActionForm action={addCouncilMember} className="mt-3 space-y-2">
              <StudentPicker />
              <div className="flex gap-2">
                <input name="position" required maxLength={60} placeholder="Position, e.g. Treasurer" className="input" />
                <input name="sort" type="number" min={0} max={99} placeholder="Order" className="input w-24" aria-label="Order" />
              </div>
              <SubmitButton className="btn-primary w-full">Add</SubmitButton>
            </ActionForm>
          </details>
          <details className="card p-4">
            <summary className="cursor-pointer font-semibold">Create an election</summary>
            <ActionForm action={createElection} className="mt-3 space-y-3">
              <input name="title" required minLength={3} maxLength={100} placeholder="e.g. Grade 11 representative" className="input" />
              <textarea name="description" rows={2} maxLength={1000} placeholder="What is this role?" className="input resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm"><span className="label">Voting opens</span>
                  <input name="opens_at" type="datetime-local" required defaultValue={toLocalInput(tomorrow)} className="input" />
                </label>
                <label className="text-sm"><span className="label">Voting closes</span>
                  <input name="closes_at" type="datetime-local" required defaultValue={toLocalInput(nextWeek)} className="input" />
                </label>
              </div>
              <fieldset>
                <legend className="label">Who can vote? (none ticked = everyone)</legend>
                <div className="flex gap-3">
                  {me.school.grades.map((g) => (
                    <label key={g} className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" name="grade" value={g} className="size-4 accent-brand-700" /> Grade {g}
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="text-xs text-black/50">Add candidates on the next page, before voting opens. Votes are secret and results show after voting closes.</p>
              <SubmitButton className="btn-primary w-full">Create election</SubmitButton>
            </ActionForm>
          </details>
        </section>
      )}
    </div>
  );
}

export default function CouncilPage() {
  return (
    <>
      <PageHeader title="Student council" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Council />
      </Suspense>
    </>
  );
}
