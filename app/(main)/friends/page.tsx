import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { personLabel } from "@/lib/people";
import { cancelFriendRequest, respondFriendRequest } from "@/app/actions/social";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Friends" };
const PERSON = "id, full_name, avatar, grade, role, alumni_year";

async function Friends() {
  const me = await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const [{ data: incoming }, { data: outgoing }] = await Promise.all([
    supabase.from("friend_requests").select(`id, created_at, p:profiles!friend_requests_from_id_fkey(${PERSON})`).eq("to_id", me.id).eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("friend_requests").select(`id, created_at, p:profiles!friend_requests_to_id_fkey(${PERSON})`).eq("from_id", me.id).eq("status", "pending").order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t("Friends")} action={<Link href={`/profile/${me.id}/connections?tab=friends`} className="btn-secondary px-3 py-2">{t("My friends")}</Link>} />
      <section className="card p-4">
        <h2 className="font-semibold">{t("Friend requests")} <span className="font-normal text-black/45">({(incoming ?? []).length})</span></h2>
        {(incoming ?? []).length === 0 && <p className="mt-1 text-sm text-black/55">{t("No requests waiting.")}</p>}
        <ul className="mt-2 divide-y divide-black/5">
          {(incoming ?? []).map((r) => r.p && (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <Link href={`/profile/${r.p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar avatar={r.p.avatar} size="md" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.p.full_name}</span>
                  <span className="block text-xs text-black/50">{personLabel(r.p)}</span>
                </span>
              </Link>
              <ActionForm action={respondFriendRequest} className="flex gap-2">
                <input type="hidden" name="requestId" value={r.id} />
                <SubmitButton name="decision" value="accept" className="btn-primary px-3 py-2" pendingText="…">{t("Accept")}</SubmitButton>
                <SubmitButton name="decision" value="reject" className="btn-secondary px-3 py-2" pendingText="…">{t("Decline")}</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      </section>

      {(outgoing ?? []).length > 0 && (
        <section className="card p-4">
          <h2 className="font-semibold">{t("Requests you sent")}</h2>
          <ul className="mt-2 divide-y divide-black/5">
            {(outgoing ?? []).map((r) => r.p && (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <Link href={`/profile/${r.p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar avatar={r.p.avatar} size="md" />
                  <span className="truncate font-medium">{r.p.full_name}</span>
                </Link>
                <ActionForm action={cancelFriendRequest}>
                  <input type="hidden" name="requestId" value={r.id} />
                  <SubmitButton className="btn-secondary px-3 py-2" pendingText="…">{t("Cancel")}</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-center text-sm">
        <Link href="/people" className="font-semibold text-brand-700 hover:underline">{t("Find students")}</Link>
      </p>
    </div>
  );
}

export default function FriendsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Friends />
    </Suspense>
  );
}
