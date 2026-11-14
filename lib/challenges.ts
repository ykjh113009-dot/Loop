// Shared names and rules for Loop Challenges.
export const CATEGORIES = [
  { id: "academic", label: "Academic", emoji: "📚" },
  { id: "creative", label: "Creative", emoji: "🎨" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "community", label: "Community", emoji: "🤝" },
  { id: "wellbeing", label: "Wellbeing", emoji: "🌿" },
  { id: "fun", label: "Fun", emoji: "🎉" },
  { id: "other", label: "Other", emoji: "✨" },
] as const;

export const KINDS = [
  { id: "digital", label: "Digital", text: "Done inside Loop" },
  { id: "real_life", label: "Real life", text: "Done at school or in person" },
  { id: "hybrid", label: "Both", text: "A mix of Loop and real life" },
] as const;

export const PROOF = [
  { id: "photo", label: "Photo", emoji: "📷" },
  { id: "video", label: "Video", emoji: "🎬" },
  { id: "text", label: "Written description", emoji: "✍️" },
  { id: "answers", label: "Answers to questions", emoji: "❓" },
] as const;

export const categoryOf = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
export const kindOf = (id: string) => KINDS.find((k) => k.id === id) ?? KINDS[0];

export type ChallengeLike = { status: string; starts_at: string; ends_at: string; ranked_at?: string | null };

/** The seven statuses people see. Active, Completed and Expired follow from the dates. */
export function challengePhase(c: ChallengeLike, approvedEntries = 0) {
  if (c.status !== "approved") return c.status as "draft" | "pending" | "rejected" | "cancelled";
  const now = Date.now();
  if (now < new Date(c.starts_at).getTime()) return "approved";
  if (now < new Date(c.ends_at).getTime()) return "active";
  return c.ranked_at || approvedEntries > 0 ? "completed" : "expired";
}

export const PHASE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-black/5 text-black/60" },
  pending: { label: "Pending review", cls: "bg-amber-50 text-amber-800" },
  approved: { label: "Approved", cls: "bg-sky-50 text-sky-800" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700" },
  active: { label: "Active", cls: "bg-brand-50 text-brand-800" },
  completed: { label: "Completed", cls: "bg-brand-50 text-brand-800" },
  expired: { label: "Expired", cls: "bg-black/5 text-black/55" },
  cancelled: { label: "Cancelled", cls: "bg-black/5 text-black/55" },
};

export const ENTRY_STATUS: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Submitted", cls: "bg-sky-50 text-sky-800" },
  pending: { label: "Pending verification", cls: "bg-amber-50 text-amber-800" },
  approved: { label: "Approved", cls: "bg-brand-50 text-brand-800" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700" },
};

export const PROOF_BUCKET = "challenge-proof";
