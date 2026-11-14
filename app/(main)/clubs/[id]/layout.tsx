import { Suspense } from "react";
import Link from "next/link";
import { getClub } from "@/lib/clubs";
import { joinClub, leaveClub } from "@/app/actions/clubs";
import { applyToClub, withdrawApplication } from "@/app/actions/community";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { ReportButton } from "@/components/report-button";
import { SubmitButton } from "@/components/submit-button";
import { ClubTabs } from "./club-tabs";

async function ClubHeader({ params }: { params: LayoutProps<"/clubs/[id]">["params"] }) {
  const { id } = await params;
  const { me, club, memberCount, isMember, isLeader } = await getClub(id);
  const closed = club.status !== "approved";
  const supabase = await createClient();
  const { data: application } = isMember ? { data: null } : await supabase.from("club_applications").select("id").eq("club_id", club.id).eq("profile_id", me.id).eq("status", "pending").maybeSingle();

  return (
    <div className="mb-4">
      <Link href="/clubs" className="-ms-2 inline-flex items-center rounded-full p-2 text-sm text-black/60 hover:bg-black/5">
        <Icon name="back" className="size-4" /> Clubs
      </Link>
      <div className="card mt-1 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-3xl">{club.emoji}</div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg leading-tight font-bold">{club.name}</h1>
            <p className="text-sm text-black/55">
              {memberCount} {memberCount === 1 ? "member" : "members"}
              {isLeader && " · You lead this club"}
              {club.recruiting === "application" && " · By application"}
              {club.recruiting === "closed" && " · Not taking members"}
            </p>
          </div>
          <ReportButton targetType="club" targetId={club.id} compact />
        </div>
        <p className="mt-3 text-sm whitespace-pre-wrap text-black/75">{club.description}</p>
        {closed ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {club.status === "pending" ? "This club is waiting for a moderator's approval." : "This club is closed."}
          </p>
        ) : (
          !me.isSuspended && (
            <div className="mt-3 space-y-2">
              {(isLeader || me.isAdmin) && (
                <Link href={`/clubs/${club.id}/manage`} className="btn-secondary w-full">⚙️ Manage club</Link>
              )}
              {isMember ? (
                <form action={leaveClub}>
                  <input type="hidden" name="clubId" value={club.id} />
                  <SubmitButton className="btn-secondary w-full" pendingText="Leaving…">✓ Joined · Leave club</SubmitButton>
                </form>
              ) : club.recruiting === "open" ? (
                <form action={joinClub}>
                  <input type="hidden" name="clubId" value={club.id} />
                  <SubmitButton className="btn-primary w-full" pendingText="Joining…">Join club</SubmitButton>
                </form>
              ) : club.recruiting === "application" && me.isStudent ? (
                application ? (
                  <ActionForm action={withdrawApplication} className="flex items-center gap-2">
                    <input type="hidden" name="applicationId" value={application.id} />
                    <span className="chip flex-1 justify-center bg-amber-50 py-2 text-amber-900">Application sent</span>
                    <SubmitButton className="btn-ghost" pendingText="…">Withdraw</SubmitButton>
                  </ActionForm>
                ) : (
                  <details className="rounded-xl border border-brand-700/10 p-3">
                    <summary className="cursor-pointer text-center font-semibold text-brand-700">Apply to join</summary>
                    <ActionForm action={applyToClub} className="mt-3 space-y-2">
                      <input type="hidden" name="clubId" value={club.id} />
                      <label className="block text-sm"><span className="label">{club.application_question || "Why do you want to join?"}</span>
                        <textarea name="message" maxLength={800} rows={3} className="input resize-none" /></label>
                      <SubmitButton className="btn-primary w-full" pendingText="Sending…">Send application</SubmitButton>
                    </ActionForm>
                  </details>
                )
              ) : null}
            </div>
          )
        )}
        {!closed && <ClubTabs clubId={club.id} />}
      </div>
    </div>
  );
}

export default function ClubLayout({ children, params }: LayoutProps<"/clubs/[id]">) {
  return (
    <>
      <Suspense fallback={<div className="card mb-4 h-44 animate-pulse" />}>
        <ClubHeader params={params} />
      </Suspense>
      {children}
    </>
  );
}
