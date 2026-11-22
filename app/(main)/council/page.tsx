import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, localParts, timeAgo, toLocalInput } from "@/lib/time";
import { getT } from "@/lib/i18n-server";
import { addCouncilMember, createElection, removeCouncilMember } from "@/app/actions/council";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { PageSkeleton } from "@/components/skeleton";
import { StudentPicker } from "@/components/student-picker";
import { SubmitButton } from "@/components/submit-button";
import { ContactForm, DeletePost, InfoForm, PostForm, ReplyForm } from "./council-forms";
import { Glyph } from "@/components/glyph";
import { ArrowRight, Lightbulb, MessageCircle, Pin } from "lucide-react";
import { startChat } from "@/app/actions/messages";
import { CampusScene } from "@/components/art/scenes";
import { Waves } from "@/components/shop/art";

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
    <div className="mx-auto max-w-5xl space-y-6" data-council-page data-wide>
      <section className="relative isolate overflow-hidden rounded-3xl border border-brand-700/10 bg-gradient-to-r from-sage-soft/80 via-brand-100/70 to-brand-50 px-6 py-7 lg:px-9 lg:py-9" data-banner data-council-banner>
        <Waves className="pointer-events-none absolute inset-0 -z-10 size-full opacity-70" />
        <CampusScene className="pointer-events-none absolute end-4 bottom-0 -z-10 hidden h-[105%] w-auto opacity-90 md:block" />
        <h1 className="font-heading text-[34px] leading-none font-semibold text-brand-900 lg:text-[52px]" data-banner-title>{t("Student Council")}</h1>
        <p className="mt-2 text-lg font-medium text-ink lg:text-2xl">{t("Your voice. Our mission.")}</p>
        <p className="mt-2 max-w-md text-sm text-ink-2 lg:text-base">{t("Representing students, driving change, and building a better school together.")}</p>
        <Link href="/suggestions" className="btn-primary mt-4 rounded-full px-5 py-2.5" data-send-suggestion><MessageCircle className="size-4" aria-hidden="true" />{t("Send a Suggestion")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></Link>
      </section>

      {(info?.about || info?.contact_email || info?.office || info?.meeting_info) && (
        <section className="card space-y-1.5 p-4 text-sm">
          {info.about && <p className="whitespace-pre-wrap">{info.about}</p>}
          {info.office && <p className="text-black/65"><Glyph e="📍" /> {info.office}</p>}
          {info.meeting_info && <p className="text-black/65"><Glyph e="🕒" /> {info.meeting_info}</p>}
          {info.contact_email && <p><a href={`mailto:${info.contact_email}`} className="text-brand-700 underline"><Glyph e="✉️" /> {info.contact_email}</a></p>}
        </section>
      )}

      <section data-section="members">
        <h2 className="mb-3 flex items-center gap-3 font-heading text-2xl font-semibold text-brand-900"><span className="h-7 w-1 rounded-full bg-brand-700" aria-hidden="true" />{t("Our Council Members")}</h2>
        {(members ?? []).length === 0 ? <Empty emoji="🗳️" title={t("No council members yet")} /> : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(members ?? []).map((m) => m.profile && (
              <li key={m.profile.id} className="card flex flex-col items-center gap-1 p-4 text-center" data-council-member={m.profile.id}>
                <Link href={`/profile/${m.profile.id}`} className="rounded-full" aria-label={m.profile.full_name}><Avatar avatar={m.profile.avatar} size="xl" /></Link>
                <p className="mt-1 text-[15px] font-semibold">{m.profile.full_name}</p>
                <p className="text-sm text-ink-2">{m.position}</p>
                {m.profile.id !== me.id && (
                  <form action={startChat} className="mt-2">
                    <input type="hidden" name="profileId" value={m.profile.id} />
                    <button className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft/70 px-4 py-1.5 text-sm font-medium text-brand-900 hover:bg-sage-soft"><MessageCircle className="size-4" aria-hidden="true" />{t("Message")}</button>
                  </form>
                )}
                {me.isAdmin && (
                  <ActionForm action={removeCouncilMember}>
                    <input type="hidden" name="profileId" value={m.profile.id} />
                    <SubmitButton className="text-xs text-black/40 hover:text-red-600" pendingText="…">{t("Remove")}</SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-3" data-section="news">
          <h2 className="flex items-center gap-3 font-heading text-2xl font-semibold text-brand-900"><span className="h-7 w-1 rounded-full bg-brand-700" aria-hidden="true" />{t("Latest News from the Council")}</h2>
          {(posts ?? []).length === 0 ? <Empty emoji="🗳️" title={t("Nothing posted yet")} /> : (posts ?? []).map((p) => (
            <article key={p.id} className="card flex gap-4 p-4 text-sm" data-council-post={p.id}>
              <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sand to-sage-soft/60 text-3xl text-brand-800 sm:size-24"><Glyph e={KIND[p.kind as keyof typeof KIND][0]} strokeWidth={1.3} /></span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-sage-soft/60">{t(KIND[p.kind as keyof typeof KIND][1])}</span>
                  {p.pinned && <span className="chip"><Pin className="size-3" aria-hidden="true" /></span>}
                  {p.status && <span className={`chip ${p.status === "done" ? "bg-brand-50 text-brand-800" : "bg-sky-50 text-sky-800"}`}>{t(STATUS[p.status as keyof typeof STATUS])}</span>}
                </div>
                <h3 className="text-[17px] leading-tight font-semibold">{p.title}</h3>
                {p.body && <p className="line-clamp-3 whitespace-pre-wrap text-ink-2">{p.body}</p>}
                <p className="flex items-center gap-2 text-xs text-black/45">{formatDate(p.created_at)} · {p.author?.full_name} · {timeAgo(p.created_at)}
                  {canPost && <span className="ms-auto"><DeletePost id={p.id} locale={locale} /></span>}</p>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-4">
          <section className="relative isolate overflow-hidden rounded-3xl border border-brand-700/10 bg-sage-soft/50 p-5" data-card="suggestion">
            <Lightbulb className="pointer-events-none absolute -end-2 top-3 -z-10 size-24 text-brand-800/20" strokeWidth={1.1} aria-hidden="true" />
            <h2 className="font-heading text-xl font-semibold text-brand-900">{t("Have a suggestion?")}</h2>
            <p className="mt-1 text-sm text-ink-2">{t("Share your ideas with the Student Council and help improve our school!")}</p>
            <Link href="/suggestions" className="btn-primary mt-4 w-full rounded-full"><MessageCircle className="size-4" aria-hidden="true" />{t("Send a Suggestion")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></Link>
          </section>
          <section className="card p-4" data-card="initiatives">
            <h2 className="font-heading text-xl font-semibold text-brand-900">{t("Upcoming Initiatives")}</h2>
            {(() => {
              const list = (posts ?? []).filter((p) => (p.kind === "initiative" || p.kind === "activity") && p.status !== "done").slice(0, 4);
              return list.length === 0 ? <p className="mt-2 text-sm text-ink-2">{t("No initiatives planned right now.")}</p> : (
                <ul className="mt-3 space-y-2">
                  {list.map((p) => {
                    const d = localParts(p.created_at);
                    return (
                      <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-cream/60 p-2.5">
                        <span className="w-12 shrink-0 rounded-xl bg-sage-soft/70 py-1 text-center text-brand-900"><span className="block text-[10px] font-semibold uppercase">{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.month - 1]}</span><span className="block text-lg leading-tight font-bold">{d.day}</span></span>
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{p.title}</span>{p.body && <span className="line-clamp-1 text-xs text-ink-2">{p.body}</span>}</span>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
          </section>
        </aside>
      </div>

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

      <section className="space-y-2">
        <h2 className="section-title">Elections</h2>
        {(elections ?? []).length === 0 ? <Empty emoji="🗳️" title="No elections yet" /> : (elections ?? []).map((e) => {
          const state = e.opens_at > now ? "upcoming" : e.closes_at > now ? "open" : "closed";
          return (
            <Link key={e.id} href={`/council/elections/${e.id}`} className="card flex items-center gap-3 p-4 hover:bg-black/[0.02]">
              <span className="text-2xl"><Glyph e="🗳️" /></span>
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
                <input name="position" required maxLength={60} placeholder="Position, e.g. Treasurer" className="input" aria-label="Position, e.g. Treasurer" />
                <input name="sort" type="number" min={0} max={99} placeholder="Order" className="input w-24" aria-label="Order" />
              </div>
              <SubmitButton className="btn-primary w-full">Add</SubmitButton>
            </ActionForm>
          </details>
          <details className="card p-4">
            <summary className="cursor-pointer font-semibold">Create an election</summary>
            <ActionForm action={createElection} className="mt-3 space-y-3">
              <input name="title" required minLength={3} maxLength={100} placeholder="e.g. Grade 11 representative" className="input" aria-label="e.g. Grade 11 representative" />
              <textarea name="description" rows={2} maxLength={1000} placeholder="What is this role?" className="input resize-none" aria-label="What is this role?" />
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
      <Suspense fallback={<PageSkeleton />}>
        <Council />
      </Suspense>
    </>
  );
}
