# The Home dashboard

`/home` is built from independent cards in `components/dashboard/`. Each card loads its own data
(through the signed-in student's permissions, so the database rules still apply) and appears as soon
as it is ready. The page grid lives in `components/dashboard/dashboard.css`.

| Card | Data |
|---|---|
| Greeting | Student name and Palestine time |
| Recent Chats | `conversations`, `conversation_members`, `messages` |
| School Announcements | `announcements` (all on `/announcements`) |
| Community Feed | `posts` from the student's clubs, posting to a chosen club |
| Upcoming Activities, This Week's Events, Next Up | approved `events` |
| Calendar | approved `events` this month |
| Grade Leaderboard | `grade_leaderboard()` (grades are ranked, never students) |
| Quick Chats | the student's clubs and their chats |
| Student Council | `council_members`, `elections` |
| Featured in Loop | links to Tutors, Tawjihi corner and Volunteering |

The shell (sidebar, top bar, phone header and tabs) is in `components/shell/`. Search is `/search`.

## Not built yet
- Reactions, comments and bookmarks on posts: the icons are shown switched off.
- Houses (A, B, C, D): the school has grades, not houses, so the leaderboard ranks grades.
- Council meetings: the council card shows elections, because meetings are not stored anywhere yet.
- Profile photos: students use the illustrated avatars.
