import { BookMarked, BookOpen, ClipboardList, Compass, FileText, Files, Globe, HelpCircle, Library, Paperclip, PlayCircle, Dna, Atom, Ruler, FlaskConical, type LucideIcon } from "lucide-react";

const TYPE_ICONS: Record<string, LucideIcon> = {
  digital_book: BookOpen, textbook: BookMarked, pdf_notes: FileText, study_guide: Compass, past_paper: Files,
  practice_questions: HelpCircle, worksheet: ClipboardList, video: PlayCircle, website: Globe, other: Paperclip,
};
const SUBJECT_ICONS: Record<string, LucideIcon> = {
  sat: FileText, "ap-chemistry": FlaskConical, "ap-biology": Dna, "ap-physics": Atom, "ap-calculus": Ruler, other: Library,
};

// Thin outline icons for resource types and subjects, used where there is no picture. No emojis.
export function TypeIcon({ type, className = "size-8" }: { type: string; className?: string }) {
  const Icon = TYPE_ICONS[type] ?? Paperclip;
  return <Icon className={className} strokeWidth={1.5} aria-hidden="true" />;
}
export function SubjectIcon({ slug, className = "size-10" }: { slug: string; className?: string }) {
  const Icon = SUBJECT_ICONS[slug] ?? BookOpen;
  return <Icon className={className} strokeWidth={1.5} aria-hidden="true" />;
}
