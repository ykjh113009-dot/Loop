import { Suspense } from "react";
import Link from "next/link";
import { getClub } from "@/lib/clubs";
import { joinClub, leaveClub } from "@/app/actions/clubs";
import { Icon } from "@/components/icons";
import { ReportButton } from "@/components/report-button";
import { SubmitButton } from "@/components/submit-button";
import { ClubTabs } from "./club-tabs";

async function ClubHeader({ params }: { params: LayoutProps<"/clubs/[id]">["params"] }) {
  const { id } = await params;
  const { me, club, memberCount, isMember, isLeader } = await getClub(id);
  const closed = club.status !== "approved";

  return (
    <div className="mb-4">
      <Link href="/clubs" className="-ml-2 inline-flex items-center rounded-full p-2 text-sm text-black/60 hover:bg-black/5">
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
            <form action={isMember ? leaveClub : joinClub} className="mt-3">
              <input type="hidden" name="clubId" value={club.id} />
              {isMember ? (
                <SubmitButton className="btn-secondary w-full" pendingText="Leaving…">✓ Joined · Leave club</SubmitButton>
              ) : (
                <SubmitButton className="btn-primary w-full" pendingText="Joining…">Join club</SubmitButton>
              )}
            </form>
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
