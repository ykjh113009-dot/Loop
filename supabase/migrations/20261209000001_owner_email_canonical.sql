-- Gmail ignores dots and "+tags" in the part before the @ (yousef.kareem and yousefkareem are the same mailbox), and Google may
-- hand back a different spelling than the one that was typed. Owner addresses are therefore compared in a canonical form
-- (for Gmail only; every other domain is compared as written, lower-cased).
create function public.canon_email(p text) returns text
language sql immutable set search_path = '' as $$
  select case
    when split_part(lower(btrim(coalesce(p, ''))), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(btrim(p)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else lower(btrim(coalesce(p, '')))
  end
$$;
revoke all on function public.canon_email(text) from public, anon;
grant execute on function public.canon_email(text) to authenticated;

create or replace function public.is_platform_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() and exists (
    select 1 from public.platform_owners po
    join public.private_profiles pp on public.canon_email(pp.email) = public.canon_email(po.email)
    where pp.id = (select auth.uid())
  )
$$;
revoke all on function public.is_platform_owner() from public, anon;
grant execute on function public.is_platform_owner() to authenticated;

create or replace function public.can_manage_account(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() and exists (
    select 1 from public.profiles t
    where t.id = p_user
      and t.school_id = public.my_school_id()
      -- A platform owner account can never be acted on from inside Loop.
      and not exists (select 1 from public.platform_owners po join public.private_profiles pp on public.canon_email(pp.email) = public.canon_email(po.email) where pp.id = t.id)
      and (public.is_platform_owner() or (not t.is_owner and (public.is_owner() or public.role_rank(public.my_role()) > public.role_rank(t.role))))
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_school public.schools;
  v_roster public.roster;
  v_admin public.admin_emails;
  v_name text;
begin
  -- The platform owner may sign in from any address (for example Gmail), but only through Google and only if Google says
  -- the address is verified. The list of owner addresses can only be changed with direct database access.
  if exists (select 1 from public.platform_owners where public.canon_email(email) = public.canon_email(v_email)) then
    if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google' then
      raise exception 'NOT_GOOGLE: Please sign in with Google.';
    end if;
    if lower(coalesce(new.raw_user_meta_data ->> 'email_verified', 'true')) = 'false' then
      raise exception 'NOT_VERIFIED: This email address is not verified.';
    end if;
    select * into v_school from public.schools order by created_at limit 1;
    v_name := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(v_email, '@', 1));
    insert into public.profiles (id, school_id, full_name, role, is_owner) values (new.id, v_school.id, left(v_name, 80), 'super_admin', false);
    insert into public.private_profiles (id, email) values (new.id, v_email);
    return new;
  end if;

  select * into v_school from public.schools
  where email_domain = split_part(v_email, '@', 2);

  if v_school.id is null then
    -- A masked trace so the owner can tell which address was refused (never the full address).
    raise warning 'Refused sign-in from a non-school address: %', left(v_email, 3) || '***@' || split_part(v_email, '@', 2);
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

  select * into v_admin from public.admin_emails
  where school_id = v_school.id and email = v_email;

  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(v_email, '@', 1)
  );

  insert into public.profiles (id, school_id, full_name, grade, role, alumni_year, is_owner)
  values (new.id, v_school.id, left(v_name, 80), v_roster.grade,
          coalesce(v_admin.role, v_roster.role, 'student'),
          v_roster.alumni_year,
          coalesce(v_admin.is_owner, false)
            and not exists (select 1 from public.profiles where school_id = v_school.id and is_owner));

  insert into public.private_profiles (id, email) values (new.id, v_email);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_member(p_user uuid, p_grade integer, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t public.profiles;
  v_grades int[];
begin
  if not public.is_admin() then
    raise exception 'Only admins can change accounts.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  select grades into v_grades from public.schools where id = t.school_id;
  if p_grade is not null and not (p_grade = any (v_grades)) then
    raise exception 'That grade does not exist at your school.';
  end if;
  if p_role not in ('student', 'moderator', 'admin', 'super_admin', 'counselor') then
    raise exception 'Unknown role';
  end if;

  if exists (select 1 from public.platform_owners po join public.private_profiles pp on public.canon_email(pp.email) = public.canon_email(po.email) where pp.id = t.id) and t.id <> auth.uid() then
    raise exception 'A platform owner account cannot be changed from inside Loop.';
  end if;

  if p_role <> t.role then
    if t.id = auth.uid() then
      raise exception 'You cannot change your own role.';
    end if;
    if not public.is_super_admin() then
      raise exception 'Only a Super Admin can change roles.';
    end if;
    if t.is_owner then
      raise exception 'The owner''s role cannot be changed.';
    end if;
    if (p_role = 'super_admin' or t.role = 'super_admin') and not public.is_owner() then
      raise exception 'Only the platform owner can appoint or remove Super Admins.';
    end if;
  elsif t.id <> auth.uid() and not public.can_manage_account(t.id) then
    raise exception 'You cannot change this account.';
  end if;

  update public.profiles
  set grade = case when p_role = 'counselor' then null else coalesce(p_grade, grade) end,
      role = p_role
  where id = t.id;

  if p_grade is distinct from t.grade and p_grade is not null and p_role <> 'counselor' then
    perform public.log_action(t.school_id, 'change_grade', 'profile', t.id,
      t.full_name || ': grade ' || coalesce(t.grade::text, '-') || ' → ' || p_grade);
  end if;
  if p_role <> t.role then
    perform public.log_action(t.school_id, 'change_role', 'profile', t.id,
      t.full_name || ': ' || t.role || ' → ' || p_role);
    perform public.notify(t.id, 'role', 'Your role on Loop changed',
      'You are now: ' || replace(p_role, '_', ' ') || '.', '/home');
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_onboarding(p_grade integer, p_avatar text, p_bio text, p_interests bigint[], p_section text DEFAULT NULL::text, p_photo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me public.profiles;
  v_grades int[];
  v_no_grade boolean;
  v_section text := upper(btrim(coalesce(p_section, '')));
begin
  select * into me from public.profiles where id = auth.uid() and deactivated_at is null;
  if me.id is null then
    raise exception 'Not signed in';
  end if;
  v_no_grade := me.role = 'counselor' or me.alumni_year is not null
    or exists (select 1 from public.platform_owners po join public.private_profiles pp on public.canon_email(pp.email) = public.canon_email(po.email) where pp.id = me.id);
  select grades into v_grades from public.schools where id = me.school_id;
  if not v_no_grade and me.grade is null and not (p_grade = any (v_grades)) then
    raise exception 'Please choose your grade.';
  end if;
  if not v_no_grade and me.section is null and v_section !~ '^[A-F]$' then
    raise exception 'Please choose your class letter.';
  end if;
  if p_avatar !~ '^[ab][0-9]{2}$' then
    raise exception 'Please choose an avatar.';
  end if;
  if coalesce(array_length(p_interests, 1), 0) > 10 then
    raise exception 'Choose up to 10 interests.';
  end if;
  perform public.reject_blocked(me.school_id, coalesce(p_bio, ''));

  update public.profiles
  set grade = case when v_no_grade then null else coalesce(me.grade, p_grade) end,
      section = case when v_no_grade then null else coalesce(me.section, nullif(v_section, '')) end,
      avatar = p_avatar,
      photo_path = coalesce(nullif(p_photo, ''), me.photo_path),
      bio = left(btrim(coalesce(p_bio, '')), 200),
      onboarded_at = coalesce(onboarded_at, now())
  where id = me.id;

  delete from public.profile_interests where profile_id = me.id;
  insert into public.profile_interests (profile_id, interest_id)
  select me.id, unnest(coalesce(p_interests, '{}'));
end;
$function$;
