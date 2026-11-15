# Study Hub and the new sidebar

Migration `20261118000001_study_hub.sql`. Tests: `supabase/tests/study_hub.sql` (84 checks), `tests/e2e/studyhub.js` (58 checks).

## Sidebar

Home, Community, Chats, Calendar, Activities, a divider, then Academic Resources, Tutors Directory, University & Opportunities, Rewards Shop (`components/shell/shell-chrome.tsx`). The original five icons are unchanged; the four new items use `book`, `tutor`, `graduation` and `gift` (outline icons added to `components/line-icon.tsx`). Marketplace and More are no longer in the sidebar; they are in the profile menu. On a phone the bottom bar is unchanged and the four Study Hub sections are at the top of More.

## The four sections (separate routes)

* **Academic Resources** `/academic-resources`, `/academic-resources/[slug]`. Categories live in `study_categories` (SAT, AP Chemistry, AP Biology, AP Physics, AP Calculus, Other, created for every school; admins can add subjects). Resources are links with a type. Admins, the Council, school staff and approved tutors add them; only https links are accepted. No materials are pre-filled.
* **Tutors Directory** `/tutors` (directory, study buddies, requests), `/tutors/[id]` full profile with booking, `/tutors/apply`, `/tutors/me`, `/tutors/review`.
* **University & Opportunities** `/opportunities`, `/opportunities/[id]`. Eight categories, search, "open now" filter. Admins, the Council and school staff add listings, with an optional "Sample" label so demo data is never mistaken for real. No listings are pre-filled.
* **Rewards Shop** `/shop`: "Redeem rewards" (images, availability, balance, enough-points check, secure redemption function from Phase 3) and "Top 10 prizes" inside the same page. The Top 10 uses `individual_leaderboard` (the existing ranking, weekly or all time) plus `top10_prizes` / `top10_settings`, set in Admin, Rewards.

## Becoming a tutor (review-based)

1. A student opens **Become a Tutor**. The form has six steps: personal (name, picture and school email come from the account; an optional tutor-only photo), academic, about, availability, documents, and a review summary. A draft can be saved at any step. One application per student.
2. Submit sets **Pending Review** and notifies admins and Council members. A pending application cannot be edited (it can be taken back).
3. **Admins and Student Council members** review (`can_review_tutors`): they see everything, open the private documents, approve, or reject with feedback. Nobody reviews their own application.
4. A rejected student sees the feedback, edits and resubmits. Every step is kept in `tutor_application_events` (read only).
5. Approval creates the public `tutor_profiles` row from the public fields only (subjects, introduction, qualifications, experience, format, availability, optional photo). Grades and achievements, the motivation and the documents stay private. The tutor can then edit the public profile or pause it.

Security: `tutor_applications`, documents and history are readable only by the applicant and reviewers; nothing can be written directly; the bucket `tutor-docs` is private (pdf, jpg, png, docx, 8 MB, 8 files) and its access rules use the same reviewer check. Students cannot insert into `tutor_profiles` any more; tutors who were listed before this change were marked approved.

## Not included

Tutor ratings, payments, calendar booking (booking is the existing request and chat), uploading study files (resources are links), and reviewer-editable subjects.

## Rollback

Redeploy the previous Vercel deployment (Phase 4). The migration only adds tables and columns, but the old code lets students list themselves as tutors, which the database now refuses, so that old form would show an error until the new code is back.
