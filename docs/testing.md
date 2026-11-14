# Testing

| Command | What it checks |
| --- | --- |
| `npm run lint` | Code style and common mistakes |
| `npm run typecheck` | TypeScript types |
| `npm run build` | Production build |
| `npm run db:test` | 274 database checks in `supabase/tests/` (roles, 2FA, rate limits, school isolation, feed, friends, chats, accounts). Prints only failures. Runs in transactions that are rolled back. |
| `node tests/e2e/phase1.js` | 40 browser checks: admin application, leadership, roles, restrictions, two-step sign-in, phone layout |
| `node tests/e2e/phase3.js` | 62 browser checks: points, shop, houses, competitions, groups, club management, leadership dashboard, phone and Arabic layouts |
| `node tests/e2e/phase2.js` | 44 browser checks: feed, polls, comments, friends, settings, message requests, group chat, Arabic, account deletion |
| `node tests/e2e/login.js` | 39 browser checks: sign-in page, redirects, refused accounts (needs `google_only = true`) |
| `node tests/e2e/dashboard.js` | 59 browser checks: Home dashboard on desktop and phones |

The browser tests need the local database (`npm run db:start`, `npm run db:reset`), the app on
`localhost:3000` with `DEMO_MODE=true`, and Playwright.

## Phase 1 results (13 Nov 2026)

All of the above pass: 76 database checks and 138 browser checks.

Bugs found and fixed while testing:
- Club leaders were not listed as leadership roles when the club list changed outside the new functions. Fixed with sync triggers.
- A database helper that took a whole profile row leaked into the generated types as a fake column. Changed to take an id.

## Phase 2 results (14 Nov 2026)

All pass: 151 database checks and 182 browser checks.

Bugs found and fixed while testing:
- Saving a post failed because the save used an "update" the database does not allow. Now a plain insert.
- After sending a message request the message box stayed open until the page was refreshed.
- A deactivated or removed account was bounced to the sign-in page with an error instead of seeing the "account paused" page (this bug existed before Phase 2).

## Phase 3 results (15 Nov 2026)

All pass: 274 database checks and 244 browser checks.

Bugs found and fixed while testing:
- **Club pages showed "No posts yet"** since Phase 2. Adding reactions made the club's post query ambiguous, so it returned nothing. Fixed.
- A database job could not change a class letter because the new class-lock rule also applied to it. Fixed.

## Challenges

`supabase/tests/challenges.sql` (run by `npm run db:test`) checks permissions, the review workflow, audience and limits, proof privacy, duplicate points, reversals, ranked prizes, reports and the audit trail. `tests/e2e/challenges.js` walks the whole flow in a browser: create, review, join, send a photo, check, points, phone widths. It needs `tests/e2e/proof.png` next to it and the local school set to Google-only for the login suite.

## Phase 4

`supabase/tests/phase4_activities.sql` covers proposals and approval, direct publishing, capacity and the waiting list, chat membership, reminders, editing and announcements, files, volunteering (apply, accept, spots, hours, points once, history) and the council hub (posts, contact info, messages and replies, privacy). `tests/e2e/phase4.js` walks the same flow in a browser, including the calendar views, filters and phone widths. The database tests need a freshly reset database; the browser suites leave data behind, and the local sign-in limit (about 30 per 5 minutes) means running all browser suites back to back can fail on sign-in. Run them in two batches.
