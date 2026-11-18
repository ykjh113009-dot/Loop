import { Suspense } from "react";
import { HomeHero } from "@/components/home/hero";
import { QuickPills } from "@/components/home/quick-pills";
import { LatestFromLoop } from "@/components/home/latest";
import { MyCalendar } from "@/components/home/my-calendar";
import { HomeLeaderboard } from "@/components/home/leaderboard";
import { ResourcesMini } from "@/components/home/resources-mini";
import { RewardsCard } from "@/components/home/rewards-card";

export const metadata = { title: "Home" };

const Block = ({ h = "h-40", children }: { h?: string; children: React.ReactNode }) => <Suspense fallback={<div className={`${h} animate-pulse rounded-2xl bg-white/60`} />}>{children}</Suspense>;

// Each block loads on its own, so the page appears at once and fills in.
export default function HomePage() {
  return (
    <div data-wide className="space-y-4" data-home>
      <Block h="h-[210px]"><HomeHero /></Block>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
        <div className="min-w-0 space-y-4">
          <Block h="h-12"><QuickPills /></Block>
          <Block h="h-72"><LatestFromLoop /></Block>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Block h="h-40"><ResourcesMini /></Block>
            <Block h="h-40"><RewardsCard /></Block>
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          <Block h="h-56"><MyCalendar /></Block>
          <Block h="h-56"><HomeLeaderboard /></Block>
        </div>
      </div>
    </div>
  );
}
