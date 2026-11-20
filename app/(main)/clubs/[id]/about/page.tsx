import { Suspense } from "react";
import { getClub } from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { setTaskStatus } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { PageSkeleton } from "@/components/skeleton";
import { Glyph } from "@/components/glyph";

async function About({ params }: { params: PageProps<"/clubs/[id]/about">["params"] }) {
  const { id } = await params;
  const { me, club, isMember } = await getClub(id);
  const supabase = await createClient();
  const [{ data: achievements }, { data: resources }, { data: sessions }, { data: tasks }, { data: attendance }] = await Promise.all([
    supabase.from("club_achievements").select("id, title, description, achieved_on").eq("club_id", club.id).eq("status", "approved").order("achieved_on", { ascending: false }),
    isMember ? supabase.from("club_resources").select("id, title, url, notes").eq("club_id", club.id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    isMember ? supabase.from("club_sessions").select("id, title, held_on").eq("club_id", club.id).order("held_on", { ascending: false }).limit(6) : Promise.resolve({ data: [] }),
    isMember ? supabase.from("club_tasks").select("id, title, status, due_on, assignee_id").eq("club_id", club.id).neq("status", "done").order("due_on", { nullsFirst: false }).limit(20) : Promise.resolve({ data: [] }),
    isMember ? supabase.from("club_attendance").select("session_id, present").eq("profile_id", me.id) : Promise.resolve({ data: [] }),
  ]);
  const went = new Map((attendance ?? []).map((a) => [a.session_id, a.present]));
  const mine = (tasks ?? []).filter((t) => t.assignee_id === me.id);

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="font-semibold"><Glyph e="🏆" /> Achievements</h2>
        {(achievements ?? []).length === 0 ? <p className="mt-1 text-sm text-black/55">No achievements yet.</p> : (
          <ul className="mt-2 divide-y divide-black/5 text-sm">
            {(achievements ?? []).map((a) => (
              <li key={a.id} className="py-2"><p className="font-medium">{a.title}</p>{a.description && <p className="text-black/60">{a.description}</p>}<p className="text-xs text-black/40">{formatDate(a.achieved_on)}</p></li>
            ))}
          </ul>
        )}
      </section>
      {isMember && (
        <>
          {mine.length > 0 && (
            <section className="card p-4">
              <h2 className="font-semibold">Your tasks</h2>
              <ul className="mt-2 divide-y divide-black/5 text-sm">
                {mine.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="min-w-0 flex-1">{t.title}{t.due_on && <span className="text-xs text-black/45"> · due {formatDate(t.due_on)}</span>}</span>
                    {(["todo", "doing", "done"] as const).map((st) => (
                      <ActionForm key={st} action={setTaskStatus}>
                        <input type="hidden" name="taskId" value={t.id} /><input type="hidden" name="status" value={st} />
                        <button className={`chip ${t.status === st ? "bg-brand-700 text-white" : ""}`}>{st === "todo" ? "To do" : st === "doing" ? "Doing" : "Done"}</button>
                      </ActionForm>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="card p-4">
            <h2 className="font-semibold">Meetings</h2>
            {(sessions ?? []).length === 0 ? <p className="mt-1 text-sm text-black/55">No meetings recorded yet.</p> : (
              <ul className="mt-2 divide-y divide-black/5 text-sm">
                {(sessions ?? []).map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2"><span>{s.title}</span>
                    <span className="text-xs text-black/50">{formatDate(s.held_on)} · {went.has(s.id) ? (went.get(s.id) ? "You were there" : "Absent") : "Not marked"}</span></li>
                ))}
              </ul>
            )}
          </section>
          <section className="card p-4">
            <h2 className="font-semibold">Resources</h2>
            {(resources ?? []).length === 0 ? <p className="mt-1 text-sm text-black/55">Nothing shared yet.</p> : (
              <ul className="mt-2 divide-y divide-black/5 text-sm">
                {(resources ?? []).map((r) => (
                  <li key={r.id} className="py-2">{r.url ? <a href={r.url} target="_blank" rel="noreferrer noopener" className="font-medium text-brand-700 underline">{r.title}</a> : <span className="font-medium">{r.title}</span>}{r.notes && <p className="text-black/60">{r.notes}</p>}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function ClubAboutPage(props: PageProps<"/clubs/[id]/about">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <About params={props.params} />
    </Suspense>
  );
}
