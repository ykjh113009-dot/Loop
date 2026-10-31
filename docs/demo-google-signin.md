# Turning on Google sign-in for the Loop demo

The demo site (https://loop-ps.vercel.app) uses the Supabase project **Pbs-go**
(`goksrrtovdnvxpsgzsvd`). Until the steps below are done, the **Continue with Google**
button shows "Google sign-in isn't switched on for this site yet" and the demo
accounts keep working as before.

Nothing here needs code changes. It is all settings in Google Cloud and Supabase.

## How the demo's two sign-in methods live together

| Who | How they sign in | Can new accounts be created this way? |
|---|---|---|
| The 7 demo accounts on the login page | Demo panel (email and the shared demo password), only while `DEMO_MODE=true` | **No.** They already exist. The database refuses new password accounts. |
| Real people with a school Google account | Continue with Google | Yes, if the email ends with `@pioneers.edu.ps`, Google says it is verified, and (optionally) it is on the roster |

Keep the **Email** provider switched **on** in Supabase. The demo accounts need it.

## 1. Google Cloud (about 10 minutes)

1. Open https://console.cloud.google.com and create a project called `Loop`.
2. Open **Google Auth Platform**.
   - **Branding**: app name `Loop`, your support email. Skip the logo for now.
   - **Audience**: choose **External**, then **Publish app** so it says "In production".
   - **Data access**: only `openid`, `email` and `profile` are needed.
3. **Clients → Create client → Web application**.
   - Authorized redirect URI: `https://goksrrtovdnvxpsgzsvd.supabase.co/auth/v1/callback`
   - Create it, then copy the **Client ID** and **Client secret**.

## 2. Supabase (Pbs-go project)

1. **Authentication → Sign In / Providers → Google**: switch it on, paste the Client ID and
   secret, save.
2. **Authentication → URL Configuration**:
   - Site URL: `https://loop-ps.vercel.app`
   - Redirect URLs: add `https://loop-ps.vercel.app/auth/callback`
     (and `http://localhost:3000/auth/callback` if you test on your own computer).
3. Leave **Email** switched on.

## 3. Who is allowed to create an account on the demo

Anyone with a `@pioneers.edu.ps` Google account could create a profile inside the demo.
To limit it to testers, run this in the Supabase SQL Editor (use your testers' emails):

```sql
update public.schools set roster_required = true where email_domain = 'pioneers.edu.ps';
insert into public.roster (school_id, email, grade)
select id, lower(e), 12 from public.schools, unnest(array['you@pioneers.edu.ps']) as e
where email_domain = 'pioneers.edu.ps'
on conflict do nothing;
```

Admins are approved separately. An email on the `admin_emails` list becomes an admin the first
time it signs in (it must also be on the roster). Only the database owner can edit that list;
nothing in the app can. The demo currently has `ytj30809@pioneers.edu.ps` on both lists:

```sql
insert into public.admin_emails (school_id, email)
select id, 'someone@pioneers.edu.ps' from public.schools where email_domain = 'pioneers.edu.ps';
```

## 4. The school's Google admin

Google blocks students **under 18** from signing in to outside apps until the school's
Google Workspace admin allows the app (Admin console → Security → Access and data control →
API controls → Manage Third-Party App Access → add the Client ID → **Trusted**). Adults can
test before that.

## 5. Vercel

The site is behind Vercel Authentication for `*.vercel.app` addresses. People without a Vercel
login can't open it. Turn it off under **Project → Settings → Deployment Protection** when you
want others to try the demo.

## 6. Check that it works

1. Open the site in a private window and tap **Continue with Google**.
2. Pick your `@pioneers.edu.ps` account. You land on the welcome screen, then the home page.
3. Sign out from your profile page, then sign in again. You go straight to the home page.
4. Try a personal Gmail account. You are sent back to the login page with a clear message and
   no account is created.
