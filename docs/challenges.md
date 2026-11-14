# Loop Challenges

Anyone can suggest a challenge. The Student Council or an admin approves it. Students join, send proof, reviewers check it, and the points go into the same points ledger as everything else (XP, levels, shop, house, grade and student leaderboards).

## How it works

1. **Idea.** Anyone signed in creates a challenge (draft). Fields: title, description, instructions, cover photo, category, type (digital / real life / both), start and deadline, audience (school / grade / class), proof required (photo, video, text, quiz answers), participant limit, tries per student, rewards, safety confirmation.
2. **Review.** "Send for review" puts it in *Pending review*. The Council or an admin approves it (they must tick a safety check) or sends it back with feedback. A creator cannot approve their own idea unless they are an admin. Prizes above 100 points need an admin.
3. **Taking part.** Approved challenges appear to the intended audience. A student joins (cap enforced), then sends proof. The creator cannot join their own challenge.
4. **Checking proof.** Statuses: *Submitted* → *Pending verification* (a reviewer started checking) → *Approved* / *Rejected* (rejection needs feedback). Reviewers: the creator, moderators, admins and Council members. Nobody checks their own entry. Only the Council or an admin can change a decision that is already made (a note is required, the points are taken back or given, and it is logged).
5. **Points.** Approved = points paid immediately.
   * *Fixed:* the same points for every approved entry, up to "rewarded tries" per student.
   * *Ranked:* after the deadline the creator/Council/admin picks the winners once; each place gets its prize. A small "taking part" reward is optional.
   * Points are never paid twice: the ledger has a unique key per entry, the entry row is locked, and every award or reversal is written to `challenge_point_log`.
6. **Tries.** One time, or several. "Tries" limit how many entries count; a rejected entry can be retried (total tries are capped at 3x, max 30).

## Statuses

Stored: draft, pending, approved, rejected, cancelled. Shown: *Active*, *Completed* and *Expired* are worked out from the dates (`lib/challenges.ts`, `challengePhase`).

## Pages

| Page | Who |
| --- | --- |
| `/challenges` (Discover, Joined, Completed, My ideas, filters) | everyone |
| `/challenges/new`, `/challenges/[id]/edit` | creators (drafts and rejected ideas) |
| `/challenges/[id]` | the audience; creator sees the review state |
| `/challenges/[id]/manage` | creator, moderators, admins, Council: entries, proof, participants, history, rank winners, cancel |
| `/challenges/review` | Council, admins, moderators (read only for ideas): ideas, entries, activity, warning signs |

## Database (migration `20261116000001_challenges.sql`)

* Extended `challenges` and `challenge_submissions`; new `challenge_prizes`, `challenge_participants`, `challenge_reviews` (audit), `challenge_point_log`.
* Nothing is written directly: every table is read-only for signed-in users and all changes go through functions (`save_challenge`, `review_challenge_idea`, `join_challenge`, `submit_challenge`, `claim_challenge_submission`, `review_challenge_submission`, `rank_challenge`, `cancel_challenge`, ...). Each function checks who is calling, the school, the dates, the limits and the rate limit.
* Row-level security: a challenge is visible to the creator, to reviewers (not drafts) and, once approved, to its audience. Proof (entries, participants, history, point log) is visible only to the student and the people who check that challenge.
* Proof files: private bucket `challenge-proof`, path `<school>/<challenge>/<student>/<file>`. Students can only upload into their own folder of a challenge they joined; only the student and reviewers can read. Allowed: jpeg, png, webp, mp4, webm, mov, up to 25 MB.
* Bad words are refused in titles, descriptions, rules, questions and entries. Reports can target a challenge; removing a reported challenge cancels it.
* `challenge_flags()` shows warning signs: many rejections, bursts of entries, one creator approving the same student again and again, ideas rejected repeatedly.
* Old weekly challenges were kept: they became approved challenges with one try; their points are unchanged.

## Not included yet

Streak challenges (a "keep a streak" challenge is possible only by hand-checking proof), automatic quiz grading, per-club challenges, editing an approved challenge (cancel and make a new one), and push notifications for challenge events beyond the normal bell.

## Rollback

The migration only adds and changes challenge tables. To go back, redeploy the previous Vercel deployment; the new columns are harmless to the old code except that old code writes to `challenges` directly, which is no longer allowed.
