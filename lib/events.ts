export const EVENT_CATEGORIES = [
  { id: "academic", label: "Academic", emoji: "📚" },
  { id: "arts", label: "Arts and music", emoji: "🎨" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "social", label: "Social", emoji: "🎉" },
  { id: "community", label: "Community", emoji: "🤝" },
  { id: "club", label: "Club", emoji: "🎯" },
  { id: "other", label: "Other", emoji: "✨" },
] as const;

export const eventCategory = (id: string) => EVENT_CATEGORIES.find((c) => c.id === id) ?? EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];

export const EVENT_BUCKET = "event-files";
