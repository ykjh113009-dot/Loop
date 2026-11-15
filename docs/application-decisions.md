# Application decisions at sign-in

Loop already had two review workflows, and this feature builds on both (no new application or role system):

| Application | Table | Who reviews | What approval does |
|---|---|---|---|
| Moderator / Admin | `admin_applications` | Super Admin (`review_admin_application`) | sets the profile role to the role the reviewer **gave** (can differ from the one requested) |
| Class rep, club leader, council member, school staff | `leadership_requests` | Admin (`review_leadership_request`) | `grant_leadership()` |

## What changed
- `decision_seen_at` on both tables (migration `20261120000001_application_decisions.sql`). New decisions start unseen; decisions that existed before the migration count as seen.
- **A rejection now needs a reason** (database-enforced, ≥ 3 characters, content-filtered). The review forms say so.
- Notifications link to `/application-update?kind=…&id=…`, so a decision can be opened again any time.
- `ack_application_decision(kind, id)`: lets applicants mark only their own decision as seen. Applicants still cannot write to the tables or change their status.

## Sign-in routing
Every sign-in (Google callback and the demo buttons) passes through `afterSignInPath()` (`lib/applications.ts`):
1. an **unseen decision** → `/application-update` (approved: Congratulations + confetti + role actually given + responsibilities, “Go to My Dashboard”; rejected: “Application update” + reviewer feedback + “Edit & Resubmit” + “Continue to Loop”);
2. else a **pending application** → `/application-update` (“We're reviewing your application”: what, when, status; “Continue to Loop”);
3. else the normal destination (`/home`, or `/apply-admin` for people who chose Admin on the sign-in page).

The full-screen decision is shown once: pressing a button marks it seen. Opening it from a notification shows it again without changing anything. Pending applicants see their status screen at each sign-in (never inside the app).
Dashboards after approval: Moderator → `/moderation`, Admin / Super Admin → `/admin`, leadership roles → `/leadership/dashboard`. Permissions always come from the database role, never from the requested role.

## Pieces
`components/mascot.tsx` (the Loop dog: happy / sympathetic / waiting), `components/confetti.tsx` (hidden when the device asks for less motion), `app/application-update/*`, `app/auth/continue/route.ts`, `app/actions/applications.ts`.
Tests: `supabase/tests/application_decisions.sql`, `tests/e2e/applications.js`.
