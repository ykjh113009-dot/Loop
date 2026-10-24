# Pbs Go

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

Safety rules for minors are enforced **inside the database** (Row Level Security), not just in the website. That means even a bug in a page can't show one school's data to another, and students can't make themselves admins.

- **No anonymous posting.** Real names come from the school Google account and can't be edited.
- **No ranking of individual students.** The dashboard compares grades and clubs only.
- **Private messages stay private.** Moderators never read chats. They only see a copy of a message someone reported. Reports about private messages go to admins only, not to student moderators.
- **Nothing is public.** Every page needs sign-in, and search engines are told not to index anything (robots.txt, a meta tag and an HTTP header).

## Roles

- **Student**: everyone, by default.
- **Moderator**: a trusted student (or staff member) who reviews reports, approves clubs and events, and can suspend students for 1, 7 or 30 days.
- **Admin**: everything a moderator can do, plus managing accounts, school settings, announcements and stats. Admins can also lift suspensions or suspend permanently.

Admins change roles at **Admin → Students → (a student) → Role**.

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
| Maya Odeh | Student, new in grade 9 | Joining clubs, chat, RSVP, reporting a bully |

The demo data has 45 fake students, 10 clubs (2 waiting for approval), 9 events, chats, a filtered post and a reported bullying message.

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
7. Rania → chart icon → **Admin dashboard**: "% of students in at least one club", participation by grade.

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

## Project structure

```
app/                     every page of the website
  login/, welcome/       sign-in and first-time setup
  (main)/                pages for signed-in students (menu bar at the bottom)
    home/ clubs/ events/ messages/ notifications/ people/ profile/
    moderation/          report queue, approvals, history (moderators + admins)
    admin/               dashboard, students, announcements, settings (admins)
  actions/               "server actions": the code forms call to change data
  api/push/dispatch/     sends phone notifications (called on a schedule)
components/              reusable building blocks (post card, chat, report button…)
lib/                     helpers: Supabase connection, sign-in checks, time zone, push
supabase/
  migrations/            the database: tables, security rules, filter, actions
  seed.sql               fake demo data (local/demo only)
public/                  avatars, app icon, service worker, robots.txt
proxy.ts                 sends signed-out visitors to /login
```

The time zone is always **Asia/Hebron**, whatever the phone's settings.

## Going online

See **[DEPLOY.md](DEPLOY.md)** for step-by-step instructions (Supabase, Google sign-in, Vercel, school IT approval).

## Phase 2 (not built yet)

Peer tutors and study buddies, marketplace, weekly challenges, points and badges, class-vs-class leaderboard, polls, volunteering hours and certificates, Tawjihi corner with alumni mentors, student council voting, suggestion box, and a private "talk to the counselor" button.
