import Link from "next/link";
import { formatTime, localParts } from "@/lib/time";
import type { EventSummary } from "@/lib/queries";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function EventCard({ event, going = false }: { event: EventSummary; going?: boolean }) {
  const p = localParts(event.starts_at);
  const count = event.event_rsvps?.[0]?.count ?? 0;
  const cancelled = event.status === "cancelled";
  return (
    <Link href={`/events/${event.id}`} className="card flex items-center gap-3 p-3 hover:bg-black/[0.02]">
      <div className={`w-12 shrink-0 rounded-xl py-1 text-center ${cancelled ? "bg-black/5 text-black/40" : "bg-brand-50 text-brand-800"}`}>
        <div className="text-[11px] font-semibold uppercase">{MONTHS[p.month - 1]}</div>
        <div className="text-lg leading-tight font-bold">{p.day}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold ${cancelled ? "text-black/40 line-through" : ""}`}>{event.title}</p>
        <p className="truncate text-xs text-black/55">
          {formatTime(event.starts_at)}
          {event.location && ` · ${event.location}`}
          {event.club && ` · ${event.club.emoji} ${event.club.name}`}
        </p>
      </div>
      <div className="shrink-0 text-right text-xs">
        {cancelled ? (
          <span className="chip bg-red-50 text-red-700">Cancelled</span>
        ) : event.status === "pending" ? (
          <span className="chip bg-amber-50 text-amber-800">Waiting for approval</span>
        ) : (
          <>
            <span className="font-semibold text-black/70">{count}</span> <span className="text-black/45">going</span>
            {going && <span className="mt-0.5 block font-semibold text-brand-700">✓ You</span>}
          </>
        )}
      </div>
    </Link>
  );
}
