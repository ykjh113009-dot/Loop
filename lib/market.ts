export const CATEGORIES: Record<string, string> = {
  books: "📚 Books",
  uniform: "👕 Uniform",
  electronics: "🔌 Electronics",
  sports: "⚽ Sports",
  art: "🎨 Art",
  music: "🎵 Music",
  other: "📦 Other",
};

export const CONDITIONS: Record<string, string> = { new: "New", like_new: "Like new", good: "Good", used: "Used" };

export function priceLabel(l: { kind: string; price: number | null }) {
  if (l.kind === "free") return "Free";
  if (l.kind === "swap") return "Swap";
  return `₪${Number(l.price ?? 0)}`;
}
