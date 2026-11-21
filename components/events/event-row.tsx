"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarPlus, Check, Clock, Info, MapPin, Share2, Users, X } from "lucide-react";
import { joinEvent, leaveEvent } from "@/app/actions/events";
import { ClubMark } from "@/components/club-mark";
import { Glyph } from "@/components/glyph";
import { formatTime, localParts } from "@/lib/time";
import { eventCategory } from "@/lib/events";
import type { EventSummary } from "@/lib/queries";
import { makeT, type Locale } from "@/lib/i18n";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export type EventWithText = EventSummary & { description?: string | null };

function DateTile({ iso, cancelled, big = false }: { iso: string; cancelled: boolean; big?: boolean }) {
  const p = localParts(iso);
  return (
    <div className={`shrink-0 rounded-2xl text-center ${big ? "w-[4.5rem] py-2" : "w-14 py-1.5"} ${cancelled ? "bg-black/5 text-black/40" : "bg-sage-soft/70 text-brand-900"}`}>
      <div className={`${big ? "text-sm" : "text-[11px]"} font-semibold uppercase`}>{MONTHS[p.month - 1]}</div>
      <div className={`${big ? "text-3xl" : "text-xl"} leading-tight font-bold`}>{p.day}</div>
    </div>
  );
}

// One event in a list. Tapping it opens a small popup with the details and a way to add it to my calendar (I'm going).
export function EventRow({ event, rsvp, canRsvp, locale }: { event: EventWithText; rsvp: "going" | "waitlist" | null; canRsvp: boolean; locale: Locale }) {
  const t = makeT(locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const [shared, setShared] = useState(false);
  const [joinState, join, joining] = useActionState(joinEvent, null);
  const [leaveState, leave, leaving] = useActionState(leaveEvent, null);
  const total = event.event_rsvps?.[0]?.count ?? 0;
  const full = !!event.capacity && total >= event.capacity;
  const cancelled = event.status === "cancelled";
  const pending = event.status === "pending";
  const cat = event.category && event.category !== "other" ? eventCategory(event.category) : null;
  const time = event.ends_at ? `${formatTime(event.starts_at)} – ${formatTime(event.ends_at)}` : formatTime(event.starts_at);
  const busy = joining || leaving;
  const message = joinState?.error ?? leaveState?.error ?? joinState?.message;

  async function share() {
    const url = `${window.location.origin}/events/${event.id}`;
    try {
      if (navigator.share) await navigator.share({ title: event.title, url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 2000); }
    } catch { /* the person closed the share sheet */ }
  }

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="card flex w-full items-center gap-4 p-3.5 text-start transition-colors hover:bg-sage-soft/20" data-event-row={event.id}>
        <DateTile iso={event.starts_at} cancelled={cancelled} />
        <span className="h-12 w-px shrink-0 bg-black/10" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[17px] font-semibold ${cancelled ? "text-black/40 line-through" : "text-brand-900"}`}>{event.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-2">
            <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden="true" />{formatTime(event.starts_at)}</span>
            {event.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden="true" />{event.location}</span>}
            {event.club && <span className="inline-flex items-center gap-1.5"><Users className="size-4" aria-hidden="true" />{event.club.name}</span>}
          </span>
        </span>
        <span className="shrink-0 text-end text-xs">
          {cancelled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700"><X className="size-4" aria-hidden="true" />{t("Cancelled")}</span>
          ) : pending ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft px-3 py-1.5 text-sm font-medium text-ink"><Clock className="size-4 text-gold" aria-hidden="true" />{t("Waiting for approval")}</span>
          ) : (
            <>
              <span className="font-semibold text-black/70">{event.capacity ? Math.min(total, event.capacity) : total}</span> <span className="text-black/45">{full ? `· ${t("full")}` : t("going")}</span>
              {rsvp && <span className="mt-0.5 flex items-center justify-end gap-1 font-semibold text-brand-700"><Check className="size-3.5" aria-hidden="true" />{t("You")}</span>}
            </>
          )}
        </span>
      </button>

      <dialog ref={dialog} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }} className="m-auto w-[min(94vw,40rem)] overflow-hidden rounded-3xl border border-brand-700/10 bg-cream p-0 text-ink shadow-2xl backdrop:bg-black/40" aria-label={event.title} data-event-dialog>
        <div className="relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-sage-soft to-brand-200/60 text-brand-800/60">
          <Glyph e={cat?.emoji ?? "📅"} className="!size-16" strokeWidth={1.1} />
          <button type="button" onClick={() => dialog.current?.close()} className="absolute end-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/90 text-ink shadow hover:bg-white" aria-label={t("Close")}><X className="size-5" aria-hidden="true" /></button>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <DateTile iso={event.starts_at} cancelled={cancelled} big />
            <div className="min-w-0">
              <h2 className="font-heading text-2xl leading-tight font-semibold text-brand-900">{event.title}</h2>
              {cat && <p className="text-ink-2">{t(cat.label)}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-black/10 pb-4 text-[15px]">
            <span className="inline-flex items-center gap-2"><Clock className="size-[18px] text-ink-2" aria-hidden="true" />{time}</span>
            {event.location && <span className="inline-flex items-center gap-2"><MapPin className="size-[18px] text-ink-2" aria-hidden="true" />{event.location}</span>}
            {event.club && <span className="inline-flex items-center gap-2"><Users className="size-[18px] text-ink-2" aria-hidden="true" /><ClubMark club={event.club} className="size-5" />{event.club.name}</span>}
          </div>
          {(cancelled || pending) && (
            <p className={`rounded-xl px-3 py-2 text-sm font-medium ${cancelled ? "bg-red-50 text-red-700" : "bg-gold-soft text-ink"}`}>{cancelled ? t("This event was cancelled.") : t("This event is waiting for approval.")}</p>
          )}
          {event.description && (
            <div>
              <h3 className="flex items-center gap-2 font-semibold"><Info className="size-[18px]" aria-hidden="true" />{t("About the Event")}</h3>
              <p className="mt-1.5 line-clamp-5 whitespace-pre-wrap text-[15px] text-ink-2">{event.description}</p>
            </div>
          )}
          {message && <p role="status" className={`text-sm ${joinState?.error || leaveState?.error ? "text-red-700" : "text-brand-800"}`}>{message}</p>}
          <div className="flex flex-wrap items-center gap-3">
            {canRsvp && !cancelled && !pending && (rsvp ? (
              <form action={leave}><input type="hidden" name="id" value={event.id} />
                <button disabled={busy} className="btn-secondary rounded-full px-5 py-3" data-leave-event><CalendarCheck className="size-[18px]" aria-hidden="true" />{rsvp === "going" ? t("You're going · Cancel") : t("On the waiting list · Leave")}</button>
              </form>
            ) : (
              <form action={join}><input type="hidden" name="id" value={event.id} />
                <button disabled={busy} className="btn-primary rounded-full px-6 py-3" data-add-calendar><CalendarPlus className="size-[18px]" aria-hidden="true" />{busy ? "…" : full ? t("Join the waiting list") : t("Add to My Calendar")}</button>
              </form>
            ))}
            <button type="button" onClick={share} className="btn-secondary rounded-full px-6 py-3" data-share-event><Share2 className="size-[18px]" aria-hidden="true" />{shared ? t("Link copied") : t("Share Event")}</button>
          </div>
          <Link href={`/events/${event.id}`} className="inline-block text-sm font-medium text-brand-700 underline" data-event-full>{t("Open the full event page")}</Link>
        </div>
      </dialog>
    </>
  );
}
