import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatShortDate, timeAgo } from "@/lib/time";
import { moderateReport, reviewChallenge, reviewClub, reviewEvent, reviewHours, suspendStudent } from "@/app/actions/moderation";
import { signImages } from "@/lib/images";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Moderation" };

const REASONS: Record<string, string> = {
  bullying: "Bullying",
  harassment: "Harassment",
  inappropriate: "Inappropriate",
  spam: "Spam",
  self_harm: "⚠️ Someone may need help",
  other: "Other",
  filter: "🤖 Bad-word filter",
};
const TARGETS: Record<string, string> = {
  post: "Post",
  message: "Message",
  profile: "Profile",
  club: "Club",
  event: "Event",
  listing: "Listing",
  question: "Question",
  answer: "Answer",
};

type Report = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string;
  snapshot: string;
  admin_only: boolean;
  created_at: string;
  reporter: { full_name: string } | null;
  author: { id: string; full_name: string; avatar: string; grade: number | null; role: string; suspended_until: string | null } | null;
};

async function Reports() {
  const me = await requireMe("staff");
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select(
      "id, target_type, target_id, reason, details, snapshot, admin_only, created_at, reporter:profiles!reports_reporter_id_fkey(full_name), author:profiles!reports_target_author_id_fkey(id, full_name, avatar, grade, role, suspended_until)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: true });

  // Several people may report the same thing: show it once.
  const groups = new Map<string, Report[]>();
  for (const r of (data ?? []) as Report[]) {
    const key = `${r.target_type}:${r.target_id}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const sorted = [...groups.values()].sort(
    (a, b) => Number(b.some((r) => r.reason === "self_harm")) - Number(a.some((r) => r.reason === "self_harm")),
  );
  if (sorted.length === 0) return <Empty emoji="✅" title="No open reports">Everything has been reviewed. Nice work!</Empty>;

  return (
    <div className="space-y-3">
      {sorted.map((group) => {
        const first = group[0];
        const urgent = group.some((r) => r.reason === "self_harm");
        const author = first.author;
        const canSuspend = author && author.id !== me.id && (me.isAdmin || author.role === "student");
        const removable = first.target_type !== "profile";
        return (
          <article key={first.id} className={`card space-y-3 p-4 ${urgent ? "border-2 border-red-500" : ""}`}>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="chip">{TARGETS[first.target_type]}</span>
              {[...new Set(group.map((r) => r.reason))].map((reason) => (
                <span key={reason} className={`chip ${reason === "self_harm" ? "bg-red-100 text-red-800" : ""}`}>{REASONS[reason]}</span>
              ))}
              {first.admin_only && <span className="chip bg-purple-50 text-purple-800">Private message · admins only</span>}
              <span className="ml-auto text-black/40">{timeAgo(first.created_at)}</span>
            </div>

            {author && (
              <Link href={`/profile/${author.id}`} className="flex items-center gap-2 text-sm">
                <Avatar avatar={author.avatar} size="sm" />
                <span className="font-semibold">{author.full_name}</span>
                <span className="text-black/45">Grade {author.grade}</span>
                {author.suspended_until && new Date(author.suspended_until) > new Date() && (
                  <span className="chip bg-red-50 text-red-700">Suspended</span>
                )}
              </Link>
            )}
            <blockquote className="rounded-xl bg-black/[0.04] px-3 py-2 text-sm whitespace-pre-wrap">{first.snapshot || "(empty)"}</blockquote>

            <ul className="space-y-1 text-xs text-black/60">
              {group.map((r) => (
                <li key={r.id}>
                  <strong>{r.reporter?.full_name ?? "Automatic"}</strong>: {REASONS[r.reason]}
                  {r.details && ` — “${r.details}”`}
                </li>
              ))}
            </ul>
            {urgent && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                Please make sure a trusted adult at school (a counselor or teacher) knows about this today.
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-black/5 pt-3">
              <ActionForm action={moderateReport}>
                <input type="hidden" name="reportId" value={first.id} />
                <input type="hidden" name="action" value="dismiss" />
                <SubmitButton className="btn-secondary px-3 py-2" pendingText="…">
                  {first.reason === "filter" ? "It's fine — show it" : "No problem — dismiss"}
                </SubmitButton>
              </ActionForm>
              <ActionForm action={moderateReport}>
                <input type="hidden" name="reportId" value={first.id} />
                <input type="hidden" name="action" value="remove" />
                <SubmitButton className={removable ? "btn-danger px-3 py-2" : "btn-secondary px-3 py-2"} pendingText="…">
                  {removable ? `Remove ${TARGETS[first.target_type].toLowerCase()}` : "Mark as handled"}
                </SubmitButton>
              </ActionForm>
            </div>

            {canSuspend && (
              <details className="text-sm">
                <summary className="cursor-pointer text-black/60">Suspend {author.full_name.split(" ")[0]}…</summary>
                <ActionForm action={suspendStudent} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="profileId" value={author.id} />
                  <select name="days" className="input w-auto" aria-label="How long">
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    {me.isAdmin && <option value="permanent">Until an admin lifts it</option>}
                  </select>
                  <input name="reason" required maxLength={200} placeholder="Reason (the student sees this)" className="input min-w-40 flex-1" />
                  <SubmitButton className="btn-danger" pendingText="…">Suspend</SubmitButton>
                </ActionForm>
              </details>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ReviewButtons({ action, idName, id }: { action: typeof reviewClub; idName: string; id: string }) {
  return (
    <ActionForm action={action} className="flex flex-wrap gap-2 border-t border-black/5 pt-3">
      <input type="hidden" name={idName} value={id} />
      <input name="note" maxLength={300} placeholder="Note (optional, sent if you say no)" className="input min-w-40 flex-1 text-sm" />
      <SubmitButton name="decision" value="approve" className="btn-primary px-3 py-2" pendingText="…">Approve</SubmitButton>
      <SubmitButton name="decision" value="reject" className="btn-secondary px-3 py-2" pendingText="…">Say no</SubmitButton>
    </ActionForm>
  );
}

async function Approvals() {
  await requireMe("staff");
  const supabase = await createClient();
  const [{ data: clubs }, { data: events }, { data: submissions }, { data: hours }] = await Promise.all([
    supabase
      .from("clubs")
      .select("id, name, emoji, description, created_at, requester:profiles!clubs_requested_by_fkey(id, full_name, grade)")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("events")
      .select("id, title, description, location, starts_at, club:clubs(name, emoji), creator:profiles!events_created_by_fkey(id, full_name)")
      .eq("status", "pending")
      .order("starts_at"),
    supabase
      .from("challenge_submissions")
      .select("id, note, image_path, created_at, challenge:challenges(title, emoji, points), student:profiles!challenge_submissions_profile_id_fkey(id, full_name, grade)")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("volunteer_entries")
      .select("id, organization, description, activity_date, hours, supervisor_name, student:profiles!volunteer_entries_profile_id_fkey(id, full_name, grade)")
      .eq("status", "pending")
      .order("created_at"),
  ]);
  if (!clubs?.length && !events?.length && !submissions?.length && !hours?.length) {
    return <Empty emoji="✅" title="Nothing waiting for approval" />;
  }
  const photos = await signImages(supabase, (submissions ?? []).map((x) => x.image_path));

  return (
    <div className="space-y-6">
      {!!clubs?.length && (
        <section className="space-y-3">
          <h2 className="section-title">Club requests</h2>
          {clubs.map((c) => (
            <article key={c.id} className="card space-y-2 p-4">
              <p className="font-semibold">{c.emoji} {c.name}</p>
              <p className="text-sm whitespace-pre-wrap text-black/70">{c.description}</p>
              <p className="text-xs text-black/45">
                Requested by {c.requester?.full_name} (grade {c.requester?.grade}) · {timeAgo(c.created_at)}
              </p>
              <ReviewButtons action={reviewClub} idName="clubId" id={c.id} />
            </article>
          ))}
        </section>
      )}
      {!!events?.length && (
        <section className="space-y-3">
          <h2 className="section-title">Event requests</h2>
          {events.map((e) => (
            <article key={e.id} className="card space-y-2 p-4">
              <Link href={`/events/${e.id}`} className="font-semibold hover:underline">{e.title}</Link>
              <p className="text-sm text-black/70">
                {formatDateTime(e.starts_at)}{e.location && ` · ${e.location}`} · {e.club?.emoji} {e.club?.name}
              </p>
              {e.description && <p className="text-sm whitespace-pre-wrap text-black/60">{e.description}</p>}
              <p className="text-xs text-black/45">Suggested by {e.creator?.full_name}</p>
              <ReviewButtons action={reviewEvent} idName="eventId" id={e.id} />
            </article>
          ))}
        </section>
      )}
      {!!submissions?.length && (
        <section className="space-y-3">
          <h2 className="section-title">Challenge entries</h2>
          {submissions.map((x) => (
            <article key={x.id} className="card space-y-2 p-4">
              <p className="text-sm">
                <strong>{x.student?.full_name}</strong> <span className="text-black/45">(grade {x.student?.grade}) · {x.challenge?.emoji} {x.challenge?.title} · +{x.challenge?.points}</span>
              </p>
              <p className="text-sm whitespace-pre-wrap text-black/75">{x.note}</p>
              {x.image_path && photos.get(x.image_path) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photos.get(x.image_path)!} alt="" loading="lazy" className="max-h-56 rounded-xl object-cover" />
              )}
              <ReviewButtons action={reviewChallenge} idName="id" id={x.id} />
            </article>
          ))}
        </section>
      )}
      {!!hours?.length && (
        <section className="space-y-3">
          <h2 className="section-title">Volunteering hours</h2>
          {hours.map((h) => (
            <article key={h.id} className="card space-y-1 p-4 text-sm">
              <p>
                <strong>{h.student?.full_name}</strong> <span className="text-black/45">(grade {h.student?.grade})</span> ·{" "}
                <strong>{Number(h.hours)} h</strong> at {h.organization}
              </p>
              <p className="text-black/55">{formatShortDate(h.activity_date)}{h.supervisor_name && ` · supervisor: ${h.supervisor_name}`}</p>
              {h.description && <p className="text-black/70">{h.description}</p>}
              <ReviewButtons action={reviewHours} idName="id" id={h.id} />
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

const ACTIONS: Record<string, string> = {
  approve_club: "approved club",
  reject_club: "said no to club",
  archive_club: "closed club",
  approve_event: "approved event",
  reject_event: "said no to event",
  cancel_event: "cancelled event",
  reschedule_event: "moved event",
  remove_content: "removed a",
  dismiss_report: "dismissed a report on a",
  suspend: "suspended",
  unsuspend: "lifted suspension of",
  change_grade: "changed grade of",
  change_role: "changed role of",
  remove_account: "removed account of",
  restore_account: "restored account of",
  approve_challenge: "approved a challenge entry for",
  reject_challenge: "said no to a challenge entry for",
  approve_hours: "approved volunteering hours:",
  reject_hours: "said no to volunteering hours:",
  set_alumni: "marked as alumni mentor:",
  unset_alumni: "marked as current student:",
};

async function Log() {
  await requireMe("staff");
  const supabase = await createClient();
  const { data } = await supabase
    .from("moderation_log")
    .select("id, action, target_type, details, created_at, actor:profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!data?.length) return <Empty emoji="📜" title="Nothing here yet" />;
  return (
    <ul className="card divide-y divide-black/5 text-sm">
      {data.map((l) => (
        <li key={l.id} className="px-4 py-2.5">
          <span className="font-semibold">{l.actor?.full_name ?? "System"}</span>{" "}
          {ACTIONS[l.action] ?? l.action}
          {(l.action === "remove_content" || l.action === "dismiss_report") && ` ${l.target_type}`}
          {l.details && <span className="text-black/60"> · {l.details}</span>}
          <span className="block text-xs text-black/40">{formatDateTime(l.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

const TABS = [
  { id: "reports", label: "Reports" },
  { id: "approvals", label: "Approvals" },
  { id: "log", label: "History" },
];

async function Moderation({ searchParams }: { searchParams: PageProps<"/moderation">["searchParams"] }) {
  const { tab: raw } = await searchParams;
  const tab = TABS.some((t) => t.id === raw) ? (raw as string) : "reports";
  return (
    <>
      <div className="mb-4 flex gap-1 rounded-xl bg-black/5 p-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/moderation?tab=${t.id}`}
            className={`flex-1 rounded-lg py-1.5 text-center text-sm font-medium ${tab === t.id ? "bg-white shadow-sm" : "text-black/55"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {tab === "reports" && <Reports />}
      {tab === "approvals" && <Approvals />}
      {tab === "log" && <Log />}
    </>
  );
}

export default function ModerationPage(props: PageProps<"/moderation">) {
  return (
    <>
      <PageHeader title="Moderation" />
      <Suspense fallback={<PageSkeleton />}>
        <Moderation searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
