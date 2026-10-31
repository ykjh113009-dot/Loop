-- Undo for 20261030000001_signin_hardening.sql. Not run automatically.
-- Puts the demo back to how it was before the hardening: the old sign-up
-- function, and internal functions callable by signed-in users again.
-- (Re-opening them restores a known security problem; only use this if the
-- hardening breaks something that cannot be fixed another way.)

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(new.email);
  v_school public.schools;
  v_roster public.roster;
  v_name text;
begin
  select * into v_school from public.schools
  where email_domain = split_part(v_email, '@', 2);

  if v_school.id is null then
    raise exception 'NOT_SCHOOL_EMAIL: Please sign in with your school email address.';
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

alter table public.schools drop column if exists google_only;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.prorettype = 'trigger'::regtype
        or p.proname in ('notify','log_action','notify_club_about_event','send_event_reminders','claim_push_batch',
                         'award_points','award_badges','points_today','contains_blocked_word','reject_blocked'))
  loop
    execute format('grant execute on function %s to authenticated', r.fn);
  end loop;
end $$;
