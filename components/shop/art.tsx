import { Banknote, BookOpen, Gamepad2, Gift, Headphones, Laptop, Music, Package, Popcorn, Sparkles, Tablet, Ticket, Trophy, GraduationCap, type LucideIcon } from "lucide-react";
import { createElement } from "react";

const GOLD = "#c9a24a";
const GOLD_DARK = "#a9852f";
const SAGE = "#b9c79e";
const SAGE_SOFT = "#dde6cc";
const SAND = "#efe2c8";

// Soft abstract waves that sit behind a banner. Muted sage and sand, never a solid green block.
export function Waves({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M0 200V120q70-60 140-30t130-10q70 30 130-30v150z" fill={SAGE_SOFT} opacity=".7" />
      <path d="M0 200v-50q80-40 160-10t140-6q60 10 100-20v86z" fill={SAGE} opacity=".35" />
      <path d="M0 40q60 30 120 0T260 30t140-10V0H0z" fill={SAND} opacity=".6" />
    </svg>
  );
}

// A gold trophy with laurel leaves and sparkles.
export function TrophyScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 170" className={className} role="img" aria-label="A gold trophy">
      <ellipse cx="100" cy="156" rx="64" ry="8" fill={SAGE_SOFT} />
      <g fill="none" stroke={SAGE} strokeWidth="2.4" strokeLinecap="round">
        <path d="M44 128C26 108 26 72 46 50" /><path d="M156 128c18-20 18-56-2-78" />
      </g>
      {[[34, 100], [30, 82], [36, 64], [46, 50]].map(([x, y], i) => <ellipse key={`l${i}`} cx={x} cy={y} rx="8" ry="4" transform={`rotate(-40 ${x} ${y})`} fill={SAGE} opacity=".8" />)}
      {[[166, 100], [170, 82], [164, 64], [154, 50]].map(([x, y], i) => <ellipse key={`r${i}`} cx={x} cy={y} rx="8" ry="4" transform={`rotate(40 ${x} ${y})`} fill={SAGE} opacity=".8" />)}
      <path d="M70 34h60v34c0 22-13 36-30 36S70 90 70 68z" fill={GOLD} />
      <path d="M70 34h60v10H70z" fill={GOLD_DARK} opacity=".35" />
      <path d="M70 44c-18 0-24 8-22 18s12 20 26 22M130 44c18 0 24 8 22 18s-12 20-26 22" fill="none" stroke={GOLD} strokeWidth="6" strokeLinecap="round" />
      <path d="M84 40c0 24 4 44 16 52" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="5" strokeLinecap="round" />
      <rect x="94" y="102" width="12" height="20" fill={GOLD_DARK} />
      <path d="M78 122h44l4 14H74z" fill={GOLD} />
      <rect x="68" y="136" width="64" height="12" rx="3" fill="#3b4a34" />
      <rect x="68" y="136" width="64" height="4" rx="2" fill="#fff" opacity=".15" />
      {[[30, 34, 1.1], [172, 28, 0.9], [150, 130, 0.7]].map(([x, y, k], i) => (
        <path key={i} d={`M${x} ${y - 7 * k}l${1.8 * k} ${5.2 * k} ${5.2 * k} ${1.8 * k}-${5.2 * k} ${1.8 * k}-${1.8 * k} ${5.2 * k}-${1.8 * k}-${5.2 * k}-${5.2 * k}-${1.8 * k} ${5.2 * k}-${1.8 * k}z`} fill={GOLD} opacity=".9" />
      ))}
    </svg>
  );
}

const CATEGORY_ICON: Record<string, LucideIcon> = { gift_cards: Gift, technology: Laptop, study: BookOpen, experiences: Ticket, other: Sparkles };
export const CATEGORY_LABEL: Record<string, string> = { gift_cards: "Gift Cards", technology: "Technology", study: "Study", experiences: "Experiences", other: "Other" };
export const CATEGORIES = ["gift_cards", "technology", "study", "experiences"] as const;

// A line icon for a prize, chosen from its name. Only used when no picture has been uploaded.
export function prizeIconFor(title: string, category?: string): LucideIcon {
  const t = title.toLowerCase();
  if (/macbook|laptop|computer/.test(t)) return Laptop;
  if (/ipad|tablet/.test(t)) return Tablet;
  if (/airpods|headphone|earbud/.test(t)) return Headphones;
  if (/sat|exam|refund|tuition|course/.test(t)) return GraduationCap;
  if (/cinema|movie|ticket/.test(t)) return Popcorn;
  if (/playstation|gaming|game|xbox/.test(t)) return Gamepad2;
  if (/spotify|music/.test(t)) return Music;
  if (/subscription|premium/.test(t)) return Sparkles;
  if (/cash|voucher|card|gift/.test(t)) return /cash/.test(t) ? Banknote : Gift;
  if (/trophy/.test(t)) return Trophy;
  if (/stationery|bundle|pack/.test(t)) return Package;
  return category ? CATEGORY_ICON[category] ?? Gift : Gift;
}

// Which shelf a Top 10 prize belongs on, worked out from its name (prizes have no category of their own).
export function prizeCategory(title: string): (typeof CATEGORIES)[number] | "other" {
  const t = title.toLowerCase();
  if (/macbook|laptop|ipad|tablet|airpods|headphone|earbud|phone|watch|console/.test(t)) return "technology";
  if (/cinema|movie|ticket|trip|experience|concert/.test(t)) return "experiences";
  if (/sat|exam|refund|tuition|course|book|stationery|study|subscription|premium/.test(t)) return "study";
  if (/gift card|voucher|spotify|playstation|gaming|cash/.test(t)) return "gift_cards";
  return "other";
}

export function PrizeIcon({ title, category, className = "size-6", strokeWidth = 1.5 }: { title: string; category?: string; className?: string; strokeWidth?: number }) {
  return createElement(prizeIconFor(title, category), { className, strokeWidth, "aria-hidden": true });
}
