import { createElement } from "react";
import {
  AlertTriangle, Atom, Bell, BarChart3, BookMarked, BookOpen, Bookmark, Bot, Briefcase, Calculator, CalendarDays, Camera, Castle, Check, CheckCircle2, ChefHat,
  Clapperboard, Clock, Coins, Compass, Dna, Download, Drama, Dumbbell, ExternalLink, Eye, FileEdit, FileText, Files, Flag, Flame, FlaskConical, Flower2, Footprints,
  Gamepad2, Gem, Gift, Globe, GraduationCap, Heart, HeartHandshake, Hourglass, House, Image as ImageIcon, Landmark, Laptop, Leaf, Library, Lightbulb, Lock, Mail,
  Map, MapPin, Medal, Megaphone, MessageCircle, Mic, Microscope, Music, Newspaper, Package, Palette, PartyPopper, Paperclip, PawPrint, PenLine, PersonStanding, Pin,
  Plug, Presentation, Puzzle, Recycle, Repeat, Ruler, School, ScrollText, Scissors, Search, Settings, ShieldCheck, Shirt, ShoppingBag, Shapes, Smartphone, Sparkles, Sprout,
  Star, Sun, Target, Ticket, Trophy, Users, Volleyball, Vote, Waves, X, Pause, Pencil, ChessKnight, Mountain, Mailbox, HelpCircle, ClipboardList, PlayCircle,
  type LucideIcon,
} from "lucide-react";
import { Basketball, Football } from "@/components/interest-icon";

// One place that turns the emoji stored in the database (or typed in old code) into the Loop line icon.
// Interface only: emojis that students write in posts, comments and messages are never passed through here.
const MAP: Record<string, LucideIcon> = {
  "🧭": Compass, "🔒": Lock, "⏸": Pause, "🗳": Vote, "🏠": House, "⭐": Star, "🌟": Star, "★": Star, "☆": Star, "✏": Pencil, "🏆": Trophy, "✅": CheckCircle2, "✓": Check,
  "✕": X, "❌": X, "🔍": Search, "🔎": Search, "🏁": Flag, "🚩": Flag, "🛍": ShoppingBag, "🎁": Gift, "⚠": AlertTriangle, "🤖": Bot, "📜": ScrollText, "🎓": GraduationCap,
  "🫶": HeartHandshake, "📚": Library, "📖": BookOpen, "📘": BookMarked, "👁": Eye, "⬇": Download, "↗": ExternalLink, "🛡": ShieldCheck, "🎉": PartyPopper, "🎈": PartyPopper,
  "⚽": Football, "🏀": Basketball, "🏐": Volleyball, "💻": Laptop, "🎨": Palette, "🎵": Music, "🎭": Drama, "🎤": Mic, "🎙": Mic, "📷": Camera, "🌱": Sprout, "🍃": Leaf, "🌿": Leaf,
  "♟": ChessKnight, "🍳": ChefHat, "🎮": Gamepad2, "🤝": HeartHandshake, "💃": PersonStanding, "🔬": Microscope, "✍": PenLine, "🧵": Scissors, "📣": Megaphone, "📢": Megaphone,
  "🗣": MessageCircle, "📅": CalendarDays, "⚙": Settings, "💬": MessageCircle, "📎": Paperclip, "🔔": Bell, "🏫": School, "📄": FileText, "💚": Heart, "⏳": Hourglass, "⏰": Clock,
  "🕒": Clock, "🖼": ImageIcon, "🔥": Flame, "💡": Lightbulb, "🎖": Medal, "🥇": Medal, "🥈": Medal, "🥉": Medal, "👯": Users, "👥": Users, "🧑‍🏫": Presentation, "📊": BarChart3,
  "📰": Newspaper, "📍": MapPin, "✉": Mail, "📌": Pin, "🔖": Bookmark, "🎬": Clapperboard, "📝": FileEdit, "📦": Package, "💰": Coins, "🔄": Repeat, "📲": Smartphone, "📱": Smartphone,
  "🏛": Landmark, "☀": Sun, "💼": Briefcase, "🌍": Globe, "🌐": Globe, "✨": Sparkles, "💫": Sparkles, "🔮": Sparkles, "❓": HelpCircle, "🎯": Target, "👕": Shirt, "🔌": Plug,
  "🧩": Puzzle, "🗂": Files, "🎟": Ticket, "📬": Mailbox, "🌊": Waves, "🌹": Flower2, "💐": Flower2, "🏜": Mountain, "🐾": PawPrint, "🐶": PawPrint, "💎": Gem, "🗺": Map,
  "🏃": Footprints, "🧮": Calculator, "💪": Dumbbell, "🧪": FlaskConical, "🧬": Dna, "⚛": Atom, "📐": Ruler, "♻": Recycle, "🏰": Castle, "📋": ClipboardList, "▶": PlayCircle,
};

const norm = (e: string) => e.replace(/️/g, "").trim();

// Every icon an admin or leader can pick for a club, house, group or challenge. The value stored is still the emoji key, so nothing in the database changes.
export const PICKABLE = ["⭐", "⚽", "🏀", "🏐", "🤖", "💻", "🎨", "🎵", "🎭", "🎤", "📷", "🌱", "♟️", "🍳", "🎮", "🤝", "💃", "🔬", "✍️", "🧵", "🏆", "🏁", "🎯", "📚", "🎓", "💡", "🌍", "🏠", "👥", "📣", "🎉", "💚", "🧪", "📐", "🧮", "💪"] as const;

export function glyphFor(e: string | null | undefined): LucideIcon {
  return (e && MAP[norm(e)]) || Shapes;
}

// Size follows the text (1.1em), colour follows the text, same thin stroke everywhere.
export function Glyph({ e, className = "", strokeWidth = 1.75 }: { e: string | null | undefined; className?: string; strokeWidth?: number }) {
  return createElement(glyphFor(e), { className: `inline-block size-[1.1em] shrink-0 align-[-0.17em] ${className}`, strokeWidth, "aria-hidden": true });
}

// A finishing place: 1st to 3rd get a solid green numbered badge, the rest a plain number.
export function Place({ n, className = "" }: { n: number; className?: string }) {
  return n <= 3
    ? <span className={`inline-flex size-7 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white ${className}`} aria-label={`#${n}`}>{n}</span>
    : <span className={`inline-flex size-7 items-center justify-center text-sm font-semibold text-ink-2 ${className}`}>{n}</span>;
}
