# Backups and recovery

## Current state (Supabase Free plan)

- There are **no automatic backups** on the Free plan.
- A Free project **pauses after about one week without traffic** and must be restored by hand.
- Only two Free projects can be active at once.

## Options (owner decision needed)

| Option | Cost | What you get |
| --- | --- | --- |
| Supabase Pro | about $25 per month | Daily automatic backups kept 7 days, no pausing, restore with one click. |
| Nightly GitHub Action (`pg_dump`) | free | An encrypted dump every night stored as a GitHub artifact. Needs the database password saved as a GitHub secret. Restores are manual. |

Recommendation: the GitHub Action now, Supabase Pro before real students join.

## Rules for database changes

1. Every change is a file in `supabase/migrations/` and is committed.
2. It is applied to the local database first (`npm run db:reset`) and tested (`npm run db:test`).
3. Changes only add things. Anything that deletes data needs the owner's approval and a backup first.
4. Rollback scripts live in `supabase/rollbacks/`.

## Recovering

- **Bad deployment**: in Vercel, promote the previous production deployment (Deployments → ⋯ → Promote).
- **Bad migration**: run the matching file in `supabase/rollbacks/`, then redeploy the previous commit.
- **Lost data**: restore the latest backup (Pro: Database → Backups; Action: `pg_restore` the latest artifact).
