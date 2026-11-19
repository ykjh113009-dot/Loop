import {
  Award, BarChart3, Bookmark, BookMarked, BookOpen, Bell, CalendarDays, Castle, ChevronDown, Crown, Gift, Globe, GraduationCap, Heart, HeartHandshake, House, IdCard,
  Landmark, LayoutGrid, Library, Lock, MapPin, Medal, MessageCircle, Newspaper, Repeat, Search, Settings, Star, Store, Tent, Trophy, UserRound,
  UserRoundCheck, Users, UsersRound, type LucideProps,
} from "lucide-react";

const ICONS = {
  home: House, users: Users, calendar: CalendarDays, book: BookOpen, store: Store, chat: MessageCircle, groups: UsersRound, heart: Heart,
  trophy: Trophy, gift: Gift, graduation: GraduationCap, star: Star, feed: LayoutGrid, clubs: Tent, profile: UserRound, exchange: Repeat,
  magazine: Newspaper, yearbook: BookMarked, houses: Castle, council: Landmark, passport: IdCard, map: MapPin, library: Library,
  tutors: UserRoundCheck, mentor: HeartHandshake, globe: Globe, crown: Crown, medal: Medal, award: Award, lock: Lock, settings: Settings,
  bell: Bell, search: Search, chevron: ChevronDown, polls: BarChart3, saved: Bookmark,
} as const;
export type NavIconName = keyof typeof ICONS;

// One icon family (Lucide) everywhere in the navigation, at one stroke weight.
export function NavIcon({ name, className = "size-5", strokeWidth = 1.8 }: { name: NavIconName; className?: string; strokeWidth?: number } & Pick<LucideProps, "aria-hidden">) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
