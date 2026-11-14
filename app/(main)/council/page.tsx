import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, timeAgo, toLocalInput } from "@/lib/time";
import { getT } from "@/lib/i18n-server";
import { addCouncilMember, createElection, removeCouncilMember } from "@/app/actions/council";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { StudentPicker } from "@/components/student-picker";
import { SubmitButton } from "@/components/submit-button";
import { ContactForm, DeletePost, InfoForm, PostForm, ReplyForm } from "./council-forms";

export const metadata = { title: "Student council" };

async function Council() {
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const [{ data: canPost }, { data: info }, { data: posts }, { data: messages }] = await Promise.all([
    supabase.rpc("can_post_council"),
    supabase.from("council_info").select("about, contact_email, office, meeting_info").maybeSingle(),
    supabase.from("council_posts").select("id, kind, title, body, status, pinned, created_at, author:profiles!council_posts_created_by_fkey(full_name)").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(40),
    supabase.from("council_messages").select("id, subject, body, status, reply, replied_at, created_at, sender_id, sender:profiles!council_messages_sender_id_fkey(full_name, grade)").order("created_at", { ascending: false }).limit(40),
  ]);
  const myMessages = (messages ?? []).filter((m) => m.sender_id === me.id);
  const inbox = canPost ? (messages ?? []).filter((m) => m.sender_id !== me.id) : [];
  const KIND = { announcement: ["📢", "Announcement"], update: ["📰", "Update"], initiative: ["🌱", "Initiative"], activity: ["🎈", "Activity"] } as const;
  const STATUS = { planned: "Planned", in_progress: "In progress", done: "Done" } as const;
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
      {(info?.about || info?.contact_email || info?.office || info?.meeting_info) && (
        <section className="card space-y-1.5 p-4 text-sm">
          {info.about && <p className="whitespace-pre-wrap">{info.about}</p>}
          {info.office && <p className="text-black/65">📍 {info.office}</p>}
          {info.meeting_info && <p className="text-black/65">🕒 {info.meeting_info}</p>}
          {info.contact_email && <p><a href={`mailto:${info.contact_email}`} className="text-brand-700 underline">✉️ {info.contact_email}</a></p>}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-title">{t("News from the council")}</h2>
        {(posts ?? []).length === 0 ? <Empty emoji="🗳️" title={t("Nothing posted yet")} /> : (posts ?? []).map((p) => (
          <article key={p.id} className="card space-y-1.5 p-4 text-sm">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 font-semibold">{KIND[p.kind as keyof typeof KIND][0]} {p.title}{p.pinned && <span className="chip ms-2 bg-amber-50 text-amber-800">📌</span>}</p>
              {p.status && <span className={`chip shrink-0 ${p.status === "done" ? "bg-brand-50 text-brand-800" : "bg-sky-50 text-sky-800"}`}>{t(STATUS[p.status as keyof typeof STATUS])}</span>}
            </div>
            {p.body && <p className="whitespace-pre-wrap text-black/75">{p.body}</p>}
            <p className="flex items-center gap-2 text-xs text-black/45">{t(KIND[p.kind as keyof typeof KIND][1])} · {p.author?.full_name} · {timeAgo(p.created_at)}
              {canPost && <span className="ms-auto"><DeletePost id={p.id} locale={locale} /></span>}</p>
          </article>
        ))}
      </section>

      {me.isStudent && !me.isSuspended && (
        <section className="space-y-2">
          <h2 className="section-title">{t("Talk to the council")}</h2>
          <div className="card p-4"><ContactForm locale={locale} /></div>
          {myMessages.map((m) => (
            <article key={m.id} className="card space-y-1 p-4 text-sm">
              <p className="font-semibold">{m.subject} <span className="text-xs font-normal text-black/45">· {timeAgo(m.created_at)}</span></p>
              <p className="whitespace-pre-wrap text-black/70">{m.body}</p>
              {m.reply ? <p className="rounded-xl bg-brand-50 p-3 text-brand-900"><strong>{t("Council")}:</strong> {m.reply}</p> : <p className="text-xs text-black/45">{m.status === "closed" ? t("Closed") : t("Waiting for a reply")}</p>}
            </article>
          ))}
        </section>
      )}

      {canPost && (
        <section className="space-y-3">
          <h2 className="section-title">{t("Council tools")}</h2>
          <details className="card p-4"><summary className="cursor-pointer font-semibold">{t("Post news")}</summary><div className="mt-3"><PostForm locale={locale} /></div></details>
          <details className="card p-4"><summary className="cursor-pointer font-semibold">{t("Contact details")}</summary><div className="mt-3"><InfoForm locale={locale} info={info ?? { about: "", contact_email: "", office: "", meeting_info: "" }} /></div></details>
          <details className="card p-4" open={inbox.some((m) => m.status === "new")}>
            <summary className="cursor-pointer font-semibold">{t("Messages from students")} ({inbox.filter((m) => m.status === "new").length} {t("new")})</summary>
            <div className="mt-3 space-y-3">
              {inbox.length === 0 && <p className="text-sm text-black/50">{t("No messages.")}</p>}
              {inbox.map((m) => (
                <article key={m.id} className="space-y-1 rounded-xl border border-black/10 p-3 text-sm">
                  <p className="font-semibold">{m.subject} <span className="text-xs font-normal text-black/45">· {m.sender?.full_name} · {timeAgo(m.created_at)}</span></p>
                  <p className="whitespace-pre-wrap text-black/70">{m.body}</p>
                  {m.reply ? <p className="rounded-lg bg-brand-50 p-2 text-brand-900">{m.reply}</p> : m.status === "closed" ? <p className="text-xs text-black/45">{t("Closed")}</p> : <ReplyForm id={m.id} locale={locale} />}
                </article>
              ))}
            </div>
          </details>
        </section>
      )}

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
