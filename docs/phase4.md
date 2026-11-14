# Phase 4: School activities

Events and calendar, the volunteering hub and the Student Council hub. Built on what Loop already had (events, RSVPs, hours logging, council members and elections). Migration: `20261117000001_phase4_activities.sql`. Tests: `supabase/tests/phase4_activities.sql` (107 checks) and `tests/e2e/phase4.js` (37 checks).

## Events and calendar

* **Who can publish.** Admins and Student Council members publish at once. A club's leaders publish for their club at once. Any other current student *proposes* an event, and an admin approves or rejects it (a rejection needs a reason). Moderators can see proposals but no longer approve them (the brief says admins).
* **Calendar.** Month, week, day and upcoming views; category filter; search (title, place, details); "I'm going" filter. Categories: academic, arts and music, sports, social, community, club, other.
* **Event page.** Cover photo, category, date, time, place, organizers and team, who is going, waiting list, updates, photos and PDFs, volunteer roles, report button.
* **Attendance.** Open by default. No check-in, no attendance tracking. An organizer can set a limit; extra students join a waiting list and are moved up in order when someone leaves or the limit grows. Organizers can let someone in over the limit, move someone to the list, or remove someone. Reminders (a day and an hour before) go only to people who are going.
* **Organizers.** The creator, an optional organizing team (up to 8, chosen by the creator, a club leader or an admin), a club's leaders, moderators and admins. They can freely edit a published event; if the name, time or place changes everyone involved gets a notification and a "changed" note appears in the updates. They can post announcements (notify everyone involved), add files, manage the list, add volunteer roles, move or cancel.
* **Event chat.** Every published event gets a group chat (conversation kind `eventchat`). Members follow automatically: the creator, the team, people who are going, and accepted event volunteers. Waiting-list people join when they get in.
* **Files.** Private bucket `event-files`, up to 6 per event (jpeg, png, webp, pdf, 10 MB). Only organizers can upload; the school can read.
* **Security.** `events` and `event_rsvps` are read-only for signed-in users. Everything goes through `create_event`, `update_event`, `join_event`, `leave_event`, `manage_attendee`, `post_event_update`, `set_event_organizers`, `add_event_attachment`, `cancel_event`, `review_event`. The old trigger that decided the status by role was changed so it no longer overrides `create_event`.

## Volunteering hub

* **Opportunities.** Admins, the Council, school staff, club leaders and event organizers publish. Event-linked roles appear on the event page. Fields: title, details, what volunteers need, place, time, number of spots.
* **Students** browse, apply (with an optional message), withdraw, see their applications, their assigned role and their history.
* **Organizers** accept (with a role) or decline (with a reason), change roles, close or cancel, and record the hours when the work is done.
* **Hours join the existing record.** Recording hours creates an approved entry in `volunteer_entries` (so the certificate and "My hours" include it) and pays points once (10 per hour, same as approved hours). The organizer cannot record or accept their own application.
* **Profiles** show verified volunteering (total hours and recent entries). The Passport (Phase 5) will use the same `volunteer_history` function.
* The older self-logged hours (checked by a moderator) are still there under "My hours".

## Student Council hub

Kept simple, as the brief asks. The existing members list and elections are unchanged.

* **News from the council:** announcements (notify the whole school), updates, initiatives (planned, in progress, done) and activities. Pin to the top. Only council members and admins post.
* **Contact details:** about, email, office, meeting times.
* **Talk to the council:** a student writes a private message (3 a day, bad words refused). Only the sender, council members and admins can read it. The council replies or closes it; the student is notified and sees the reply. The older suggestion box is still linked.

## Not included

Per-attendee check-in (out of scope on purpose), recurring events, calendar export, reminders for volunteers beyond the event reminders, a way to edit a volunteer opportunity after publishing (cancel and republish), and election changes.

## Rollback

The migration adds columns and tables and changes how events are created. To go back, redeploy the previous Vercel deployment (Challenges build). The old code inserts events directly, which is no longer allowed, so event creation would be unavailable until the new code is back.
