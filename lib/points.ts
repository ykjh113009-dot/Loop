// What each kind of points is for, shown on "My points".
export const POINT_REASONS: Record<string, string> = {
  club_join: "Joined a club",
  post: "Posted",
  comment: "Commented",
  rsvp: "Going to an event",
  poll_vote: "Voted in a poll",
  election_vote: "Voted in an election",
  challenge: "Challenge",
  challenge_rank: "Challenge prize",
  library_resource: "Shared a study resource",
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
  daily_login: "Daily login",
  profile_complete: "Completed your profile",
  streak_7: "7-day streak", streak_14: "14-day streak", streak_30: "30-day streak", streak_60: "60-day streak", streak_100: "100-day streak",
  resource_save: "Saved a study resource",
  resource_review: "Reviewed a study resource",
  tutor_apply: "Applied to be a tutor",
  tutor_approved: "Became a tutor",
  idea_planned: "Your idea was planned",
  idea_done: "Your idea was carried out",
  volunteer_5: "5 volunteering activities",
  club_leader: "Became a club leader",
  achievement: "Achievement reward",
  adjustment: "Adjusted by an admin",
  reversal: "Correction",
};

export const LEVEL_NAMES = ["Newcomer", "Explorer", "Contributor", "Rising Star", "Community Star", "Achiever", "Champion", "Legend"];
export const levelName = (level: number) => LEVEL_NAMES[Math.min(Math.max(level, 1), LEVEL_NAMES.length) - 1];

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
