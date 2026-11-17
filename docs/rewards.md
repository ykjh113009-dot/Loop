# Loop Points, Rewards, Streaks, XP and Achievements

One central system. Everything that earns, spends, levels up or unlocks goes through the same database functions.

## How it works
- **Loop Points (spendable) and XP (progress)** come from one ledger (`points_ledger`). XP = everything earned (and any admin correction). Balance = XP − what was spent in the Rewards Shop. Spending never lowers XP or the level.
- **Ledger rows** have a kind: `earn`, `adjust` (admin, with a required reason) or `reversal` (opposite sign, points back to the original entry). Rows are never edited or deleted; a reversal is a new row and an entry can be reversed once.
- **One reward per action:** `unique(profile, reason, source)`. The source is the thing rewarded (a resource, a day, a milestone, an application), so repeating, editing, deleting and re-adding, or calling twice never pays twice.
- **Rules** (`point_rule_defaults` + the school's `point_rules`): points, daily/weekly limits and on/off, changed by admins in *Admin → Points*.
- **Levels:** Newcomer, Explorer, Contributor, Rising Star, Community Star, Achiever, Champion, Legend. Level n starts at 25·n·(n−1) XP (50, 150, 300, 500, 750, 1050, 1400). A level-up sends a notification.
- **Streaks:** a streak day is a school-local day (Asia/Hebron) on which the student opened Loop *and* earned something from a real activity (poll vote, saving a resource, challenge, post…). Automated or staff-given rewards and page refreshes do not count. Missing a day resets the current streak; the longest is kept. Milestones 7, 14, 30, 60, 100 days pay once ever (`streak_milestones`).
- **Daily login:** `record_login()` runs when the app opens; one reward per school day (idempotent).
- **Achievements:** the existing `badges` table extended with category, tier (bronze/silver/gold), metric, threshold and bonus points. `achievement_metric()` measures progress; `award_badges()` unlocks automatically. Students pin up to 6 on their public profile.

## Earning (defaults, all changeable)
| Activity | Points | Where it is checked |
|---|---:|---|
| Daily login | 5 | `record_login()` |
| Completed profile (setup + bio + 3 interests) | 20 | trigger, once |
| Streak 7 / 14 / 30 / 60 / 100 | 25 / 40 / 100 / 150 / 250 | `refresh_streak()`, once ever |
| Save a study resource | 1 | `library_save()`, once per resource |
| Written resource review (same for any stars) | 3 | `library_rate()`, once per resource |
| Approved shared resource | 20 | `library_review()`, once per resource (content-keyed) |
| Apply to be a tutor / approved | 5 / 25 | trigger on `tutor_applications`, once each |
| Idea planned / carried out | 10 / 25 | trigger on `suggestions` |
| Every 5 verified volunteering activities | 25 | trigger on the ledger |
| Club leader role | 25 | trigger on `leadership_roles` |
| Already existing: posts, comments, RSVPs, polls, elections, clubs, groups, Tawjihi, suggestions, volunteering hours, tutoring, challenges, competitions, club achievements | as before | unchanged |

## Not built yet (a prerequisite is missing)
- **Event attendance (+10 verified):** events only have RSVPs; there is no check-in. Needs an attendance feature.
- **Marketplace:** listings go live without approval and there is no verified-transaction flow, so a listing/transaction reward would be easy to farm. Needs listing approval and a confirmed-sale flow first.
- **Saving an opportunity, opportunity milestones, preparation activities:** opportunities cannot be saved yet.
- **Verified tutoring sessions:** only "completed" exists; a two-sided confirmation would make it reliable.
- **Chat peer-help, helpful-contribution recognition, "help implement an idea", photos/creative/contributor achievements, Community Organizer, Marketplace achievements, All-Rounder:** depend on the items above or on a recognition flow.
Existing activity values (poll +1, RSVP +3, club join +5…) were **not** changed to your suggested table, to avoid changing the live economy; change them in Admin → Points if you want.

## Student screens
*My points & badges*: level and name, balance, streak (current, longest, last 7 days, next milestone), achievements with progress and a ☆ to show a badge on the profile, roles, history (earnings, adjustments, corrections, shop spending). *Profile*: level name and chosen badges (never points). Small live messages ("🐶 +5 Loop Points", level-ups, achievements, streaks) arrive through the notification feed; bigger moments stay on screen a little longer.

## Admin (Admin → Points)
Rules (now up to 1000 points), reward statistics, "worth a look" (students with ≥ 80 points or ≥ 25 rewards in 24 h), student lookup with balance, history, **adjust** (admins only, reason required, not your own balance), **reverse** an entry (reason required, original kept), achievement bonus and on/off. Staff (`school_staff`) can view and change rules; only admins can adjust or reverse.

## Security
Every award, spend, streak and unlock is a database function; the ledger, stats, milestones and login days are read-only for signed-in users. Amounts never come from the browser. Everything is logged (`moderation_log`) for adjustments, reversals and achievement changes.

## Tests
`supabase/tests/rewards_v2.sql` (daily login once, streak start/reset/milestone once, save once, achievements once, XP, adjustments, reversals, permissions, changed rules) and `tests/e2e/rewards.js` (toast, My points, pinned badges, admin lookup/adjust/reverse, phone).
