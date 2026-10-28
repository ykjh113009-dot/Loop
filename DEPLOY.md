# Putting Loop online

This takes about an hour the first time. You'll create three accounts (Supabase, Google Cloud, Vercel). Then the school's IT person approves the app.

> **Two separate sites are best:** a **real** site for the school (no demo data, demo mode off) and, if you want, a **demo** site for showing other principals. Each needs its own Supabase project. Do the real one first.

---

## 1. Supabase (the database)

1. Go to https://supabase.com and sign up (you can use GitHub).
2. Click **New project**.
   - Name: `pbs-go`
   - Database password: click **Generate**, then save it somewhere safe (a password manager).
   - Region: **Central EU (Frankfurt)**, the closest to Palestine.
3. Wait about 2 minutes until the project is ready.
4. On your computer, in the `pbs-go` folder, send the database design to the new project:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push
   ```

   `YOUR-PROJECT-REF` is the code in your project's web address: `https://supabase.com/dashboard/project/`**`abcdefghijkl`**.
   If `db push` complains about **pg_cron**: in the dashboard go to **Database → Extensions**, turn on **pg_cron**, then run `npx supabase db push` again.

5. Add your school. In the dashboard, open **SQL Editor**, paste this and click **Run**:

   ```sql
   insert into public.schools (name, email_domain, grades)
   values ('Pioneers School', 'pioneers.edu.ps', '{9,10,11,12}');
   ```

   (Change the grades if the school has different ones. Admins can also change them later in **Admin → Settings**.)

6. **Turn off password sign-up.** This is important. Go to **Authentication → Sign In / Providers → Email** and switch it **off**. Real students must only use Google. Otherwise someone could create an account with a school address they don't own.

7. Keep this tab open. You'll need these from **Project Settings → API Keys**:
   - Project URL (`https://abcdefghijkl.supabase.co`)
   - **Publishable** key (`sb_publishable_…`)
   - **Secret** key (`sb_secret_…`). Never share it.

## 2. Google sign-in

1. Go to https://console.cloud.google.com and sign in. It's best to use the school's or your own Google account, not a student's.
2. Create a project called `Loop`.
3. Open **Google Auth Platform** (search for "OAuth consent screen").
   - **Branding**: App name `Loop`, your support email, and your logo if you have one.
   - **Audience**: User type **External**, then **Publish app** so it's "In production". Loop only asks for name and email, so Google doesn't need to review it.
4. **Clients → Create client → Web application**.
   - **Authorized redirect URIs**: `https://abcdefghijkl.supabase.co/auth/v1/callback` (your Project URL + `/auth/v1/callback`).
   - Click Create. Copy the **Client ID** and **Client secret**.
5. Back in Supabase: **Authentication → Sign In / Providers → Google**. Turn it on, paste the Client ID and secret, and save.

## 3. Vercel (the website)

1. Go to https://vercel.com and sign up **with GitHub**.
2. **Add New → Project**, then choose the **pbs-go** repository and click **Import**.
3. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your publishable key |
   | `SUPABASE_SECRET_KEY` | your secret key |
   | `DEMO_MODE` | `false` |
   | `NEXT_PUBLIC_GOOGLE_HOSTED_DOMAIN` | `pioneers.edu.ps` |
   | `CRON_SECRET` | a long random password (e.g. from a password manager) |

4. Click **Deploy**. After a minute or two you get an address like `https://pbs-go.vercel.app`.
5. Back in Supabase: **Authentication → URL Configuration**.
   - **Site URL**: `https://pbs-go.vercel.app`
   - **Redirect URLs**: add `https://pbs-go.vercel.app/auth/callback`

From now on, every time code is pushed to GitHub's `main` branch, Vercel updates the site automatically.

## 4. The school's IT person approves the app

Google blocks students **under 18** from signing in to outside apps until the school allows them. Send the school's Google Workspace admin this message:

> Hi! Please allow our student app "Loop" for student accounts.
> In the Google Admin console: **Security → Access and data control → API controls → Manage Third-Party App Access → Add app → OAuth App Name Or Client ID**, search for this Client ID: `PASTE-YOUR-CLIENT-ID`, pick it, apply it to the students' organisational unit, and set access to **Trusted**.
> It only asks for students' name and email address. Thank you!

## 5. Make yourself the first admin

1. Open the site and **sign in with your own `@pioneers.edu.ps` Google account**. Finish the welcome screen.
2. In Supabase **SQL Editor**, run (with your email):

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@pioneers.edu.ps');
   ```

3. Reload the site. The chart icon (Admin) and shield icon (Moderation) now appear at the top. From now on you can make other people moderators or admins in **Admin → Students**.

**The school counselor:** ask the counselor to sign in once with their school Google account. Then, in **Admin → Students**, open their account and set **Role → School counselor (staff)**. Only the counselor can read "Talk to the counselor" messages. You, as admin, can't. Alumni mentors are set up on the same page (**Alumni mentor → graduation year**). You can also add both in advance in **Admin → Settings → email list**.

**Recommended before students join:** In **Admin → Settings**, paste the list of student emails with their grades, then tick **Only allow emails on the list**. That way teachers, staff and graduates can't join by accident.

## 6. Phone alerts (optional)

1. On your computer run `npx web-push generate-vapid-keys`.
2. In Vercel, add these environment variables, then **Deployments → … → Redeploy**:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = the public key
   - `VAPID_PRIVATE_KEY` = the private key
   - `VAPID_SUBJECT` = `mailto:your-email@example.com`
3. In Supabase **SQL Editor**, run this to send waiting alerts (like event reminders) every 5 minutes. Use your own site address and `CRON_SECRET`:

   ```sql
   create extension if not exists pg_net;
   select cron.schedule(
     'send-push-alerts', '*/5 * * * *',
     $$ select net.http_get(
          url := 'https://pbs-go.vercel.app/api/push/dispatch',
          headers := jsonb_build_object('Authorization', 'Bearer YOUR-CRON-SECRET')
        ) $$
   );
   ```

Students turn alerts on in **Alerts → Turn on**. On iPhones they first need to open the site in Safari and tap **Share → Add to Home Screen**.

## 7. A demo site (optional)

Repeat steps 1 and 3 with a **second** Supabase project and a **second** Vercel project, with these changes:

- If you already made a demo project with an older version of `demo-setup.sql`, create a **new** Supabase project for the new version. It now includes Phase 2.
- Skip step 1.4 (no terminal needed). Instead, in step 1.5 paste the whole of **`supabase/demo-setup.sql`** into the SQL Editor and click Run. It creates the database and the demo data in one go.
- Keep **Email** sign-in **on** (step 1.6). The demo accounts use it.
- In Vercel, set `DEMO_MODE` to `true` and add `DEMO_PASSWORD` = `pbsgo-demo`.
- Skip Google sign-in.

## Costs

| Service | Free plan | When to upgrade |
|---|---|---|
| Supabase | Free. It pauses a project after 1 week with no activity. | **Pro, about $25/month**, before the real pilot. No pausing, daily backups. |
| Vercel | Free "Hobby" plan, which is for non-commercial use only. | **Pro, about $20/month**, once schools pay you. |
| Google sign-in | Free | — |

## Adding another school later

1. Run `insert into public.schools (name, email_domain, grades) values ('New School', 'newschool.edu.ps', '{10,11,12}');`
2. Ask that school's IT to approve the app (step 4).
3. Make their first admin (step 5).

Each school only ever sees its own students, clubs and events.
