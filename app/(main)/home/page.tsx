import { Suspense } from "react";
import { CardSkeleton } from "@/components/dashboard/card";
import { Announcements } from "@/components/dashboard/announcements";
import { CommunityFeed } from "@/components/dashboard/community-feed";
import { Featured } from "@/components/dashboard/featured";
import { Greeting } from "@/components/dashboard/greeting";
import { LeaderboardCard } from "@/components/dashboard/leaderboard-card";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { NextUp } from "@/components/dashboard/next-up";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { QuickChats } from "@/components/dashboard/quick-chats";
import { RecentChats } from "@/components/dashboard/recent-chats";
import { StudentCouncil } from "@/components/dashboard/student-council";
import { UpcomingActivities } from "@/components/dashboard/upcoming-activities";
import { WeekEvents } from "@/components/dashboard/week-events";
import "@/components/dashboard/dashboard.css";

export const metadata = { title: "Home" };

// Each block loads on its own, so the page appears at once and fills in.
export default function HomePage() {
  return (
    <div data-wide className="dash">
      <div className="dash-main">
        <div className="dash-greet">
          <Suspense fallback={<div className="card h-[104px] animate-pulse" />}>
            <Greeting />
          </Suspense>
        </div>
        <div className="dash-actions"><QuickActions /></div>
        <div className="dash-chats">
          <Suspense fallback={<CardSkeleton />}><RecentChats /></Suspense>
        </div>
        <div className="dash-announce">
          <Suspense fallback={<CardSkeleton />}><Announcements /></Suspense>
        </div>
        <div className="dash-feed">
          <Suspense fallback={<CardSkeleton rows={4} />}><CommunityFeed /></Suspense>
        </div>
        <div className="dash-calendar">
          <Suspense fallback={<CardSkeleton rows={4} />}><MiniCalendar /></Suspense>
        </div>
        <div className="dash-week">
          <Suspense fallback={<CardSkeleton />}><WeekEvents /></Suspense>
        </div>
        <div className="dash-next">
          <Suspense fallback={<CardSkeleton rows={2} />}><NextUp /></Suspense>
        </div>
        <div className="dash-featured"><Featured /></div>
      </div>
      <div className="dash-side">
        <div className="dash-upcoming">
          <Suspense fallback={<CardSkeleton />}><UpcomingActivities /></Suspense>
        </div>
        <div className="dash-leader">
          <Suspense fallback={<CardSkeleton rows={4} />}><LeaderboardCard /></Suspense>
        </div>
        <div className="dash-quick">
          <Suspense fallback={<CardSkeleton rows={4} />}><QuickChats /></Suspense>
        </div>
        <div className="dash-council">
          <Suspense fallback={<CardSkeleton rows={2} />}><StudentCouncil /></Suspense>
        </div>
      </div>
    </div>
  );
}
