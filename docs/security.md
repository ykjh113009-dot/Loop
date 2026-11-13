# Security

## Foundations

- **Sign-in**: Google only on the real school (`schools.google_only`). The database trigger `handle_new_user`
  refuses any email outside the school domain, any non-Google account and any unverified email.
- **Sessions**: Supabase cookies, refreshed on every request by `proxy.ts`. Signed-out visitors only reach
  `/login`, `/auth`, `/rules` and `/privacy`.
- **School isolation**: every table has `school_id`; every rule compares it with the caller's school.
  Tested with a second school in `supabase/tests/phase1_permissions.sql`.
- **No client trust**: the browser only holds the publishable key. Roles are read from the database on every
  request, never from the browser. The secret key is used only on the server for push notifications.
- **SQL injection**: all queries go through the Supabase client or typed database functions; no SQL is built from text.
- **XSS**: React escapes all output; no `dangerouslySetInnerHTML` on user content.
- **CSRF**: changes go through Next.js server actions (same-origin checks) and SameSite cookies.
- **Headers**: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin`, `noindex`.
- **Uploads**: one private bucket, images only, 1 MB, stored under `<school>/<user>/`.

## Added in Phase 1

| Protection | Where |
| --- | --- |
| Role ranks, owner, Super Admin | `role_rank`, `is_super_admin`, `is_owner`, `can_manage_account` |
| Two-step sign-in for admins | `mfa_ok()` inside `is_admin()` and `is_staff()`; page at `/security` |
| Rate limits | `check_rate` + `guard` triggers (see table below) |
| Activity restrictions | `account_restrictions`, `set_restriction`, `is_restricted` |
| Sign-in and device log | `security_events`, `record_security_event`; alert on a new browser |
| Tamper-proof activity log | trigger `immutable` on `moderation_log` |
| Internal functions locked | `check_rate`, `grant_leadership`, trigger functions: no API access |

### Rate limits

| Action | Limit |
| --- | --- |
| Club posts | 20 per hour |
| Messages | 40 per minute |
| New clubs | 3 per day |
| New events, listings, suggestions | 10 per day |
| Reports | 20 per hour |
| Tawjihi questions / answers | 10 / 30 per hour |
| Admin applications | 3 per 30 days |
| Leadership requests | 5 per week |

## Known limits

- The address and browser in `security_events` are reported by the website, so a student could falsify their
  **own** entries through the API. They cannot touch anyone else's.
- If the owner loses their authenticator, it is cleared in the Supabase dashboard
  (Authentication → Users → the account → remove the factor).
- Bot protection (CAPTCHA) is not needed while sign-in is Google only.
