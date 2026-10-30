-- =============================================================================
-- Loop: sign-in hardening
--  1. Re-lock database-internal functions that the Phase 2 security file
--     accidentally opened to every signed-in user again.
--  2. New accounts must come through Google with a verified school email.
-- =============================================================================

-- 1. Internal functions -------------------------------------------------------
-- Trigger functions are only ever run by the database itself.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
  end loop;
end $$;

-- Helpers that other database functions call. The app never calls them.
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.log_action(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.notify_club_about_event(uuid) from public, anon, authenticated;
revoke execute on function public.send_event_reminders() from public, anon, authenticated;
revoke execute on function public.claim_push_batch(int) from public, anon, authenticated;
revoke execute on function public.award_points(uuid, int, text, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.award_badges(uuid) from public, anon, authenticated;
revoke execute on function public.points_today(uuid, text) from public, anon, authenticated;
revoke execute on function public.contains_blocked_word(uuid, text) from public, anon, authenticated;
revoke execute on function public.reject_blocked(uuid, text) from public, anon, authenticated;

-- 2. Google-only sign-up --------------------------------------------------------
-- Real schools only accept Google accounts. The demo school turns this off
-- because its fake students use an email and password.
alter table public.schools add column google_only boolean not null default true;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_school public.schools;
  v_roster public.roster;
  v_name text;
begin
  -- The domain must match a school exactly (so "pioneers.edu.ps.evil.com"
  -- and "gmail.com" both fail).
  select * into v_school from public.schools
  where email_domain = split_part(v_email, '@', 2);

  if v_school.id is null then
    raise exception 'NOT_SCHOOL_EMAIL: Please sign in with your school email address.';
  end if;

  if v_school.google_only then
    if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google' then
      raise exception 'NOT_GOOGLE: Please sign in with Google.';
    end if;
    -- Google says whether it has verified the address. Refuse an explicit "no".
    if lower(coalesce(new.raw_user_meta_data ->> 'email_verified', 'true')) = 'false' then
      raise exception 'NOT_VERIFIED: This email address is not verified.';
    end if;
  end if;

  select * into v_roster from public.roster
  where school_id = v_school.id and email = v_email;

  if v_school.roster_required and v_roster.email is null then
    raise exception 'NOT_ON_ROSTER: Your school has not added this email yet. Ask your school admin.';
  end if;

  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(v_email, '@', 1)
  );

  insert into public.profiles (id, school_id, full_name, grade, role, alumni_year)
  values (new.id, v_school.id, left(v_name, 80), v_roster.grade,
          coalesce(v_roster.role, 'student'), v_roster.alumni_year);

  insert into public.private_profiles (id, email) values (new.id, v_email);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
