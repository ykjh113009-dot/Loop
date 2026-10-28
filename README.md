# Loop

A private social app for high-school students. Students meet around clubs, events and shared interests. It is **not** a homework or grades system.

Pilot school: Pioneers School (`@pioneers.edu.ps`). The app is multi-school ready: every record belongs to a school, and a new school is just a new row in the `schools` table with its email domain.

## What's in Phase 1

| Feature | Where |
|---|---|
| Sign in with school Google account only (other emails are refused by the database) | `/login`, `supabase/migrations/…_logic.sql` → `handle_new_user` |
| Welcome screen: grade, avatar, interests, agree to rules | `/welcome` |
| Profiles: name, grade, avatar, bio, interests, clubs. No phone, address or birthday stored anywhere | `/profile/[id]`, `/profile/edit` |
| Find students by name, grade or interest | `/people` |
| Clubs: request → moderator approves → club feed (with photos) + live group chat | `/clubs`, `/clubs/[id]` |
| Private messages (same school only), with block | `/messages`, profile page |
| Events: calendar (weeks start Sunday), live RSVP count, reminders 1 day and 1 hour before, cancel/reschedule notifications | `/events` |
| Notifications page with a live red badge, plus optional phone push alerts | `/notifications` |
| Safety: report button on every post, message, profile, club and event; English/Arabic/Arabizi bad-word filter; moderator queue; suspensions (1, 7, 30 days, or permanent by admins); auto-hide after 3 reports; urgent "someone may need help" reports alert admins | `/moderation` |
| Admin dashboard: % of students in a club, participation by grade, manage students (grade, role, suspend, remove), announcements, student email list, blocked words | `/admin` |

## What's in Phase 2

All of these are on the **More** page (grid icon at the top).

| Feature | Where |
|---|---|
| Peer tutors: students list subjects they can help with; others ask, the tutor accepts and a chat opens to plan a meeting at school; the tutor gets points when it's done | `/tutors` |
| Study buddies: "looking for someone to study physics with" posts | `/tutors?tab=buddies` |
| Buy / sell / swap / give away, with photos and prices in ₪. No online payments, meet at school. Report button and bad-word filter on every listing | `/market` |
| Weekly challenges created by moderators; students send what they did (with an optional photo), a moderator approves, the student's grade gets points | `/challenges` |
| Points and badges. Points are **private to each student**; badges show on profiles | `/points` |
| Class vs class leaderboard: grades ranked by average points per student (this week / all time). Individual students are never ranked | `/leaderboard` |
| Polls (school-wide by moderators, or for one club by its leader). Votes are private; totals show after you vote | `/polls` |
| Volunteering hours: log hours, a moderator checks them, then download a certificate (save as PDF from the print screen) | `/volunteering` |
| Tawjihi corner: questions answered by classmates and **alumni mentors** (graduates, marked with a 🎓 badge) | `/tawjihi` |
| Student council page and elections with a **secret ballot**; results show only after voting closes; elections can be limited to certain grades | `/council` |
| Suggestion box: read and answered by the student council and admins | `/suggestions` |
| "Talk to the counselor": a private conversation that **only the student and the counselor** can read (not admins, not moderators). Works even for suspended students | `/counselor` |

Safety rules for minors are enforced **inside the database** (Row Level Security), not just in the website. That means even a bug in a page can't show one school's data to another, and students can't make themselves admins.

- **No anonymous posting.** Real names come from the school Google account and can't be edited.
- **No ranking of individual students.** The dashboard compares grades and clubs only.
- **Private messages stay private.** Moderators never read chats. They only see a copy of a message someone reported. Reports about private messages go to admins only, not to student moderators.
- **Points are private.** Each student only sees their own points. The leaderboard ranks grades, never people.
- **Votes are secret.** Nobody can see who voted for what in polls and elections, not even admins.
- **Alumni and the counselor can't send private messages to students.** Alumni answer in public (Tawjihi corner), and the counselor has a separate private channel.
- **Nothing is public.** Every page needs sign-in, and search engines are told not to index anything (robots.txt, a meta tag and an HTTP header).

## Roles

- **Student**: everyone, by default.
- **Moderator**: a trusted student (or staff member) who reviews reports, approves clubs and events, and can suspend students for 1, 7 or 30 days.
- **Admin**: everything a moderator can do, plus managing accounts, school settings, announcements, the student council, elections and stats. Admins can also lift suspensions or suspend permanently.
- **School counselor**: an adult staff member. The only person who can read "Talk to the counselor" messages.
- **Alumni mentor**: a graduate who answers in the Tawjihi corner. No grade, no points, no private messages.

Admins change roles at **Admin → Students → (a person) → Role**, and mark alumni mentors on the same page. The counselor and alumni can also be added in advance in **Admin → Settings → email list**.

## Run it on your computer

You need, once:

1. **Node.js 20 or newer**: https://nodejs.org (pick "LTS").
2. **Docker Desktop**: https://www.docker.com/products/docker-desktop. It runs a private copy of Supabase on your computer. Open it and leave it running.
3. **Git**: https://git-scm.com

Then, in a terminal:

```bash
git clone https://github.com/ykjh113009-dot/pbs-go.git
cd pbs-go
npm install

# Start the local database (the first time takes a few minutes to download)
npx supabase start
```

When it finishes, it prints a few values. Make your settings file:

```bash
cp .env.example .env.local
```

Open `.env.local` in a text editor and fill in:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the **Publishable key** that `npx supabase status` prints (starts with `sb_publishable_`).
- `SUPABASE_SECRET_KEY`: the **Secret key** (starts with `sb_secret_`).

Leave the rest as it is. Then start the website:

```bash
npm run dev
```

Open **http://localhost:3000**. You'll see **Demo mode** on the login page: tap a fake account to sign in.

| Demo account | Role | Good for showing |
|---|---|---|
| Rania Haddad | Admin, grade 12 | Dashboard, students, announcements, settings, private-message reports |
| Omar Khalil | Moderator, grade 11 | Report queue, approving clubs and events |
| Layla Nasser | Student, Robotics leader | Club feed, suggesting an event, cancelling/moving it |
| Yousef Saleh | Student, Football captain | Clubs, events |
| Maya Odeh | Student, new in grade 9 | Joining clubs, chat, RSVP, reporting a bully, volunteering certificate, tutoring |
| Hiba Saadeh | School counselor (staff) | The private counselor inbox |
| Khalil Mansour | Alumni mentor, class of 2024 | Answering in the Tawjihi corner |

The demo data has 45 fake students, 10 clubs (2 waiting for approval), 9 events, chats, a filtered post and a reported bullying message. For Phase 2 it adds 6 tutors, 7 marketplace items, 3 weekly challenges, 3 polls, volunteering hours, Tawjihi questions with alumni answers, a council with an open and a closed election, suggestions, and one counselor conversation (between Yousef and the counselor).

Useful commands:

```bash
npm run db:reset   # wipe the local database and reload the demo data
npm run db:stop    # stop the local database (Docker)
npm run typecheck  # check the code for mistakes
npm run lint
```

## A 5-minute demo for the principal

1. **Sign in as Maya** (new student). Show Home: announcements, upcoming events, posts from her clubs.
2. Open **Events → Clubs Fair** and tap **I'm going**. Open the same event as another account in a second browser window: the count changes live.
3. Open **Clubs → Robotics → Chat** and send a message. In the second window (Layla) it appears instantly.
4. Type a bad word in the chat. Only Maya sees it, marked "waiting for a moderator".
5. **Sign in as Omar** (moderator) → shield icon → **Reports**. Show the filtered message and the reported post, then **Approvals**: approve the Photography Club.
6. **Sign in as Rania** (admin) → **Reports**. The bullying private message is only visible to admins. Remove it and suspend the sender for 1 day.
7. Rania → chart icon → **Admin dashboard**: "% of students in at least one club", participation by grade, volunteering hours, tutors.
8. **Phase 2 tour as Maya** (grid icon → More): this week's challenge, the grade leaderboard, her volunteering certificate, the Tawjihi corner with an alumni answer, the council election, and "Talk to the counselor".
9. **Sign in as Hiba** (counselor) → lock icon: only she can read the counselor conversations. Rania (admin) can't open them.

## How to test each feature

| Feature | Try this |
|---|---|
| Login | Sign out (your profile → Sign out). Signed-out visitors are always sent to `/login`. |
| Welcome | Real students see it the first time they sign in with Google. (The demo accounts are already set up.) |
| Profiles | Your avatar → **Edit profile**: change avatar, interests, bio. Try a bad word in the bio: it's refused. |
| Clubs | **Clubs → Request a club** as Maya. As Omar, approve it in **Moderation → Approvals**. Maya gets a notification and becomes leader. |
| Club feed | In a club you joined, post with a photo. Delete it again. |
| Chat | Open the same club chat as two accounts in two browser windows (one normal and one private/incognito). |
| Private messages | Open a student's profile → **Message**. Try **Block**: neither of you can message the other. |
| Events | As Layla: Robotics → **Suggest an event** (it needs approval). As Omar: approve it. As Layla: open it → **Manage this event** → change the time or cancel. Everyone going gets a notification. |
| Reminders | Run every 10 minutes by the database (see `send_event_reminders`). |
| Reports | 🚩 on any post, message, profile, club or event. |
| Suspension | As Omar, suspend someone from a report. They see a red banner and can't post, chat or RSVP. |
| Admin | Rania → chart icon: Students (filters, change grade/role, remove), Announcements, Settings (grades, email list, blocked words). |
| Tutoring | As Maya: More → Tutors → Ask for help (Omar). As Omar: Requests → Accept & chat. As Maya: "We met — it helped!" Omar gets 15 points. |
| Marketplace | As Maya: More → Buy, sell & swap → Post an item. Put a bad word in the title: it's hidden until a moderator checks it. |
| Weekly challenge | As Maya: More → Weekly challenge → "I did it!". As Omar: Moderation → Approvals → Approve. Grade 9 goes up on the leaderboard. |
| Volunteering | As Maya: log hours. As Omar: approve them in Approvals. As Maya: Get my certificate → Download as PDF. |
| Polls | As Maya: vote in the open poll; the results appear after you vote. As Rania: Polls → New poll. |
| Tawjihi | As Maya: Ask a question. As Khalil (alumni): answer it. The answer shows with a 🎓 badge. |
| Council | As Rania: More → Student council → Create an election (it opens tomorrow) → Add candidates. Grade 10 students can vote in the demo's open election. |
| Suggestions | As Maya: send an idea. As Omar (council vice president) or Rania: Suggestion box → Inbox → reply. |
| Counselor | As Maya: More → Talk to the counselor. As Hiba: lock icon → reply. Maya gets a quiet "You have a new private reply" alert. |

## Project structure

```
app/                     every page of the website
  login/, welcome/       sign-in and first-time setup
  (main)/                pages for signed-in students (menu bar at the bottom)
    home/ clubs/ events/ messages/ notifications/ people/ profile/
    more/                hub for the Phase 2 features
    tutors/ market/ challenges/ points/ leaderboard/ polls/
    volunteering/ tawjihi/ council/ suggestions/ counselor/
    moderation/          report queue, approvals, history (moderators + admins)
    admin/               dashboard, students, announcements, settings (admins)
  actions/               "server actions": the code forms call to change data
  api/push/dispatch/     sends phone notifications (called on a schedule)
components/              reusable building blocks (post card, chat, report button…)
lib/                     helpers: Supabase connection, sign-in checks, time zone, push
supabase/
  migrations/            the database: tables, security rules, filter, actions
  seed.sql               fake demo data (local/demo only)
  demo-setup.sql         all of the above in one file, for a demo project (npm run db:demo-sql)
public/                  avatars, app icon, service worker, robots.txt
proxy.ts                 sends signed-out visitors to /login
```

The time zone is always **Asia/Hebron**, whatever the phone's settings.

## Going online

See **[DEPLOY.md](DEPLOY.md)** for step-by-step instructions (Supabase, Google sign-in, Vercel, school IT approval).

## Before the real pilot: please check

- **Helpline numbers.** The counselor pages say to call the Sawa helpline **121** or an ambulance on **101** in an emergency. Please confirm these with the school.
- **The counselor account.** Make sure the counselor is a real adult staff member, and that the school agrees how urgent messages are handled outside school hours.
- **Election rules.** Check with the council that the election settings (who can vote, when results show) match the school's rules.
