import {
  Bot, BookOpen, Calculator, Camera, ChefHat, ChessKnight, Clapperboard, Code, Drama, Dumbbell, FlaskConical, Footprints, Gamepad2,
  HeartHandshake, Landmark, Leaf, Lightbulb, MessagesSquare, Mic, MicVocal, Music, Pencil, PenLine, PersonStanding, Scissors, Volleyball,
  type LucideIcon, type LucideProps,
} from "lucide-react";

// Lucide has no basketball or football, so these two are drawn in the same thin outline style.
export const Basketball: LucideIcon = ((props: LucideProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" /><path d="M12 2v20" /><path d="M2 12h20" /><path d="M5.2 4.8c2.9 3.4 2.9 11 0 14.4" /><path d="M18.8 4.8c-2.9 3.4-2.9 11 0 14.4" />
  </svg>
)) as LucideIcon;
export const Football: LucideIcon = ((props: LucideProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" /><path d="M12 8.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z" /><path d="M12 8.2V2.3" /><path d="M15.6 10.8l5.6-1.8" /><path d="M14.2 15l3.4 4.7" /><path d="M9.8 15l-3.4 4.7" /><path d="M8.4 10.8L2.8 9" />
  </svg>
)) as LucideIcon;

const ICONS: Record<string, LucideIcon> = {
  basketball: Basketball, entrepreneurship: Lightbulb, chess: ChessKnight, coding: Code, cooking: ChefHat, dabke: PersonStanding, debate: Mic,
  drawing: Pencil, environment: Leaf, film: Clapperboard, fitness: Dumbbell, football: Football, gaming: Gamepad2, history: Landmark,
  languages: MessagesSquare, math: Calculator, music: Music, photography: Camera, reading: BookOpen, robotics: Bot, running: Footprints,
  science: FlaskConical, singing: MicVocal, embroidery: Scissors, theatre: Drama, volleyball: Volleyball, volunteering: HeartHandshake, writing: PenLine,
};

// A thin outline icon for an interest. It takes the text colour, so it turns white on a selected pill.
export function InterestIcon({ slug, className = "size-[18px] shrink-0" }: { slug: string; className?: string }) {
  const Icon = ICONS[slug];
  return Icon ? <Icon className={className} strokeWidth={1.8} aria-hidden="true" /> : null;
}
