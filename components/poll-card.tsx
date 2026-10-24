import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { deletePoll } from "@/app/actions/polls";
import { VoteForm } from "@/components/vote-form";

type Poll = {
  id: string;
  question: string;
  options: string[];
  closes_at: string;
  created_by: string | null;
  club: { name: string; emoji: string } | null;
};

type Results = { show: boolean; total: number; mine: number | null; counts?: number[] };

export async function PollCard({ poll, canVote, canDelete }: { poll: Poll; canVote: boolean; canDelete: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("poll_results", { p_poll: poll.id });
  const r = (data as Results | null) ?? { show: false, total: 0, mine: null };
  const open = new Date(poll.closes_at) > new Date();

  return (
    <article className="card space-y-3 p-4">
      <div>
        <p className="text-xs text-black/45">
          {poll.club ? `${poll.club.emoji} ${poll.club.name}` : "🏫 Whole school"} · {open ? `closes ${formatDateTime(poll.closes_at)}` : "closed"}
        </p>
        <h2 className="font-semibold">{poll.question}</h2>
      </div>
      {r.show && r.counts ? (
        <ul className="space-y-2">
          {poll.options.map((option, i) => {
            const n = r.counts![i] ?? 0;
            const pct = r.total ? Math.round((n / r.total) * 100) : 0;
            return (
              <li key={i} className="text-sm">
                <div className="flex justify-between">
                  <span className={r.mine === i ? "font-semibold" : ""}>{option}{r.mine === i && " ✓"}</span>
                  <span className="tabular-nums text-black/60">{pct}% ({n})</span>
                </div>
                <div className="mt-1 h-2.5 rounded-full bg-black/[0.06]">
                  <div className={`h-2.5 rounded-full ${r.mine === i ? "bg-brand-700" : "bg-brand-500/60"}`} style={{ width: `${Math.max(1, pct)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : open && canVote ? (
        <VoteForm pollId={poll.id} options={poll.options} />
      ) : (
        <p className="text-sm text-black/50">Results appear when the poll closes.</p>
      )}
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
