import { Suspense } from "react";
import { HomeHero } from "@/components/home/hero";
import { QuickPills } from "@/components/home/quick-pills";
import { HomeFeed } from "@/components/home/feed";
import { MyCalendar } from "@/components/home/my-calendar";
import { HomeLeaderboard } from "@/components/home/leaderboard";
import { Shortcuts } from "@/components/home/shortcuts";

export const metadata = { title: "Home" };

const Block = ({ h = "h-40", children }: { h?: string; children: React.ReactNode }) => <Suspense fallback={<div className={`${h} animate-pulse rounded-2xl bg-white/60`} />}>{children}</Suspense>;

// Each block loads on its own, so the page appears at once and fills in.
export default function HomePage(props: PageProps<"/home">) {
  return (
    <div data-wide className="space-y-4" data-home>
      <Block h="h-[150px]"><HomeHero /></Block>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
        <div className="min-w-0 space-y-4">
          <Block h="h-12"><QuickPills /></Block>
          <Block h="h-96"><FeedLoader searchParams={props.searchParams} /></Block>
        </div>
        <div className="min-w-0 space-y-4">
          <Block h="h-56"><MyCalendar /></Block>
          <Block h="h-56"><HomeLeaderboard /></Block>
        </div>
      </div>
      <Block h="h-40"><Shortcuts /></Block>
    </div>
  );
}

async function FeedLoader({ searchParams }: { searchParams: PageProps<"/home">["searchParams"] }) {
  const { show } = await searchParams;
  return <HomeFeed show={typeof show === "string" ? show : undefined} />;
}
