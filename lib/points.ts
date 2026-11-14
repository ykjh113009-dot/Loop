// What each kind of points is for, shown on "My points".
export const POINT_REASONS: Record<string, string> = {
  club_join: "Joined a club",
  post: "Posted",
  comment: "Commented",
  rsvp: "Going to an event",
  poll_vote: "Voted in a poll",
  election_vote: "Voted in an election",
  challenge: "Weekly challenge",
  volunteer: "Volunteering hours",
  tutoring: "Tutored a classmate",
  tawjihi_answer: "Answered a Tawjihi question",
  suggestion: "Sent a suggestion",
  group_join: "Joined a group",
  help_classmate: "Helped a classmate",
  community_service: "Community service",
  competition: "Competition",
  competition_team: "Team competition",
  academic: "Academic achievement",
  other_approved: "School-approved activity",
  club_achievement: "Club achievement",
};

export type Rule = { reason: string; label: string; points: number; daily_limit: number | null; weekly_limit: number | null; requires_verification: boolean; enabled: boolean };

// Default rules with the school's own changes on top.
export function mergeRules(
  defaults: { reason: string; label: string; points: number; daily_limit: number | null; weekly_limit: number | null; requires_verification: boolean; sort: number }[],
  overrides: { reason: string; points: number; daily_limit: number | null; weekly_limit: number | null; enabled: boolean }[],
): Rule[] {
  const own = new Map(overrides.map((o) => [o.reason, o]));
  return [...defaults].sort((a, b) => a.sort - b.sort).map((d) => {
    const o = own.get(d.reason);
    return {
      reason: d.reason, label: d.label, requires_verification: d.requires_verification,
      points: o ? o.points : d.points,
      daily_limit: o ? o.daily_limit : d.daily_limit,
      weekly_limit: o ? o.weekly_limit : d.weekly_limit,
      enabled: o ? o.enabled : true,
    };
  });
}
