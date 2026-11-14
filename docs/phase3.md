# Phase 3: school community

## What was added

| Area | What it does |
| --- | --- |
| Points | Every activity has a rule (points, daily limit, weekly limit, on/off) that admins change in **Admin → Points**. Things Loop cannot see (helping a classmate, community service, competitions, academic achievements) are **requests**: the student describes it and an admin or school staff member checks it before points are given. |
| XP and levels | XP is every point ever earned and never goes down. Level n starts at 25 × n × (n − 1) XP (50, 150, 300, 500…). Spending in the shop lowers the **balance**, never XP or level. |
| Rewards shop (`/shop`) | Unlockable profile colours (Sand, Rose, Plum) and school-approved prizes. Prizes wait for staff to hand them over; cancelling returns the points and the stock. |
| Leaderboards (`/leaderboard`) | Houses, grades and students. Students can hide their name in Settings (their points still count for grade and house). |
| Houses | Letter houses (House A = 12A, 11A, 10A, 9A). A student's class letter decides their house. Admins create, rename, recolour and re-assign classes. Students cannot change their own class letter. |
| Competitions | Admins and school staff create house or team competitions. Students form teams (size limit), staff give points to a house (adds to the house score) or to a team (every member gets the points). |
| Groups (`/groups`) | Official groups (admins, student council, school staff) and student-made groups. Public groups: join at once, posts open to the school. Private groups: ask to join, owner/admins approve, only members read posts and see members. Each group has posts, questions, announcements, members with roles, and a chat. |
| Clubs | Open, by application, or closed. Applications with a question. Team roles (Treasurer…). Announcements (pinned, notify every member). Meetings with attendance, projects and tasks, budget (leaders and admins only), resources (https links), achievements (checked by an admin; may give members points), analytics. All under **Club → Manage**. |
| Leadership Dashboard (`/leadership/dashboard`) | One page. Shows only the tools a student's roles allow: class reps (class summary and class announcements), club leaders (their clubs), council members (suggestions, official groups), school staff (points, rewards, houses, competitions). Roles combine. |

## Anti-cheat

- Points can only be written by database functions; students have no write access to the ledger.
- Each source of points counts once (unique per student, reason and source).
- Daily and weekly limits per activity; request limits per week; rate limits on requests, purchases and teams.
- Manual points need a second person: nobody can check their own request.
- Purchases lock the student's row, so two taps cannot spend the same points twice.
- A student cannot change their class letter to move to a stronger house.

## Who may do what

| Action | Student | Class rep | Club leader | Council | School staff | Admin | Super Admin |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Ask for points, buy rewards, join groups, make student groups | yes | yes | yes | yes | yes | yes | yes |
| Announce to their own class | no | yes | no | no | no | no | no |
| Manage their club (applications, tasks, budget…) | no | no | yes | no | no | all clubs | all clubs |
| Make official groups | no | no | no | yes | yes | yes | yes |
| Check point requests and club achievements, hand over prizes, run competitions | no | no | no | no | yes | yes | yes |
| Change point rules, houses, classes | no | no | no | no | no | yes | yes |
| Make someone a club leader or class rep | no | no | no | no | no | via requests | direct |

Club leader and other leadership roles are still given only through Admin approval or by a Super Admin.

## Decisions to know about

- **Individual ranking.** Earlier phases never ranked individual students. The product brief asks for individual leaderboards, so students now appear by default and can switch it off in Settings.
- **Student-made groups need no approval** (as the brief says). They are covered by reporting, the word filter, rate limits and the "creating groups" restriction.
- **Group chat** uses the same chat as everything else, so reports, blocking and attachments work the same.

## Not finished in this phase

| Item | State |
| --- | --- |
| Page titles in Arabic | Headings at the top of pages (for example "Leaderboards") are still English. The rest of the new pages are translated. |
| Team challenges beyond competitions | Competitions with teams cover it. The weekly challenge is still per student. |
| Rewards with images, shipping or a purchase history for admins | Not built. |
| Houses by something other than class (for example by sign-up) | Houses follow class letters only. |
| Club events and club competitions linked from the club page | Events are already on the club feed. Competitions are school-wide, not per club. |
