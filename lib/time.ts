// All times are shown in Palestine time, whatever the phone's settings.
export const TIME_ZONE = "Asia/Hebron";

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, ...options });

const dateTimeFmt = fmt({ weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const dateFmt = fmt({ weekday: "long", day: "numeric", month: "long" });
const shortDateFmt = fmt({ day: "numeric", month: "short" });
const timeFmt = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
const partsFmt = fmt({ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

/** "Sun 2 Nov, 14:00" */
export const formatDateTime = (d: string | Date) => dateTimeFmt.format(new Date(d));
/** "Sunday 2 November" */
export const formatDate = (d: string | Date) => dateFmt.format(new Date(d));
/** "2 Nov" */
export const formatShortDate = (d: string | Date) => shortDateFmt.format(new Date(d));
/** "14:00" */
export const formatTime = (d: string | Date) => timeFmt.format(new Date(d));

/** "5m", "3h", "2d" or a date for older things. */
export function timeAgo(d: string | Date, now = new Date()) {
  const seconds = Math.max(0, (now.getTime() - new Date(d).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`;
  return formatShortDate(d);
}

/** The year, month, day, hour and minute of a moment, in Palestine time. */
export function localParts(d: string | Date) {
  const parts = Object.fromEntries(partsFmt.formatToParts(new Date(d)).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/** "2026-11-02": the Palestine-time day a moment falls on. */
export function localDayKey(d: string | Date) {
  const p = localParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Value for an <input type="datetime-local">, e.g. "2026-11-02T14:00". */
export function toLocalInput(d: string | Date) {
  const p = localParts(d);
  return `${localDayKey(d)}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

// Minutes Palestine is ahead of UTC at a given moment (120 in winter, 180 in summer).
function offsetMinutes(at: Date) {
  const p = localParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** Turns "2026-11-02T14:00" typed by a student (Palestine time) into a real moment. */
export function fromLocalInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let result = new Date(guess - offsetMinutes(new Date(guess)) * 60000);
  // Check again in case the clocks change between the guess and the answer.
  result = new Date(guess - offsetMinutes(result) * 60000);
  return result;
}

/** Sunday 00:00 of this week, Palestine time (weeks start on Sunday). */
export function weekStart(now = new Date()) {
  const p = localParts(now);
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day));
  day.setUTCDate(day.getUTCDate() - day.getUTCDay());
  return fromLocalInput(`${day.toISOString().slice(0, 10)}T00:00`)!;
}
