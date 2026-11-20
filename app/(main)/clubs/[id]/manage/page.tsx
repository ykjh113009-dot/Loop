import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getClub } from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import {
  addBudgetEntry, addClubProject, addClubSession, addClubTask, addResource, deleteClubItem, proposeAchievement,
  removeClubMember, reviewClubApplication, setAttendance, setMemberTitle, updateClubSettings,
} from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { signClubImages } from "@/lib/images";
import { ClubImageField } from "./club-image-field";
import { PageSkeleton } from "@/components/skeleton";
import { IconPicker } from "@/components/icon-picker";

export const metadata = { title: "Manage club" };

const TABS = [["overview", "Overview"], ["members", "Members"], ["sessions", "Meetings"], ["tasks", "Tasks"], ["budget", "Budget"], ["resources", "Resources"], ["achievements", "Achievements"]] as const;

function Del({ table, id }: { table: string; id: string }) {
  return (
    <ActionForm action={deleteClubItem}>
      <input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={id} />
      <SubmitButton className="btn-ghost px-2 py-0.5 text-xs text-red-700" pendingText="…">Delete</SubmitButton>
    </ActionForm>
  );
}

type Analytics = { members: number; new_members_30d: number; pending_applications: number; posts_30d: number; sessions_90d: number; attendance_rate: number | null; tasks_open: number; tasks_done: number; upcoming_events: number; achievements: number; budget_balance: number };

async function Manage({ params, searchParams }: { params: PageProps<"/clubs/[id]/manage">["params"]; searchParams: PageProps<"/clubs/[id]/manage">["searchParams"] }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const { me, club, isLeader } = await getClub(id);
  if (!isLeader && !me.isAdmin) redirect(`/clubs/${id}`);
  const tab = TABS.find(([k]) => k === rawTab)?.[0] ?? "overview";
  const supabase = await createClient();
  const cid = club.id;
  const imageUrl = club.image_path ? (await signClubImages(supabase, [club.image_path])).get(club.image_path) ?? null : null;

  const { data: members } = await supabase.from("club_members").select("role, title, joined_at, profile:profiles(id, full_name, avatar, grade)").eq("club_id", cid).order("joined_at");
  const people = (members ?? []).filter((m) => m.profile);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-black/5 p-1" role="tablist">
        {TABS.map(([k, label]) => (
          <Link key={k} role="tab" aria-selected={tab === k} href={`/clubs/${cid}/manage?tab=${k}`} className={`shrink-0 flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap ${tab === k ? "bg-brand-700 text-white shadow-sm" : "text-black/55 hover:bg-sage-soft/60"}`}>{label}</Link>
        ))}
      </div>

      {tab === "overview" && await (async () => {
        const { data } = await supabase.rpc("club_analytics", { p_club: cid });
        const a = data as unknown as Analytics;
        const tiles: [string, string | number][] = [
          ["Members", a.members], ["New in 30 days", a.new_members_30d], ["Applications waiting", a.pending_applications], ["Posts in 30 days", a.posts_30d],
          ["Meetings in 90 days", a.sessions_90d], ["Attendance", a.attendance_rate === null ? "-" : `${a.attendance_rate}%`],
          ["Tasks open", a.tasks_open], ["Tasks done", a.tasks_done], ["Upcoming events", a.upcoming_events], ["Achievements", a.achievements], ["Budget balance", Number(a.budget_balance).toFixed(2)],
        ];
        return (
          <>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="analytics">
              {tiles.map(([label, v]) => <div key={label} className="card p-3"><p className="text-xs text-black/50">{label}</p><p className="text-xl font-bold tabular-nums">{v}</p></div>)}
            </section>
            <section className="card p-4"><ClubImageField clubId={cid} schoolId={club.school_id} emoji={club.emoji} url={imageUrl} /></section>
            <ActionForm action={updateClubSettings} className="card space-y-3 p-4">
              <input type="hidden" name="clubId" value={cid} />
              <h2 className="font-semibold">Club settings</h2>
              <div className="space-y-3">
                <IconPicker defaultValue={club.emoji} />
                <select name="recruiting" defaultValue={club.recruiting} className="input" aria-label="How people join">
                  <option value="open">Open: anyone can join</option>
                  <option value="application">By application: you accept members</option>
                  <option value="closed">Closed: not taking members</option>
                </select>
              </div>
              <textarea name="description" defaultValue={club.description} maxLength={500} rows={3} className="input resize-none" aria-label="Description" />
              <input name="question" defaultValue={club.application_question} maxLength={200} placeholder="Question for applicants (optional)" className="input" aria-label="Question for applicants" />
              <SubmitButton className="btn-primary w-full">Save</SubmitButton>
              <p className="text-xs text-black/50">Club leaders are given by a Super Admin. Ask them to change who leads the club.</p>
            </ActionForm>
          </>
        );
      })()}

      {tab === "members" && await (async () => {
        const { data: apps } = await supabase.from("club_applications").select("id, message, created_at, profile:profiles!club_applications_profile_id_fkey(id, full_name, avatar, grade)").eq("club_id", cid).eq("status", "pending").order("created_at");
        return (
          <>
            <section className="card p-4">
              <h2 className="font-semibold">Applications <span className="font-normal text-black/45">({(apps ?? []).length})</span></h2>
              {(apps ?? []).length === 0 && <p className="mt-1 text-sm text-black/55">No applications waiting.</p>}
              <ul className="mt-2 divide-y divide-black/5">
                {(apps ?? []).map((a) => a.profile && (
                  <li key={a.id} className="space-y-1.5 py-3" data-application={a.id}>
                    <div className="flex items-center gap-3"><Avatar avatar={a.profile.avatar} size="sm" /><Link href={`/profile/${a.profile.id}`} className="font-medium hover:underline">{a.profile.full_name}</Link>{a.profile.grade && <span className="text-xs text-black/45">Grade {a.profile.grade}</span>}</div>
                    {a.message && <p className="text-sm whitespace-pre-wrap text-black/70">{a.message}</p>}
                    <ActionForm action={reviewClubApplication} className="flex gap-2">
                      <input type="hidden" name="applicationId" value={a.id} />
                      <SubmitButton name="decision" value="approve" className="btn-primary px-3 py-1.5" pendingText="…">Accept</SubmitButton>
                      <SubmitButton name="decision" value="reject" className="btn-secondary px-3 py-1.5" pendingText="…">Decline</SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card p-4">
              <h2 className="font-semibold">Team roles</h2>
              <p className="text-xs text-black/50">Give a role such as Treasurer, Media or Coach. It shows next to the name.</p>
              <ul className="mt-2 divide-y divide-black/5">
                {people.map((m) => (
                  <li key={m.profile!.id} className="flex flex-wrap items-center gap-2 py-2">
                    <Avatar avatar={m.profile!.avatar} size="sm" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{m.profile!.full_name}{m.role === "leader" && <span className="chip ms-2 bg-brand-50 text-brand-800">Leader</span>}</span>
                    <ActionForm action={setMemberTitle} className="flex gap-1.5">
                      <input type="hidden" name="clubId" value={cid} /><input type="hidden" name="profileId" value={m.profile!.id} />
                      <input name="title" defaultValue={m.title} maxLength={40} placeholder="Role" aria-label={`Role for ${m.profile!.full_name}`} className="input w-32 py-1.5 text-sm" />
                      <SubmitButton className="btn-secondary px-2.5 py-1 text-xs" pendingText="…">Save</SubmitButton>
                    </ActionForm>
                    {m.role !== "leader" && (
                      <ActionForm action={removeClubMember}>
                        <input type="hidden" name="clubId" value={cid} /><input type="hidden" name="profileId" value={m.profile!.id} />
                        <SubmitButton className="btn-ghost px-2 py-1 text-xs text-red-700" pendingText="…">Remove</SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        );
      })()}

      {tab === "sessions" && await (async () => {
        const [{ data: sessions }, { data: att }] = await Promise.all([
          supabase.from("club_sessions").select("id, title, held_on, notes").eq("club_id", cid).order("held_on", { ascending: false }).limit(15),
          supabase.from("club_attendance").select("session_id, profile_id, present").eq("club_id", cid),
        ]);
        const mark = new Map((att ?? []).map((a) => [`${a.session_id}:${a.profile_id}`, a.present]));
        return (
          <>
            <ActionForm action={addClubSession} className="card space-y-2 p-4">
              <input type="hidden" name="clubId" value={cid} />
              <h2 className="font-semibold">Record a meeting</h2>
              <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
                <input name="title" required minLength={2} maxLength={100} placeholder="What did you do?" className="input" aria-label="Meeting title" />
                <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" aria-label="Date" />
              </div>
              <input name="notes" maxLength={500} placeholder="Notes (optional)" className="input" aria-label="Notes" />
              <SubmitButton className="btn-primary w-full">Add meeting</SubmitButton>
            </ActionForm>
            {(sessions ?? []).map((s) => (
              <details key={s.id} className="card p-4" data-session={s.id}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2"><span><strong>{s.title}</strong> <span className="text-xs text-black/45">· {formatDate(s.held_on)}</span></span>
                  <span className="text-xs text-black/50">{people.filter((m) => mark.get(`${s.id}:${m.profile!.id}`)).length}/{people.length} present</span></summary>
                <ul className="mt-3 divide-y divide-black/5">
                  {people.map((m) => {
                    const v = mark.get(`${s.id}:${m.profile!.id}`);
                    return (
                      <li key={m.profile!.id} className="flex items-center gap-2 py-1.5 text-sm">
                        <span className="min-w-0 flex-1 truncate">{m.profile!.full_name}</span>
                        {([true, false] as const).map((val) => (
                          <ActionForm key={String(val)} action={setAttendance}>
                            <input type="hidden" name="sessionId" value={s.id} /><input type="hidden" name="profileId" value={m.profile!.id} /><input type="hidden" name="present" value={String(val)} />
                            <button className={`chip ${v === val ? (val ? "bg-brand-700 text-white" : "bg-red-600 text-white") : ""}`} aria-label={`${m.profile!.full_name} ${val ? "present" : "absent"}`}>{val ? "Present" : "Absent"}</button>
                          </ActionForm>
                        ))}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2 text-end"><Del table="club_sessions" id={s.id} /></div>
              </details>
            ))}
          </>
        );
      })()}

      {tab === "tasks" && await (async () => {
        const [{ data: projects }, { data: tasks }] = await Promise.all([
          supabase.from("club_projects").select("id, name, description, status").eq("club_id", cid).order("created_at", { ascending: false }),
          supabase.from("club_tasks").select("id, title, status, due_on, project_id, assignee:profiles!club_tasks_assignee_id_fkey(full_name)").eq("club_id", cid).order("created_at", { ascending: false }).limit(60),
        ]);
        return (
          <>
            <ActionForm action={addClubProject} className="card flex flex-wrap gap-2 p-4">
              <input type="hidden" name="clubId" value={cid} />
              <input name="name" required minLength={2} maxLength={80} placeholder="New project" aria-label="Project name" className="input min-w-40 flex-1" />
              <input name="description" maxLength={500} placeholder="What is it?" aria-label="Project description" className="input min-w-40 flex-1" />
              <SubmitButton className="btn-primary" pendingText="…">Add project</SubmitButton>
            </ActionForm>
            <ActionForm action={addClubTask} className="card space-y-2 p-4">
              <input type="hidden" name="clubId" value={cid} />
              <h2 className="font-semibold">New task</h2>
              <input name="title" required minLength={2} maxLength={120} placeholder="What needs doing?" aria-label="Task" className="input" />
              <div className="grid gap-2 sm:grid-cols-3">
                <select name="assignee" className="input" aria-label="Give to" defaultValue=""><option value="">Nobody yet</option>{people.map((m) => <option key={m.profile!.id} value={m.profile!.id}>{m.profile!.full_name}</option>)}</select>
                <select name="project" className="input" aria-label="Project" defaultValue=""><option value="">No project</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <input name="due" type="date" className="input" aria-label="Due date" />
              </div>
              <SubmitButton className="btn-primary w-full">Add task</SubmitButton>
            </ActionForm>
            {(projects ?? []).length > 0 && (
              <section className="card p-4"><h2 className="font-semibold">Projects</h2>
                <ul className="mt-2 divide-y divide-black/5 text-sm">{(projects ?? []).map((p) => <li key={p.id} className="flex items-center justify-between gap-2 py-2"><span><strong>{p.name}</strong> {p.description && <span className="text-black/55">· {p.description}</span>}</span><Del table="club_projects" id={p.id} /></li>)}</ul></section>
            )}
            <section className="card p-4"><h2 className="font-semibold">Tasks</h2>
              {(tasks ?? []).length === 0 && <p className="mt-1 text-sm text-black/55">No tasks yet.</p>}
              <ul className="mt-2 divide-y divide-black/5 text-sm">
                {(tasks ?? []).map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 py-2" data-task={t.id}>
                    <span className={`chip ${t.status === "done" ? "bg-brand-50 text-brand-800" : t.status === "doing" ? "bg-amber-50 text-amber-900" : ""}`}>{t.status === "todo" ? "To do" : t.status === "doing" ? "Doing" : "Done"}</span>
                    <span className="min-w-0 flex-1">{t.title}{t.assignee && <span className="text-black/50"> · {t.assignee.full_name}</span>}{t.due_on && <span className="text-xs text-black/45"> · due {formatDate(t.due_on)}</span>}</span>
                    <Del table="club_tasks" id={t.id} />
                  </li>
                ))}
              </ul>
            </section>
          </>
        );
      })()}

      {tab === "budget" && await (async () => {
        const { data: rows } = await supabase.from("club_budget").select("id, kind, amount, description, entry_date").eq("club_id", cid).order("entry_date", { ascending: false }).limit(60);
        const balance = (rows ?? []).reduce((s, r) => s + (r.kind === "income" ? Number(r.amount) : -Number(r.amount)), 0);
        return (
          <>
            <div className="card flex items-center justify-between p-4"><span className="text-sm text-black/55">Balance (only leaders and admins see this)</span><strong className="text-2xl tabular-nums" data-testid="balance">{balance.toFixed(2)}</strong></div>
            <ActionForm action={addBudgetEntry} className="card space-y-2 p-4">
              <input type="hidden" name="clubId" value={cid} />
              <div className="grid gap-2 sm:grid-cols-[8rem_8rem_1fr]">
                <select name="kind" className="input" aria-label="Type" defaultValue="expense"><option value="income">Money in</option><option value="expense">Money out</option></select>
                <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Amount" aria-label="Amount" className="input" />
                <input name="description" required minLength={2} maxLength={120} placeholder="What for?" aria-label="What for?" className="input" />
              </div>
              <SubmitButton className="btn-primary w-full">Add entry</SubmitButton>
            </ActionForm>
            <ul className="card divide-y divide-black/5 text-sm">
              {(rows ?? []).map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-4 py-2"><span className="min-w-0 flex-1 truncate">{r.description}</span><span className="text-xs text-black/45">{formatDate(r.entry_date)}</span>
                  <strong className={`tabular-nums ${r.kind === "income" ? "text-brand-700" : "text-red-700"}`}>{r.kind === "income" ? "+" : "-"}{Number(r.amount).toFixed(2)}</strong><Del table="club_budget" id={r.id} /></li>
              ))}
              {(rows ?? []).length === 0 && <li className="px-4 py-3 text-black/55">No entries yet.</li>}
            </ul>
          </>
        );
      })()}

      {tab === "resources" && await (async () => {
        const { data: rows } = await supabase.from("club_resources").select("id, title, url, notes").eq("club_id", cid).order("created_at", { ascending: false });
        return (
          <>
            <ActionForm action={addResource} className="card space-y-2 p-4">
              <input type="hidden" name="clubId" value={cid} />
              <h2 className="font-semibold">Share a resource</h2>
              <input name="title" required minLength={2} maxLength={100} placeholder="Title" aria-label="Title" className="input" />
              <input name="url" type="url" pattern="https://.*" maxLength={300} placeholder="https:// link (optional)" aria-label="Link" className="input" />
              <input name="notes" maxLength={300} placeholder="Notes (optional)" aria-label="Notes" className="input" />
              <SubmitButton className="btn-primary w-full">Share with members</SubmitButton>
            </ActionForm>
            <ul className="card divide-y divide-black/5 text-sm">
              {(rows ?? []).map((r) => <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2"><span className="min-w-0 truncate font-medium">{r.title}{r.url && <span className="text-black/45"> · {new URL(r.url).hostname}</span>}</span><Del table="club_resources" id={r.id} /></li>)}
              {(rows ?? []).length === 0 && <li className="px-4 py-3 text-black/55">Nothing shared yet.</li>}
            </ul>
          </>
        );
      })()}

      {tab === "achievements" && await (async () => {
        const { data: rows } = await supabase.from("club_achievements").select("id, title, description, achieved_on, status, points_each").eq("club_id", cid).order("created_at", { ascending: false });
        return (
          <>
            <ActionForm action={proposeAchievement} className="card space-y-2 p-4">
              <input type="hidden" name="clubId" value={cid} />
              <h2 className="font-semibold">Add an achievement</h2>
              <p className="text-xs text-black/50">An admin or school staff checks it before it is shown. They may give every member points.</p>
              <input name="title" required minLength={3} maxLength={100} placeholder="What did the club achieve?" aria-label="Achievement" className="input" />
              <textarea name="description" maxLength={500} rows={2} placeholder="Details (optional)" aria-label="Details" className="input resize-none" />
              <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" aria-label="Date" />
              <SubmitButton className="btn-primary w-full">Send for checking</SubmitButton>
            </ActionForm>
            <ul className="card divide-y divide-black/5 text-sm">
              {(rows ?? []).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-2"><span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
                  <span className={`chip ${a.status === "approved" ? "bg-brand-50 text-brand-800" : a.status === "pending" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-800"}`}>{a.status === "pending" ? "Waiting" : a.status === "approved" ? `Approved${a.points_each ? ` · +${a.points_each} each` : ""}` : "Not approved"}</span></li>
              ))}
              {(rows ?? []).length === 0 && <li className="px-4 py-3 text-black/55">No achievements yet.</li>}
            </ul>
          </>
        );
      })()}
    </div>
  );
}

export default function ManageClubPage(props: PageProps<"/clubs/[id]/manage">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Manage params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
