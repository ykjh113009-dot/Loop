import { ClubMark } from "@/components/club-mark";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { deletePoll } from "@/app/actions/polls";
import { VoteForm } from "@/components/vote-form";
import { PollResults } from "@/components/poll-results";

type Poll = {
  id: string;
  question: string;
  options: string[];
  closes_at: string;
  created_by: string | null;
  club: { id: string; name: string; emoji: string; image_path?: string | null } | null;
};

type Results = { show: boolean; total: number; mine: number | null; counts?: number[] };

export async function PollCard({ poll, canVote, canDelete }: { poll: Poll; canVote: boolean; canDelete: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("poll_results", { p_poll: poll.id });
  const r = (data as Results | null) ?? { show: false, total: 0, mine: null };
  const open = new Date(poll.closes_at) > new Date();

  return (
    <article className="space-y-3 rounded-3xl border border-brand-700/10 bg-white/85 p-5 shadow-[0_1px_2px_rgba(40,60,40,0.04)]">
      <div>
        <p className="text-xs text-black/45">
          {poll.club ? <><ClubMark club={poll.club} /> {poll.club.name}</> : "Whole school"} · {open ? `closes ${formatDateTime(poll.closes_at)}` : "closed"}
        </p>
        <h2 className="text-[17px] font-semibold">{poll.question}</h2>
      </div>
      {open && canVote && r.mine === null && <VoteForm pollId={poll.id} options={poll.options} />}
      {r.show && r.counts ? (
        <PollResults pollId={poll.id} options={poll.options} counts={r.counts} total={r.total} mine={r.mine} canChange={open && canVote && r.mine !== null} />
      ) : !(open && canVote) ? (
        <p className="text-sm text-black/50">Results appear when the poll closes.</p>
      ) : null}
      <div className="flex items-center justify-between text-xs text-black/45">
        <span>{r.total} {r.total === 1 ? "vote" : "votes"} · votes are private</span>
        {canDelete && (
          <form action={deletePoll}>
            <input type="hidden" name="id" value={poll.id} />
            <button className="hover:text-red-600">Delete</button>
          </form>
        )}
      </div>
    </article>
  );
}
