-- =============================================================================
-- Loop Phase 1: foundation
--
--   1. Roles: Super Admin (and one platform owner) on top of Admin / Moderator.
--   2. Two-step sign-in (2FA) for Admins and Super Admins, checked in the database.
--   3. Strict account rules: who may change, suspend or remove whom.
--   4. Admin applications (reviewed by Super Admins).
--   5. Student leadership roles and requests.
--   6. Activity restrictions and rate limits (anti-spam).
--   7. Security events and a tamper-proof activity log.
--
-- Everything here only ADDS to the database. No existing rows are deleted.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'moderator', 'admin', 'super_admin', 'counselor'));

alter table public.profiles
  -- The platform owner: the only one who can appoint or remove Super Admins.
  add column is_owner boolean not null default false,
  -- Class letter, e.g. "A" for 11A. Used later for houses.
  add column section text check (section ~ '^[A-Z]$');
create unique index profiles_one_owner on public.profiles (school_id) where is_owner;
alter table public.profiles add constraint owner_is_super_admin check (not is_owner or role = 'super_admin');

alter table public.schools
  add column admin_mfa_required boolean not null default true;

-- Emails that get an administrative role the first time they sign in.
alter table public.admin_emails
  add column role text not null default 'admin' check (role in ('moderator', 'admin', 'super_admin')),
  add column is_owner boolean not null default false;
alter table public.admin_emails add constraint owner_email_is_super_admin check (not is_owner or role = 'super_admin');

-- 0 student/counselor, 1 moderator, 2 admin, 3 super admin.
create function public.role_rank(p_role text) returns int
language sql immutable set search_path = '' as $$
  select case p_role when 'super_admin' then 3 when 'admin' then 2 when 'moderator' then 1 else 0 end
$$;

-- True when the signed-in session passed the second step (authenticator app),
-- or the school does not require it (demo schools).
create function public.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
    or not coalesce((
      select s.admin_mfa_required from public.schools s
      join public.profiles p on p.school_id = s.id
      where p.id = (select auth.uid())
    ), true)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active() and (
    public.my_role() = 'moderator'
    or (public.my_role() in ('admin', 'super_admin') and public.mfa_ok())
  )
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active() and public.my_role() in ('admin', 'super_admin') and public.mfa_ok()
$$;

create function public.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active() and public.my_role() = 'super_admin' and public.mfa_ok()
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() and exists (
    select 1 from public.profiles where id = (select auth.uid()) and is_owner
  )
$$;

-- May the signed-in admin act on this account? Only on accounts below them.
create function public.can_manage_account(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() and exists (
    select 1 from public.profiles t
    where t.id = p_user
      and t.school_id = public.my_school_id()
      and not t.is_owner
      and (public.is_owner() or public.role_rank(public.my_role()) > public.role_rank(t.role))
  )
$$;

-- New accounts: role comes from the approved-admin list (if listed).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_school public.schools;
  v_roster public.roster;
  v_admin public.admin_emails;
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
$$;

-- ---------------------------------------------------------------------------
-- 2. Account management rules
-- ---------------------------------------------------------------------------

-- Admins change grades of accounts below them. Only Super Admins change roles.
-- Only the owner appoints or removes Super Admins.
create or replace function public.admin_update_member(p_user uuid, p_grade int, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
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
$$;

-- Suspensions are always temporary (1 to 365 days) and only Admins give them.
create or replace function public.suspend_user(p_user uuid, p_days int, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can suspend accounts.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  if t.id = auth.uid() then
    raise exception 'You cannot suspend yourself.';
  end if;
  if not public.can_manage_account(t.id) then
    raise exception 'You cannot suspend this account.';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'Choose between 1 and 365 days.';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Please write a reason.';
  end if;

  update public.profiles
  set suspended_until = now() + make_interval(days => p_days),
      suspension_reason = btrim(p_reason)
  where id = t.id;

  perform public.notify(t.id, 'suspended', 'Your account has been suspended',
    'For ' || p_days || ' day(s). Reason: ' || btrim(p_reason), null);
  perform public.log_action(t.school_id, 'suspend', 'profile', t.id,
    t.full_name || ' · ' || p_days || ' day(s) · ' || btrim(p_reason));
end;
$$;

create or replace function public.unsuspend_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can lift suspensions.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  if not public.can_manage_account(t.id) then
    raise exception 'You cannot change this account.';
  end if;
  update public.profiles set suspended_until = null, suspension_reason = null where id = t.id;
  perform public.notify(t.id, 'unsuspended', 'Your account is active again', 'Welcome back!', '/home');
  perform public.log_action(t.school_id, 'unsuspend', 'profile', t.id, t.full_name);
end;
$$;

create or replace function public.admin_set_deactivated(p_user uuid, p_deactivated boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove accounts.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  if t.id = auth.uid() then
    raise exception 'You cannot remove yourself.';
  end if;
  if not public.can_manage_account(t.id) then
    raise exception 'You cannot remove this account.';
  end if;
  update public.profiles
  set deactivated_at = case when p_deactivated then now() else null end
  where id = t.id;
  perform public.log_action(t.school_id, case when p_deactivated then 'remove_account' else 'restore_account' end,
    'profile', t.id, t.full_name);
end;
$$;

create or replace function public.admin_set_alumni(p_user uuid, p_year int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change accounts.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  if t.id = auth.uid() then
    raise exception 'You cannot change your own account type.';
  end if;
  if not public.can_manage_account(t.id) then
    raise exception 'You cannot change this account.';
  end if;
  update public.profiles
  set alumni_year = p_year,
      grade = case when p_year is not null then null else grade end,
      role = case when p_year is not null and role in ('moderator', 'admin', 'super_admin') then 'student' else role end
  where id = t.id;
  perform public.log_action(t.school_id, case when p_year is null then 'unset_alumni' else 'set_alumni' end,
    'profile', t.id, t.full_name || coalesce(' · class of ' || p_year, ''));
end;
$$;

-- Students set their own class letter (A, B, ...).
grant update (section) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Rate limits and activity restrictions
-- ---------------------------------------------------------------------------

create table public.rate_events (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index on public.rate_events (profile_id, action, created_at desc);
alter table public.rate_events enable row level security;
revoke all on public.rate_events from anon, authenticated;

-- Refuses when the signed-in person did `p_action` more than `p_max` times
-- in the last `p_seconds` seconds. Only called from other database functions.
create function public.check_rate(p_action text, p_max int, p_seconds int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_count int;
begin
  if v_me is null then
    return; -- database jobs and seed data
  end if;
  select count(*) into v_count from public.rate_events
  where profile_id = v_me and action = p_action
    and created_at > now() - make_interval(secs => p_seconds);
  if v_count >= p_max then
    raise exception 'RATE_LIMIT: You are doing that too often. Please wait a little and try again.';
  end if;
  insert into public.rate_events (profile_id, action) values (v_me, p_action);
  delete from public.rate_events
  where profile_id = v_me and action = p_action and created_at < now() - interval '2 days';
end;
$$;

create table public.account_restrictions (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  kind text not null check (kind in ('posting', 'commenting', 'messaging', 'creating_groups', 'publishing')),
  until timestamptz not null,
  reason text not null check (char_length(reason) between 1 and 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (profile_id, kind)
);
alter table public.account_restrictions enable row level security;
create policy "own restrictions or admin" on public.account_restrictions for select to authenticated
  using (profile_id = (select auth.uid()) or (school_id = public.my_school_id() and public.is_admin()));
revoke insert, update, delete on public.account_restrictions from authenticated;

create function public.is_restricted(p_kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.account_restrictions
    where profile_id = (select auth.uid()) and kind = p_kind and until > now()
  )
$$;

-- Admins pause (p_days) or restore (p_days null) one activity for an account.
create function public.set_restriction(p_user uuid, p_kind text, p_days int, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can restrict accounts.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  if not public.can_manage_account(t.id) then
    raise exception 'You cannot restrict this account.';
  end if;
  if p_kind not in ('posting', 'commenting', 'messaging', 'creating_groups', 'publishing') then
    raise exception 'Unknown restriction';
  end if;

  if p_days is null then
    delete from public.account_restrictions where profile_id = t.id and kind = p_kind;
    perform public.log_action(t.school_id, 'lift_restriction', 'profile', t.id,
      t.full_name || ' · ' || p_kind);
    return;
  end if;
  if p_days < 1 or p_days > 365 then
    raise exception 'Choose between 1 and 365 days.';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Please write a reason.';
  end if;

  insert into public.account_restrictions (profile_id, school_id, kind, until, reason, created_by)
  values (t.id, t.school_id, p_kind, now() + make_interval(days => p_days), left(btrim(p_reason), 300), auth.uid())
  on conflict (profile_id, kind) do update
    set until = excluded.until, reason = excluded.reason, created_by = excluded.created_by, created_at = now();

  perform public.notify(t.id, 'restricted', 'An activity was paused on your account',
    replace(p_kind, '_', ' ') || ' is paused for ' || p_days || ' day(s). Reason: ' || btrim(p_reason), null);
  perform public.log_action(t.school_id, 'restrict', 'profile', t.id,
    t.full_name || ' · ' || p_kind || ' · ' || p_days || ' day(s) · ' || btrim(p_reason));
end;
$$;

-- One trigger for both checks. Arguments: action name, max, seconds, restriction kind.
create function public.guard_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if public.is_restricted(tg_argv[3]) then
    raise exception 'RESTRICTED: An admin has paused this on your account for now.';
  end if;
  perform public.check_rate(tg_argv[0], tg_argv[1]::int, tg_argv[2]::int);
  return new;
end;
$$;

create trigger guard before insert on public.posts for each row
  execute function public.guard_activity('post', '20', '3600', 'posting');
create trigger guard before insert on public.messages for each row
  execute function public.guard_activity('message', '40', '60', 'messaging');
create trigger guard before insert on public.clubs for each row
  execute function public.guard_activity('club', '3', '86400', 'creating_groups');
create trigger guard before insert on public.events for each row
  execute function public.guard_activity('event', '10', '86400', 'publishing');
create trigger guard before insert on public.listings for each row
  execute function public.guard_activity('listing', '10', '86400', 'publishing');
create trigger guard before insert on public.suggestions for each row
  execute function public.guard_activity('suggestion', '10', '86400', 'publishing');
create trigger guard before insert on public.tawjihi_questions for each row
  execute function public.guard_activity('question', '10', '3600', 'publishing');
create trigger guard before insert on public.tawjihi_answers for each row
  execute function public.guard_activity('answer', '30', '3600', 'commenting');

-- Reports are only rate limited: a restriction must never stop a student asking for help.
create function public.guard_rate_only() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_rate(tg_argv[0], tg_argv[1]::int, tg_argv[2]::int);
  return new;
end;
$$;
create trigger guard before insert on public.reports for each row
  execute function public.guard_rate_only('report', '20', '3600');

-- ---------------------------------------------------------------------------
-- 4. Admin applications
-- ---------------------------------------------------------------------------

create table public.admin_applications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  requested_role text not null check (requested_role in ('moderator', 'admin')),
  position text not null default '' check (char_length(position) <= 120),
  motivation text not null check (char_length(motivation) between 20 and 1500),
  contribution text not null check (char_length(contribution) between 20 and 1500),
  experience text not null default '' check (char_length(experience) <= 1500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  assigned_role text check (assigned_role in ('moderator', 'admin', 'super_admin')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create unique index admin_applications_one_pending on public.admin_applications (applicant_id) where status = 'pending';
create index on public.admin_applications (school_id, status, created_at desc);
alter table public.admin_applications enable row level security;
create policy "own application or super admin" on public.admin_applications for select to authenticated
  using (applicant_id = (select auth.uid()) or (school_id = public.my_school_id() and public.is_super_admin()));
revoke insert, update, delete on public.admin_applications from authenticated;

-- Anyone with a school account may apply. Nothing is granted until a Super Admin approves.
create function public.submit_admin_application(
  p_role text, p_position text, p_motivation text, p_contribution text, p_experience text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  v_id uuid;
  r record;
begin
  select * into me from public.profiles where id = auth.uid() and deactivated_at is null;
  if me.id is null then
    raise exception 'Not signed in';
  end if;
  if me.role in ('admin', 'super_admin') then
    raise exception 'You already have an admin account.';
  end if;
  if p_role not in ('moderator', 'admin') then
    raise exception 'Choose Admin or Moderator.';
  end if;
  if exists (select 1 from public.admin_applications where applicant_id = me.id and status = 'pending') then
    raise exception 'You already have an application waiting for review.';
  end if;
  if char_length(btrim(coalesce(p_motivation, ''))) < 20 or char_length(btrim(coalesce(p_contribution, ''))) < 20 then
    raise exception 'Please write at least a sentence or two in each answer.';
  end if;
  perform public.check_rate('admin_application', 3, 30 * 86400);

  insert into public.admin_applications (school_id, applicant_id, requested_role, position, motivation, contribution, experience)
  values (me.school_id, me.id, p_role, left(btrim(coalesce(p_position, '')), 120),
          left(btrim(p_motivation), 1500), left(btrim(p_contribution), 1500), left(btrim(coalesce(p_experience, '')), 1500))
  returning id into v_id;

  for r in select id from public.profiles
           where school_id = me.school_id and role = 'super_admin' and deactivated_at is null loop
    perform public.notify(r.id, 'admin_application', 'New admin application',
      me.full_name || ' applied for ' || p_role || '.', '/admin/applications');
  end loop;
  return v_id;
end;
$$;

-- Approve (with any role the reviewer chooses) or reject.
create function public.review_admin_application(p_application uuid, p_approve boolean, p_role text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.admin_applications;
  t public.profiles;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can review admin applications.';
  end if;
  select * into a from public.admin_applications
  where id = p_application and school_id = public.my_school_id() for update;
  if a.id is null then
    raise exception 'Application not found.';
  end if;
  if a.status <> 'pending' then
    raise exception 'This application was already reviewed.';
  end if;
  select * into t from public.profiles where id = a.applicant_id;

  if p_approve then
    if p_role not in ('moderator', 'admin', 'super_admin') then
      raise exception 'Choose a role to give.';
    end if;
    if p_role = 'super_admin' and not public.is_owner() then
      raise exception 'Only the platform owner can appoint Super Admins.';
    end if;
    if t.deactivated_at is not null then
      raise exception 'This account was removed.';
    end if;
    if public.role_rank(t.role) < public.role_rank(p_role) then
      update public.profiles set role = p_role where id = t.id;
    end if;
  end if;

  update public.admin_applications
  set status = case when p_approve then 'approved' else 'rejected' end,
      assigned_role = case when p_approve then p_role end,
      reviewed_by = auth.uid(), reviewed_at = now(),
      review_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
  where id = a.id;

  perform public.log_action(a.school_id,
    case when p_approve then 'approve_admin_application' else 'reject_admin_application' end,
    'profile', t.id,
    t.full_name || ' · asked for ' || a.requested_role || case when p_approve then ' · given ' || p_role else '' end);
  perform public.notify(t.id, 'admin_application',
    case when p_approve then 'Your admin application was approved' else 'Your admin application was not approved' end,
    case when p_approve then 'Your role: ' || replace(p_role, '_', ' ') || '.' else coalesce(nullif(btrim(p_note), ''), '') end,
    '/apply-admin');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Student leadership roles
-- ---------------------------------------------------------------------------

create table public.leadership_roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('class_rep', 'club_leader', 'council_member', 'school_staff')),
  -- The class ("11A") for class reps, the position for council and staff.
  scope text not null default '' check (char_length(scope) <= 60),
  club_id uuid references public.clubs (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  check ((kind = 'club_leader') = (club_id is not null))
);
create unique index leadership_roles_unique on public.leadership_roles
  (profile_id, kind, coalesce(club_id, '00000000-0000-0000-0000-000000000000'::uuid), scope);
create index on public.leadership_roles (school_id, kind);
alter table public.leadership_roles enable row level security;
create policy "school sees leadership roles" on public.leadership_roles for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.leadership_roles from authenticated;

create table public.leadership_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('class_rep', 'club_leader', 'council_member', 'school_staff')),
  scope text not null default '' check (char_length(scope) <= 60),
  club_id uuid references public.clubs (id) on delete cascade,
  reason text not null check (char_length(reason) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  check ((kind = 'club_leader') = (club_id is not null))
);
create index on public.leadership_requests (school_id, status, created_at desc);
create index on public.leadership_requests (profile_id);
alter table public.leadership_requests enable row level security;
create policy "own request or admin" on public.leadership_requests for select to authenticated
  using (profile_id = (select auth.uid()) or (school_id = public.my_school_id() and public.is_admin()));
revoke insert, update, delete on public.leadership_requests from authenticated;

-- Gives the role and keeps the club and council lists in step with it.
create function public.grant_leadership(p_profile uuid, p_kind text, p_scope text, p_club uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  select * into t from public.profiles where id = p_profile;
  insert into public.leadership_roles (school_id, profile_id, kind, scope, club_id, assigned_by)
  values (t.school_id, t.id, p_kind, coalesce(p_scope, ''), p_club, auth.uid())
  on conflict do nothing;

  if p_kind = 'club_leader' then
    insert into public.club_members (club_id, profile_id, role) values (p_club, t.id, 'leader')
    on conflict (club_id, profile_id) do update set role = 'leader';
  elsif p_kind = 'council_member' then
    insert into public.council_members (school_id, profile_id, position)
    values (t.school_id, t.id, coalesce(nullif(btrim(p_scope), ''), 'Member'))
    on conflict do nothing;
  end if;
end;
$$;

create function public.request_leadership_role(p_kind text, p_scope text, p_club uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  v_id uuid;
  v_scope text := left(btrim(coalesce(p_scope, '')), 60);
begin
  if not public.is_active() then
    raise exception 'Not allowed';
  end if;
  select * into me from public.profiles where id = auth.uid();
  if p_kind not in ('class_rep', 'club_leader', 'council_member', 'school_staff') then
    raise exception 'Unknown role';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Please explain why in a sentence or two.';
  end if;
  if p_kind = 'club_leader' then
    if not exists (select 1 from public.clubs where id = p_club and school_id = me.school_id and status = 'approved') then
      raise exception 'Club not found.';
    end if;
    if not public.is_club_member(p_club) then
      raise exception 'Join the club first.';
    end if;
  else
    p_club := null;
    if p_kind = 'class_rep' and v_scope !~ '^[0-9]{1,2}[A-Z]$' then
      raise exception 'Write your class like 11A.';
    end if;
  end if;
  if exists (
    select 1 from public.leadership_requests
    where profile_id = me.id and kind = p_kind and status = 'pending'
      and club_id is not distinct from p_club
  ) then
    raise exception 'You already asked for this. Please wait for an answer.';
  end if;
  if exists (
    select 1 from public.leadership_roles
    where profile_id = me.id and kind = p_kind and club_id is not distinct from p_club and scope = v_scope
  ) then
    raise exception 'You already have this role.';
  end if;
  perform public.check_rate('leadership_request', 5, 7 * 86400);

  insert into public.leadership_requests (school_id, profile_id, kind, scope, club_id, reason)
  values (me.school_id, me.id, p_kind, v_scope, p_club, left(btrim(p_reason), 1000))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.review_leadership_request(p_request uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.leadership_requests;
  t public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review leadership requests.';
  end if;
  select * into r from public.leadership_requests
  where id = p_request and school_id = public.my_school_id() for update;
  if r.id is null then
    raise exception 'Request not found.';
  end if;
  if r.status <> 'pending' then
    raise exception 'This request was already reviewed.';
  end if;
  if r.profile_id = auth.uid() then
    raise exception 'You cannot review your own request.';
  end if;
  select * into t from public.profiles where id = r.profile_id;

  if p_approve then
    perform public.grant_leadership(r.profile_id, r.kind, r.scope, r.club_id);
  end if;
  update public.leadership_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now(),
      review_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
  where id = r.id;

  perform public.log_action(r.school_id,
    case when p_approve then 'approve_leadership' else 'reject_leadership' end,
    'profile', t.id, t.full_name || ' · ' || r.kind || coalesce(' · ' || nullif(r.scope, ''), ''));
  perform public.notify(t.id, 'leadership',
    case when p_approve then 'Your leadership request was approved' else 'Your leadership request was not approved' end,
    replace(r.kind, '_', ' ') || coalesce(' · ' || nullif(btrim(p_note), ''), ''), '/leadership');
end;
$$;

-- Super Admins give a role directly.
create function public.assign_leadership_role(p_user uuid, p_kind text, p_scope text, p_club uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can assign leadership roles.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  if p_kind not in ('class_rep', 'club_leader', 'council_member', 'school_staff') then
    raise exception 'Unknown role';
  end if;
  if p_kind = 'club_leader' and not exists (
    select 1 from public.clubs where id = p_club and school_id = t.school_id and status = 'approved'
  ) then
    raise exception 'Club not found.';
  end if;
  perform public.grant_leadership(t.id, p_kind, left(btrim(coalesce(p_scope, '')), 60),
    case when p_kind = 'club_leader' then p_club end);
  perform public.log_action(t.school_id, 'assign_leadership', 'profile', t.id,
    t.full_name || ' · ' || p_kind || coalesce(' · ' || nullif(btrim(p_scope), ''), ''));
  perform public.notify(t.id, 'leadership', 'You were given a leadership role',
    replace(p_kind, '_', ' '), '/leadership');
end;
$$;

-- Only Super Admins remove a role that was already given.
create function public.remove_leadership_role(p_role uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.leadership_roles;
  t public.profiles;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can remove leadership roles.';
  end if;
  select * into l from public.leadership_roles where id = p_role and school_id = public.my_school_id();
  if l.id is null then
    raise exception 'Role not found.';
  end if;
  select * into t from public.profiles where id = l.profile_id;
  delete from public.leadership_roles where id = l.id;
  if l.kind = 'club_leader' then
    update public.club_members set role = 'member' where club_id = l.club_id and profile_id = l.profile_id;
  elsif l.kind = 'council_member' then
    delete from public.council_members where school_id = l.school_id and profile_id = l.profile_id;
  end if;
  perform public.log_action(l.school_id, 'remove_leadership', 'profile', t.id,
    t.full_name || ' · ' || l.kind || coalesce(' · ' || nullif(l.scope, ''), ''));
  perform public.notify(t.id, 'leadership', 'A leadership role was removed',
    replace(l.kind, '_', ' '), '/leadership');
end;
$$;

-- Existing club leaders and council members get a matching leadership record.
insert into public.leadership_roles (school_id, profile_id, kind, club_id)
select c.school_id, m.profile_id, 'club_leader', m.club_id
from public.club_members m join public.clubs c on c.id = m.club_id
where m.role = 'leader'
on conflict do nothing;
insert into public.leadership_roles (school_id, profile_id, kind, scope)
select school_id, profile_id, 'council_member', position from public.council_members
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 6. Security events and a tamper-proof activity log
-- ---------------------------------------------------------------------------

create table public.security_events (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  details text not null default '',
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on public.security_events (profile_id, created_at desc);
create index on public.security_events (school_id, created_at desc);
alter table public.security_events enable row level security;
create policy "own events or admin" on public.security_events for select to authenticated
  using (profile_id = (select auth.uid()) or (school_id = public.my_school_id() and public.is_admin()));
revoke insert, update, delete on public.security_events from authenticated;

-- Called by the website after a sign-in or a 2FA change. A sign-in from a
-- browser the account never used before also alerts the account owner.
create function public.record_security_event(p_kind text, p_ip text, p_user_agent text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  v_ua text := left(coalesce(p_user_agent, ''), 300);
  v_known boolean;
  v_any boolean;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    return;
  end if;
  if p_kind not in ('sign_in', 'mfa_enabled', 'mfa_disabled', 'mfa_verified') then
    raise exception 'Unknown event';
  end if;
  perform public.check_rate('security_event', 30, 3600);

  if p_kind = 'sign_in' then
    select exists (select 1 from public.security_events where profile_id = me.id and kind = 'sign_in'),
           exists (select 1 from public.security_events where profile_id = me.id and kind = 'sign_in' and user_agent = v_ua)
    into v_any, v_known;
    if v_any and not v_known then
      insert into public.security_events (school_id, profile_id, kind, details, ip, user_agent)
      values (me.school_id, me.id, 'new_device', 'First sign-in from this browser', left(p_ip, 60), v_ua);
      perform public.notify(me.id, 'security', 'New sign-in to your account',
        'Your account was opened from a new browser or device. If this was not you, tell an admin.', '/security');
    end if;
  end if;

  insert into public.security_events (school_id, profile_id, kind, ip, user_agent)
  values (me.school_id, me.id, p_kind, left(p_ip, 60), v_ua);
end;
$$;

-- The activity log can never be edited or deleted, even by database functions.
-- (Removing an account only blanks the "who" column.)
create function public.moderation_log_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'The activity log cannot be deleted.';
  end if;
  if new.action is distinct from old.action or new.details is distinct from old.details
     or new.target_type is distinct from old.target_type or new.target_id is distinct from old.target_id
     or new.created_at is distinct from old.created_at or new.school_id is distinct from old.school_id
     or (new.actor_id is not null and new.actor_id is distinct from old.actor_id) then
    raise exception 'The activity log cannot be changed.';
  end if;
  return new;
end;
$$;
create trigger immutable before update or delete on public.moderation_log
  for each row execute function public.moderation_log_immutable();

-- School settings: only Super Admins change them now.
drop policy "admins edit school" on public.schools;
create policy "super admins edit school" on public.schools for update to authenticated
  using (id = public.my_school_id() and public.is_super_admin())
  with check (id = public.my_school_id());

-- ---------------------------------------------------------------------------
-- 7. Who may call what
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;

-- Internal helpers: never callable from the website.
revoke execute on function public.check_rate(text, int, int) from authenticated;
revoke execute on function public.guard_activity() from authenticated;
revoke execute on function public.guard_rate_only() from authenticated;
revoke execute on function public.grant_leadership(uuid, text, text, uuid) from authenticated;
revoke execute on function public.moderation_log_immutable() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;

grant execute on function public.role_rank(text) to authenticated;
grant execute on function public.mfa_ok() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.can_manage_account(uuid) to authenticated;
grant execute on function public.is_restricted(text) to authenticated;
grant execute on function public.set_restriction(uuid, text, int, text) to authenticated;
grant execute on function public.submit_admin_application(text, text, text, text, text) to authenticated;
grant execute on function public.review_admin_application(uuid, boolean, text, text) to authenticated;
grant execute on function public.request_leadership_role(text, text, uuid, text) to authenticated;
grant execute on function public.review_leadership_request(uuid, boolean, text) to authenticated;
grant execute on function public.assign_leadership_role(uuid, text, text, uuid) to authenticated;
grant execute on function public.remove_leadership_role(uuid) to authenticated;
grant execute on function public.record_security_event(text, text, text) to authenticated;

-- A Super Admin clears a lost authenticator for an account below them, so
-- that person can set it up again. (The owner's own is cleared in Supabase.)
create function public.reset_account_mfa(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can reset two-step sign-in.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Account not found.';
  end if;
  if not public.can_manage_account(t.id) then
    raise exception 'You cannot change this account.';
  end if;
  delete from auth.mfa_factors where user_id = t.id;
  insert into public.security_events (school_id, profile_id, kind, details)
  values (t.school_id, t.id, 'mfa_disabled', 'Reset by a Super Admin');
  perform public.log_action(t.school_id, 'reset_mfa', 'profile', t.id, t.full_name);
end;
$$;
revoke execute on function public.reset_account_mfa(uuid) from public, anon;
grant execute on function public.reset_account_mfa(uuid) to authenticated;

-- Club leaders and council members are leadership roles too: keep the
-- leadership list in step whenever those lists change anywhere in the app.
create function public.sync_leadership_from_club() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'DELETE' and new.role = 'leader' then
    insert into public.leadership_roles (school_id, profile_id, kind, club_id, assigned_by)
    select c.school_id, new.profile_id, 'club_leader', new.club_id, auth.uid()
    from public.clubs c where c.id = new.club_id
    on conflict do nothing;
  else
    delete from public.leadership_roles
    where kind = 'club_leader' and club_id = coalesce(new.club_id, old.club_id)
      and profile_id = coalesce(new.profile_id, old.profile_id);
  end if;
  return null;
end;
$$;
create trigger sync_leadership after insert or update of role or delete on public.club_members
  for each row execute function public.sync_leadership_from_club();

create function public.sync_leadership_from_council() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.leadership_roles
    where kind = 'council_member' and profile_id = old.profile_id and school_id = old.school_id;
  else
    delete from public.leadership_roles
    where kind = 'council_member' and profile_id = new.profile_id and scope <> new.position;
    insert into public.leadership_roles (school_id, profile_id, kind, scope, assigned_by)
    values (new.school_id, new.profile_id, 'council_member', new.position, auth.uid())
    on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger sync_leadership after insert or update of position or delete on public.council_members
  for each row execute function public.sync_leadership_from_council();

revoke execute on function public.sync_leadership_from_club() from public, anon, authenticated;
revoke execute on function public.sync_leadership_from_council() from public, anon, authenticated;
