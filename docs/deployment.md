# Deployment

## How it works now

| Thing | Value |
| --- | --- |
| Code | GitHub `ykjh113009-dot/Loop`, branch `main` |
| Hosting | Vercel project `loop-demo-login` (team `pbs-go`). Every push to `main` builds production automatically. |
| Live address | `https://loop-ps.vercel.app` (moved by hand after each build, see below) and `https://loop-demo-login-pbs-go.vercel.app` (automatic) |
| Database today | Supabase project "demo loop" (`goksrrtovdnvxpsgzsvd`) |
| Database for the real school | Supabase project `loop-school` (`klxhqpapqzlchnjfgpcv`, Frankfurt), paused until a project slot is free |

`loop-ps.vercel.app` still belongs to the old Vercel project `loop`, so it does not follow new builds by itself.
To make it automatic: Vercel → project `loop` → Settings → Domains → remove `loop-ps.vercel.app`, then
project `loop-demo-login` → Settings → Domains → add it.

## Before every production deployment

1. `npm run lint`, `npm run typecheck`, `npm run build`
2. `npm run db:test` and the browser tests in `tests/e2e/`
3. Apply new files in `supabase/migrations/` to the hosted database **before** pushing the code that needs them
4. Push to `main`, wait for the build, open the site signed out and signed in

Rollback: Vercel → Deployments → previous production build → Promote.

## Environment variables (Vercel)

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Which Supabase project the site talks to (safe to be public) |
| `NEXT_PUBLIC_GOOGLE_HOSTED_DOMAIN` | School email domain suggested to Google |
| `DEMO_MODE`, `DEMO_PASSWORD` | Demo accounts on previews only. `DEMO_MODE=false` in production. |
| `SUPABASE_SECRET_KEY`, `CRON_SECRET`, VAPID keys | Push notifications (not set yet). Server only, never public. |

## Moving the live site to `loop-school`

1. Free a Supabase project slot (the Free plan allows two active projects per owner), then restore `loop-school`.
2. Apply every file in `supabase/migrations/` in order. Do **not** run `seed.sql` (demo data).
3. Insert the school row and the owner email:
   `schools` (name, `email_domain = 'pioneers.edu.ps'`, `google_only = true`, `admin_mfa_required = true`) and
   `admin_emails` (owner email, `role = 'super_admin'`, `is_owner = true`).
4. Supabase → Authentication → Sign In / Providers → Google: paste the Google client ID and secret.
   URL Configuration: Site URL `https://loop-ps.vercel.app`, Redirect URL `https://loop-ps.vercel.app/auth/callback`.
   In Google Cloud, add `https://klxhqpapqzlchnjfgpcv.supabase.co/auth/v1/callback` as an authorised redirect URI.
5. In Vercel set the two `NEXT_PUBLIC_SUPABASE_*` variables for **Production** to the `loop-school` values; keep Preview on the demo project.
6. Redeploy, sign in as the owner, set up two-step sign-in at `/security`.
