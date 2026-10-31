-- =============================================================================
-- Loop: admins that are approved before they sign in.
-- An email on this list becomes an admin the first time it signs in (it must
-- still pass the normal school-email and roster checks). Nobody can edit the
-- list from the app: only the database owner can, so no one can make
-- themselves an admin.
-- =============================================================================

create table public.admin_emails (
  school_id uuid not null references public.schools (id) on delete cascade,
  email text not null check (email = lower(email)),
  created_at timestamptz not null default now(),
  primary key (school_id, email)
);
alter table public.admin_emails enable row level security;
revoke all on public.admin_emails from anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_school public.schools;
  v_roster public.roster;
  v_name text;
begin
  select * into v_school from public.schools
  where email_domain = split_part(v_email, '@', 2);

  if v_school.id is null then
    raise exception 'NOT_SCHOOL_EMAIL: Please sign in with your school email address.';
  end if;

  if v_school.google_only then
    if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google' then
      raise exception 'NOT_GOOGLE: Please sign in with Google.';
    end if;
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
          case
            when exists (select 1 from public.admin_emails a where a.school_id = v_school.id and a.email = v_email)
              then 'admin'
            else coalesce(v_roster.role, 'student')
          end,
          v_roster.alumni_year);

  insert into public.private_profiles (id, email) values (new.id, v_email);
  return new;
end;
$$;
