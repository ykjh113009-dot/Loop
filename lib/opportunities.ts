export const OPP_CATEGORIES = [
  { id: "admissions", label: "University Admissions", emoji: "🏛️" },
  { id: "scholarships", label: "Scholarships", emoji: "💰" },
  { id: "competitions", label: "Competitions", emoji: "🏆" },
  { id: "summer", label: "Summer Programs", emoji: "☀️" },
  { id: "internships", label: "Internships", emoji: "💼" },
  { id: "exchange", label: "Exchange Programs", emoji: "🌍" },
  { id: "volunteering", label: "Volunteering Opportunities", emoji: "💚" },
  { id: "other", label: "Other Educational Opportunities", emoji: "✨" },
] as const;
export const oppCategory = (id: string) => OPP_CATEGORIES.find((c) => c.id === id) ?? OPP_CATEGORIES[OPP_CATEGORIES.length - 1];
