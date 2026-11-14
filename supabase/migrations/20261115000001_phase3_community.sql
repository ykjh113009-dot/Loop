-- =============================================================================
-- Loop Phase 3: school community
--
--   A. Points: configurable rules, claims checked by staff, XP and levels,
--      rewards shop, individual leaderboard
--   B. Houses, teams and competitions
--   C. Groups (official and student-made, public or private)
--   D. Clubs: applications, team roles, sessions and attendance, tasks,
--      budget, resources, achievements, analytics
--   E. Leadership tools: class announcements, who may do what
--
-- Everything here only ADDS to the database. No existing rows are deleted.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Who may do what (used by the rules below)
-- ---------------------------------------------------------------------------

create function public.has_leadership(p_kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active() and exists (
    select 1 from public.leadership_roles
    where profile_id = (select auth.uid()) and kind = p_kind
  )
$$;

-- Admins and designated school staff run points, rewards and competitions.
create function public.can_manage_points() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_leadership('school_staff')
$$;

-- Official groups: admins, the student council and school staff.
create function public.can_create_official_group() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_leadership('council_member') or public.has_leadership('school_staff')
$$;

alter table public.profile_settings add column show_on_leaderboard boolean not null default true;

-- ---------------------------------------------------------------------------
-- A. Points rules
-- ---------------------------------------------------------------------------

create table public.point_rule_defaults (
  reason text primary key,
  label text not null,
  points int not null check (points between 0 and 100),
  daily_limit int check (daily_limit >= 0),
  weekly_limit int check (weekly_limit >= 0),
  -- A person has to ask for these and staff check them.
  requires_verification boolean not null default false,
  sort int not null default 0
);
alter table public.point_rule_defaults enable row level security;
create policy "read default rules" on public.point_rule_defaults for select to authenticated using (true);
revoke insert, update, delete on public.point_rule_defaults from authenticated;

insert into public.point_rule_defaults (reason, label, points, daily_limit, weekly_limit, requires_verification, sort) values
  ('club_join', 'Joining a club', 5, null, null, false, 10),
  ('post', 'Posting', 2, 5, null, false, 20),
  ('comment', 'Commenting', 1, 5, null, false, 25),
  ('rsvp', 'Going to an event', 3, null, null, false, 30),
  ('poll_vote', 'Voting in a poll', 1, null, null, false, 40),
  ('election_vote', 'Voting in an election', 3, null, null, false, 50),
  ('tawjihi_answer', 'Answering in the Tawjihi corner', 3, 5, null, false, 60),
  ('suggestion', 'Sending a suggestion', 2, 2, null, false, 70),
  ('group_join', 'Joining a group', 2, null, null, false, 80),
  ('help_classmate', 'Helping a classmate', 5, null, 3, true, 100),
  ('community_service', 'Community service', 10, null, 2, true, 110),
  ('competition', 'Taking part in a competition', 10, null, 2, true, 120),
  ('academic', 'Academic achievement', 10, null, 2, true, 130),
  ('other_approved', 'Other school-approved activity', 5, null, 2, true, 140);

-- A school changes a rule by saving its own row. No row means "use the default".
create table public.point_rules (
  school_id uuid not null references public.schools (id) on delete cascade,
  reason text not null references public.point_rule_defaults (reason),
  points int not null check (points between 0 and 100),
  daily_limit int check (daily_limit >= 0),
  weekly_limit int check (weekly_limit >= 0),
  enabled boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (school_id, reason)
);
alter table public.point_rules enable row level security;
create policy "see school rules" on public.point_rules for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "admins add rules" on public.point_rules for insert to authenticated
  with check (school_id = public.my_school_id() and public.can_manage_points() and updated_by = (select auth.uid()));
create policy "admins change rules" on public.point_rules for update to authenticated
  using (school_id = public.my_school_id() and public.can_manage_points())
  with check (school_id = public.my_school_id() and updated_by = (select auth.uid()));
revoke delete on public.point_rules from authenticated;

-- Points to give right now for an activity: 0 if the rule is off or today's /
-- this week's limit is used up.
create function public.points_for(p_profile uuid, p_reason text) returns int
language plpgsql stable security definer set search_path = '' as $$
declare
  v_school uuid;
  d public.point_rule_defaults;
  r public.point_rules;
  v_daily int;
  v_weekly int;
begin
  select school_id into v_school from public.profiles where id = p_profile;
  select * into d from public.point_rule_defaults where reason = p_reason;
  if d.reason is null then
    return 0;
  end if;
  select * into r from public.point_rules where school_id = v_school and reason = p_reason;
  if r.reason is not null and not r.enabled then
    return 0;
  end if;
  v_daily := case when r.reason is not null then r.daily_limit else d.daily_limit end;
  v_weekly := case when r.reason is not null then r.weekly_limit else d.weekly_limit end;
  if v_daily is not null and (
    select count(*) from public.points_ledger
    where profile_id = p_profile and reason = p_reason and created_at > now() - interval '1 day'
  ) >= v_daily then
    return 0;
  end if;
  if v_weekly is not null and (
    select count(*) from public.points_ledger
    where profile_id = p_profile and reason = p_reason and created_at >= public.week_start()
  ) >= v_weekly then
    return 0;
  end if;
  return coalesce(r.points, d.points);
end;
$$;

create or replace function public.points_on_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text;
  v_profile uuid;
  v_source uuid;
  v_at timestamptz;
begin
  if tg_table_name = 'club_members' then
    v_reason := 'club_join'; v_profile := new.profile_id; v_source := new.club_id; v_at := new.joined_at;
  elsif tg_table_name = 'posts' then
    if new.status <> 'visible' or new.kind = 'announcement' then return new; end if;
    v_reason := 'post'; v_profile := new.author_id; v_source := new.id; v_at := new.created_at;
  elsif tg_table_name = 'post_comments' then
    if new.status <> 'visible' then return new; end if;
    v_reason := 'comment'; v_profile := new.author_id; v_source := new.id; v_at := new.created_at;
  elsif tg_table_name = 'event_rsvps' then
    v_reason := 'rsvp'; v_profile := new.profile_id; v_source := new.event_id; v_at := new.created_at;
  elsif tg_table_name = 'poll_votes' then
    v_reason := 'poll_vote'; v_profile := new.profile_id; v_source := new.poll_id; v_at := new.created_at;
  elsif tg_table_name = 'election_votes' then
    v_reason := 'election_vote'; v_profile := new.voter_id; v_source := new.election_id; v_at := new.created_at;
  elsif tg_table_name = 'tawjihi_answers' then
    if new.status <> 'visible' then return new; end if;
    v_reason := 'tawjihi_answer'; v_profile := new.author_id; v_source := new.id; v_at := new.created_at;
  elsif tg_table_name = 'suggestions' then
    v_reason := 'suggestion'; v_profile := new.author_id; v_source := new.id; v_at := new.created_at;
  else
    return new;
  end if;
  perform public.award_points(v_profile, public.points_for(v_profile, v_reason), v_reason, v_source, v_at);
  return new;
end;
$$;
create trigger points after insert on public.post_comments for each row execute function public.points_on_activity();

-- Points a student asks for (helping, service, competitions...). Staff check them.
create table public.point_claims (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null references public.point_rule_defaults (reason),
  description text not null check (char_length(description) between 5 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  points int check (points between 1 and 100),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index on public.point_claims (school_id, status, created_at desc);
create index on public.point_claims (profile_id, created_at desc);
alter table public.point_claims enable row level security;
create policy "own claims or staff" on public.point_claims for select to authenticated
  using (profile_id = (select auth.uid()) or (school_id = public.my_school_id() and public.can_manage_points()));
revoke insert, update, delete on public.point_claims from authenticated;

create function public.claim_points(p_reason text, p_description text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  d public.point_rule_defaults;
  r public.point_rules;
  v_weekly int;
  v_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if not public.is_active() or not public.is_current_student(me.id) then
    raise exception 'Only current students can ask for points.';
  end if;
  select * into d from public.point_rule_defaults where reason = p_reason and requires_verification;
  if d.reason is null then
    raise exception 'You cannot ask for points for that.';
  end if;
  select * into r from public.point_rules where school_id = me.school_id and reason = p_reason;
  if r.reason is not null and not r.enabled then
    raise exception 'Points for this are switched off at your school.';
  end if;
  if char_length(btrim(coalesce(p_description, ''))) < 5 then
    raise exception 'Please say what you did.';
  end if;
  perform public.reject_blocked(me.school_id, p_description);
  v_weekly := case when r.reason is not null then r.weekly_limit else d.weekly_limit end;
  if v_weekly is not null and (
    select count(*) from public.point_claims
    where profile_id = me.id and reason = p_reason and status <> 'rejected' and created_at >= public.week_start()
  ) >= v_weekly then
    raise exception 'You have used this week''s limit for this activity.';
  end if;
  perform public.check_rate('point_claim', 10, 86400);

  insert into public.point_claims (school_id, profile_id, reason, description)
  values (me.school_id, me.id, p_reason, left(btrim(p_description), 500))
  returning id into v_id;

  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select me.school_id, p.id, 'points_claim', 'A points request is waiting', me.full_name || ': ' || d.label, '/admin/points'
  from public.profiles p
  where p.school_id = me.school_id and p.deactivated_at is null
    and (p.role in ('admin', 'super_admin') or exists (
      select 1 from public.leadership_roles l where l.profile_id = p.id and l.kind = 'school_staff'));
  return v_id;
end;
$$;

create function public.review_point_claim(p_claim uuid, p_approve boolean, p_points int, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.point_claims;
  r public.point_rules;
  d public.point_rule_defaults;
  v_points int;
begin
  if not public.can_manage_points() then
    raise exception 'Only admins and school staff can check points requests.';
  end if;
  select * into c from public.point_claims
  where id = p_claim and school_id = public.my_school_id() and status = 'pending' for update;
  if c.id is null then
    raise exception 'Request not found or already checked.';
  end if;
  if c.profile_id = auth.uid() then
    raise exception 'You cannot check your own request.';
  end if;
  if p_approve then
    select * into d from public.point_rule_defaults where reason = c.reason;
    select * into r from public.point_rules where school_id = c.school_id and reason = c.reason;
    v_points := coalesce(p_points, r.points, d.points);
    if v_points < 1 or v_points > 100 then
      raise exception 'Give between 1 and 100 points.';
    end if;
    perform public.award_points(c.profile_id, v_points, c.reason, c.id);
  end if;
  update public.point_claims
  set status = case when p_approve then 'approved' else 'rejected' end,
      points = case when p_approve then v_points end,
      reviewed_by = auth.uid(), reviewed_at = now(),
      review_note = nullif(left(btrim(coalesce(p_note, '')), 300), '')
  where id = c.id;
  perform public.log_action(c.school_id, case when p_approve then 'approve_points' else 'reject_points' end,
    'profile', c.profile_id, c.reason || coalesce(' · ' || v_points || ' points', ''));
  perform public.notify(c.profile_id, 'points_claim',
    case when p_approve then 'You earned ' || v_points || ' points' else 'Your points request was not approved' end,
    coalesce(nullif(btrim(p_note), ''), ''), '/points');
end;
$$;

-- XP is every point ever earned and never goes down. Spending in the shop only
-- lowers the balance. Level n starts at 25 x n x (n - 1) XP.
create function public.level_for_xp(p_xp bigint) returns int
language sql immutable set search_path = '' as $$
  select floor((1 + sqrt(1 + 4 * greatest(p_xp, 0) / 25.0)) / 2)::int
$$;
create function public.xp_for_level(p_level int) returns int
language sql immutable set search_path = '' as $$
  select 25 * p_level * (p_level - 1)
$$;

-- ---------------------------------------------------------------------------
-- A. Rewards shop
-- ---------------------------------------------------------------------------

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  cost int not null check (cost between 1 and 100000),
  kind text not null check (kind in ('unlockable', 'prize')),
  unlock_key text check (unlock_key in ('accent_sand', 'accent_rose', 'accent_plum')),
  stock int check (stock >= 0),
  per_student_limit int not null default 1 check (per_student_limit between 1 and 10),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'unlockable') = (unlock_key is not null))
);
create index on public.rewards (school_id, active);
alter table public.rewards enable row level security;
create policy "see rewards" on public.rewards for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader() and (active or public.can_manage_points()));
create policy "manage rewards add" on public.rewards for insert to authenticated
  with check (school_id = public.my_school_id() and public.can_manage_points() and created_by = (select auth.uid()));
create policy "manage rewards change" on public.rewards for update to authenticated
  using (school_id = public.my_school_id() and public.can_manage_points())
  with check (school_id = public.my_school_id());
revoke delete on public.rewards from authenticated;
revoke update on public.rewards from authenticated;
grant update (name, description, cost, stock, per_student_limit, active) on public.rewards to authenticated;

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  reward_id uuid not null references public.rewards (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  cost int not null check (cost > 0),
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled')),
  note text,
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.reward_redemptions (profile_id, created_at desc);
create index on public.reward_redemptions (school_id, status, created_at desc);
create index on public.reward_redemptions (reward_id);
alter table public.reward_redemptions enable row level security;
create policy "own redemptions or staff" on public.reward_redemptions for select to authenticated
  using (profile_id = (select auth.uid()) or (school_id = public.my_school_id() and public.can_manage_points()));
revoke insert, update, delete on public.reward_redemptions from authenticated;

create table public.profile_unlocks (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  school_id uuid not null references public.schools (id),
  created_at timestamptz not null default now(),
  primary key (profile_id, key)
);
alter table public.profile_unlocks enable row level security;
create policy "own unlocks" on public.profile_unlocks for select to authenticated
  using (profile_id = (select auth.uid()));
revoke insert, update, delete on public.profile_unlocks from authenticated;

create function public.my_points() returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v_xp bigint;
  v_spent bigint;
  v_level int;
begin
  select coalesce(sum(points), 0) into v_xp from public.points_ledger where profile_id = auth.uid();
  select coalesce(sum(cost), 0) into v_spent from public.reward_redemptions
  where profile_id = auth.uid() and status <> 'cancelled';
  v_level := public.level_for_xp(v_xp);
  return json_build_object(
    'xp', v_xp, 'spent', v_spent, 'balance', v_xp - v_spent, 'level', v_level,
    'level_start', public.xp_for_level(v_level), 'next_level', public.xp_for_level(v_level + 1));
end;
$$;

create function public.redeem_reward(p_reward uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  rw public.rewards;
  v_id uuid;
  v_balance int;
begin
  if not public.is_active() or not public.is_current_student(auth.uid()) then
    raise exception 'Only current students can use the shop.';
  end if;
  -- Lock the student's row so two taps cannot spend the same points twice.
  perform 1 from public.profiles where id = auth.uid() for update;
  select * into rw from public.rewards
  where id = p_reward and school_id = public.my_school_id() and active for update;
  if rw.id is null then
    raise exception 'This reward is not available.';
  end if;
  if rw.stock is not null and rw.stock <= 0 then
    raise exception 'This reward is sold out.';
  end if;
  if (select count(*) from public.reward_redemptions
      where profile_id = auth.uid() and reward_id = rw.id and status <> 'cancelled') >= rw.per_student_limit then
    raise exception 'You already have this reward.';
  end if;
  v_balance := ((public.my_points()) ->> 'balance')::int;
  if v_balance < rw.cost then
    raise exception 'You need % more points for this.', rw.cost - v_balance;
  end if;
  perform public.check_rate('redeem', 10, 3600);

  insert into public.reward_redemptions (school_id, reward_id, profile_id, cost, status, handled_at)
  values (rw.school_id, rw.id, auth.uid(), rw.cost, case when rw.kind = 'unlockable' then 'fulfilled' else 'pending' end,
          case when rw.kind = 'unlockable' then now() end)
  returning id into v_id;
  if rw.kind = 'unlockable' then
    insert into public.profile_unlocks (profile_id, key, school_id) values (auth.uid(), rw.unlock_key, rw.school_id)
    on conflict do nothing;
  else
    insert into public.notifications (school_id, recipient_id, kind, title, body, link)
    select rw.school_id, p.id, 'reward_request', 'A reward was requested',
           (select full_name from public.profiles where id = auth.uid()) || ' · ' || rw.name, '/admin/rewards'
    from public.profiles p
    where p.school_id = rw.school_id and p.deactivated_at is null
      and (p.role in ('admin', 'super_admin') or exists (
        select 1 from public.leadership_roles l where l.profile_id = p.id and l.kind = 'school_staff'));
  end if;
  if rw.stock is not null then
    update public.rewards set stock = stock - 1 where id = rw.id;
  end if;
  return v_id;
end;
$$;

-- Hand over a prize, or cancel the request (the points come back automatically).
create function public.handle_redemption(p_id uuid, p_fulfil boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  x public.reward_redemptions;
  rw public.rewards;
begin
  if not public.can_manage_points() then
    raise exception 'Only admins and school staff can do this.';
  end if;
  select * into x from public.reward_redemptions
  where id = p_id and school_id = public.my_school_id() and status = 'pending' for update;
  if x.id is null then
    raise exception 'Request not found or already handled.';
  end if;
  select * into rw from public.rewards where id = x.reward_id;
  update public.reward_redemptions
  set status = case when p_fulfil then 'fulfilled' else 'cancelled' end,
      note = nullif(left(btrim(coalesce(p_note, '')), 300), ''), handled_by = auth.uid(), handled_at = now()
  where id = x.id;
  if not p_fulfil and rw.stock is not null then
    update public.rewards set stock = stock + 1 where id = rw.id;
  end if;
  perform public.log_action(x.school_id, case when p_fulfil then 'fulfil_reward' else 'cancel_reward' end,
    'profile', x.profile_id, rw.name);
  perform public.notify(x.profile_id, 'reward',
    case when p_fulfil then 'Your reward is ready: ' || rw.name else 'Your reward request was cancelled' end,
    coalesce(nullif(btrim(p_note), ''), case when p_fulfil then '' else 'Your points were returned.' end), '/shop');
end;
$$;

-- Some profile colours must be unlocked in the shop first.
create function public.profiles_check_accent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.accent in ('sand', 'rose', 'plum') and new.accent is distinct from old.accent
     and not exists (select 1 from public.profile_unlocks where profile_id = new.id and key = 'accent_' || new.accent) then
    raise exception 'Unlock this colour in the shop first.';
  end if;
  return new;
end;
$$;
create trigger check_accent before update of accent on public.profiles
  for each row execute function public.profiles_check_accent();

-- Every school starts with the three unlockable profile colours in its shop.
create function public.seed_school_rewards() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.rewards (school_id, name, description, cost, kind, unlock_key, per_student_limit)
  values (new.id, 'Sand profile colour', 'A warm sand colour for your profile.', 100, 'unlockable', 'accent_sand', 1),
         (new.id, 'Rose profile colour', 'A soft rose colour for your profile.', 100, 'unlockable', 'accent_rose', 1),
         (new.id, 'Plum profile colour', 'A deep plum colour for your profile.', 150, 'unlockable', 'accent_plum', 1);
  return new;
end;
$$;
create trigger seed_rewards after insert on public.schools for each row execute function public.seed_school_rewards();

insert into public.rewards (school_id, name, description, cost, kind, unlock_key, per_student_limit)
select s.id, v.name, v.description, v.cost, 'unlockable', v.key, 1
from public.schools s,
  (values ('Sand profile colour', 'A warm sand colour for your profile.', 100, 'accent_sand'),
          ('Rose profile colour', 'A soft rose colour for your profile.', 100, 'accent_rose'),
          ('Plum profile colour', 'A deep plum colour for your profile.', 150, 'accent_plum')) as v(name, description, cost, key);

-- ---------------------------------------------------------------------------
-- A. Individual leaderboard (students can hide themselves in Settings)
-- ---------------------------------------------------------------------------

create function public.individual_leaderboard(p_period text, p_grade int default null, p_limit int default 20)
returns table (profile_id uuid, full_name text, avatar text, grade int, section text, points bigint, level int)
language sql stable security definer set search_path = '' as $$
  with pts as (
    select l.profile_id, sum(l.points) as points from public.points_ledger l
    where l.school_id = public.my_school_id() and (p_period = 'all' or l.created_at >= public.week_start())
    group by l.profile_id
  ), xp as (
    select l.profile_id, sum(l.points) as xp from public.points_ledger l
    where l.school_id = public.my_school_id() group by l.profile_id
  )
  select p.id, p.full_name, p.avatar, p.grade, p.section, pts.points::bigint, public.level_for_xp(coalesce(xp.xp, 0))
  from public.profiles p
  join pts on pts.profile_id = p.id
  left join xp on xp.profile_id = p.id
  where p.school_id = public.my_school_id() and public.is_reader()
    and p.onboarded_at is not null and p.deactivated_at is null and p.alumni_year is null and p.role <> 'counselor'
    and (p_grade is null or p.grade = p_grade)
    and coalesce((select s.show_on_leaderboard from public.profile_settings s where s.profile_id = p.id), true)
  order by pts.points desc, p.full_name
  limit least(greatest(p_limit, 1), 50)
$$;

-- ---------------------------------------------------------------------------
-- B. Houses, teams and competitions
-- ---------------------------------------------------------------------------

create table public.houses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  name text not null check (char_length(name) between 2 and 40),
  emoji text not null default '🏠' check (char_length(emoji) <= 8),
  color text not null default 'olive' check (color in ('olive', 'sage', 'sky', 'sand', 'rose', 'plum')),
  motto text not null default '' check (char_length(motto) <= 120),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);
alter table public.houses enable row level security;
create policy "see houses" on public.houses for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "admins add houses" on public.houses for insert to authenticated
  with check (school_id = public.my_school_id() and public.is_admin());
create policy "admins change houses" on public.houses for update to authenticated
  using (school_id = public.my_school_id() and public.is_admin()) with check (school_id = public.my_school_id());
create policy "admins remove houses" on public.houses for delete to authenticated
  using (school_id = public.my_school_id() and public.is_admin());

-- Which classes belong to which house, e.g. House A = 12A, 11A, 10A, 9A.
create table public.house_classes (
  house_id uuid not null references public.houses (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  grade int not null check (grade between 1 and 12),
  section text not null check (section ~ '^[A-Z]$'),
  primary key (school_id, grade, section)
);
create index on public.house_classes (house_id);
alter table public.house_classes enable row level security;
create policy "see house classes" on public.house_classes for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "admins add house classes" on public.house_classes for insert to authenticated
  with check (school_id = public.my_school_id() and public.is_admin()
    and exists (select 1 from public.houses h where h.id = house_id and h.school_id = house_classes.school_id));
create policy "admins remove house classes" on public.house_classes for delete to authenticated
  using (school_id = public.my_school_id() and public.is_admin());
revoke update on public.house_classes from authenticated;

create function public.create_default_houses(p_count int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_grades int[];
  v_colors text[] := array['olive', 'sky', 'rose', 'sand', 'plum', 'sage'];
  v_emoji text[] := array['🌿', '🌊', '🌹', '🏜️', '🔮', '🍃'];
  i int;
  g int;
  v_house uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can set up houses.';
  end if;
  if p_count < 2 or p_count > 6 then
    raise exception 'Choose 2 to 6 houses.';
  end if;
  if exists (select 1 from public.houses where school_id = v_school) then
    raise exception 'Houses already exist. Change them one by one.';
  end if;
  select grades into v_grades from public.schools where id = v_school;
  for i in 1 .. p_count loop
    insert into public.houses (school_id, name, emoji, color, sort)
    values (v_school, 'House ' || chr(64 + i), v_emoji[i], v_colors[i], i) returning id into v_house;
    foreach g in array v_grades loop
      insert into public.house_classes (house_id, school_id, grade, section) values (v_house, v_school, g, chr(64 + i));
    end loop;
  end loop;
  perform public.log_action(v_school, 'create_houses', 'school', v_school, p_count || ' houses');
  return p_count;
end;
$$;

-- A student's class (the letter) decides their house, so it cannot be changed
-- by the student after it is set. Admins change it.
create function public.profiles_lock_section() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and old.section is not null and new.section is distinct from old.section and not public.is_admin() then
    raise exception 'Only an admin can change your class.';
  end if;
  return new;
end;
$$;
create trigger lock_section before update of section on public.profiles
  for each row execute function public.profiles_lock_section();

create function public.admin_set_section(p_user uuid, p_section text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change classes.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  if p_section is not null and p_section !~ '^[A-Z]$' then
    raise exception 'A class is one capital letter.';
  end if;
  update public.profiles set section = p_section where id = t.id;
  perform public.log_action(t.school_id, 'change_class', 'profile', t.id, t.full_name || ' · ' || coalesce(p_section, '-'));
end;
$$;

create function public.my_house() returns uuid
language sql stable security definer set search_path = '' as $$
  select hc.house_id from public.profiles p
  join public.house_classes hc on hc.school_id = p.school_id and hc.grade = p.grade and hc.section = p.section
  where p.id = (select auth.uid())
$$;

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  name text not null check (char_length(name) between 3 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  kind text not null check (kind in ('house', 'team')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  team_size int not null default 5 check (team_size between 2 and 20),
  club_id uuid references public.clubs (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.competitions (school_id, ends_at desc);
alter table public.competitions enable row level security;
create policy "see competitions" on public.competitions for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "staff add competitions" on public.competitions for insert to authenticated
  with check (school_id = public.my_school_id() and public.can_manage_points() and created_by = (select auth.uid()));
create policy "staff change competitions" on public.competitions for update to authenticated
  using (school_id = public.my_school_id() and public.can_manage_points())
  with check (school_id = public.my_school_id());
revoke update on public.competitions from authenticated;
grant update (name, description, starts_at, ends_at, team_size) on public.competitions to authenticated;
revoke delete on public.competitions from authenticated;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  name text not null check (char_length(name) between 2 and 40),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (competition_id, name)
);
alter table public.teams enable row level security;
create policy "see teams" on public.teams for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.teams from authenticated;

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  competition_id uuid not null references public.competitions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  joined_at timestamptz not null default now(),
  primary key (team_id, profile_id),
  unique (competition_id, profile_id)
);
create index on public.team_members (profile_id);
alter table public.team_members enable row level security;
create policy "see team members" on public.team_members for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.team_members from authenticated;

create table public.competition_scores (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  house_id uuid references public.houses (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  points int not null check (points between 1 and 500),
  note text not null default '' check (char_length(note) <= 200),
  awarded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((house_id is null) <> (team_id is null))
);
create index on public.competition_scores (competition_id);
create index on public.competition_scores (school_id, created_at);
alter table public.competition_scores enable row level security;
create policy "see scores" on public.competition_scores for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.competition_scores from authenticated;

create function public.create_team(p_competition uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.competitions;
  v_id uuid;
  v_name text := left(btrim(coalesce(p_name, '')), 40);
begin
  if not public.is_active() or not public.is_current_student(auth.uid()) then
    raise exception 'Only current students can make teams.';
  end if;
  select * into c from public.competitions where id = p_competition and school_id = public.my_school_id();
  if c.id is null or c.kind <> 'team' then
    raise exception 'Competition not found.';
  end if;
  if now() > c.ends_at then
    raise exception 'This competition has ended.';
  end if;
  if char_length(v_name) < 2 then
    raise exception 'Give your team a name.';
  end if;
  perform public.reject_blocked(c.school_id, v_name);
  if exists (select 1 from public.team_members where competition_id = c.id and profile_id = auth.uid()) then
    raise exception 'You are already in a team for this competition.';
  end if;
  perform public.check_rate('team', 5, 86400);
  insert into public.teams (competition_id, school_id, name, created_by) values (c.id, c.school_id, v_name, auth.uid())
  returning id into v_id;
  insert into public.team_members (team_id, competition_id, profile_id, school_id) values (v_id, c.id, auth.uid(), c.school_id);
  return v_id;
end;
$$;

create function public.join_team(p_team uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.teams;
  c public.competitions;
begin
  if not public.is_active() or not public.is_current_student(auth.uid()) then
    raise exception 'Only current students can join teams.';
  end if;
  select * into t from public.teams where id = p_team and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Team not found.';
  end if;
  select * into c from public.competitions where id = t.competition_id;
  if now() > c.ends_at then
    raise exception 'This competition has ended.';
  end if;
  if exists (select 1 from public.team_members where competition_id = c.id and profile_id = auth.uid()) then
    raise exception 'You are already in a team for this competition.';
  end if;
  if (select count(*) from public.team_members where team_id = t.id) >= c.team_size then
    raise exception 'This team is full.';
  end if;
  insert into public.team_members (team_id, competition_id, profile_id, school_id) values (t.id, c.id, auth.uid(), c.school_id);
end;
$$;

create function public.leave_team(p_team uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.team_members where team_id = p_team and profile_id = auth.uid();
  delete from public.teams t
  where t.id = p_team and not exists (select 1 from public.team_members m where m.team_id = t.id);
end;
$$;

-- Staff give points to a house (adds to the house score) or a team (every
-- member gets the points, which then also count for their houses).
create function public.award_competition_points(p_competition uuid, p_house uuid, p_team uuid, p_points int, p_note text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.competitions;
  v_score uuid;
  m record;
  v_name text;
begin
  if not public.can_manage_points() then
    raise exception 'Only admins and school staff can give competition points.';
  end if;
  select * into c from public.competitions where id = p_competition and school_id = public.my_school_id();
  if c.id is null then
    raise exception 'Competition not found.';
  end if;
  if (p_house is null) = (p_team is null) then
    raise exception 'Choose a house or a team.';
  end if;
  if p_points is null or p_points < 1 or p_points > 500 then
    raise exception 'Give between 1 and 500 points.';
  end if;
  if p_house is not null then
    select name into v_name from public.houses where id = p_house and school_id = c.school_id;
    if v_name is null then raise exception 'House not found.'; end if;
  else
    select name into v_name from public.teams where id = p_team and competition_id = c.id;
    if v_name is null then raise exception 'Team not found.'; end if;
  end if;
  insert into public.competition_scores (competition_id, school_id, house_id, team_id, points, note, awarded_by)
  values (c.id, c.school_id, p_house, p_team, p_points, left(btrim(coalesce(p_note, '')), 200), auth.uid())
  returning id into v_score;
  if p_team is not null then
    for m in select profile_id from public.team_members where team_id = p_team loop
      perform public.award_points(m.profile_id, least(p_points, 100), 'competition_team', v_score);
      perform public.notify(m.profile_id, 'competition', 'Your team earned points',
        v_name || ' · ' || c.name, '/competitions/' || c.id);
    end loop;
  end if;
  perform public.log_action(c.school_id, 'award_competition_points', 'school', c.id,
    c.name || ' · ' || v_name || ' · ' || p_points);
end;
$$;

create function public.house_leaderboard(p_period text)
returns table (house_id uuid, name text, emoji text, color text, members bigint, member_points bigint, bonus_points bigint, points bigint, avg_points numeric)
language sql stable security definer set search_path = '' as $$
  with m as (
    select h.id as house_id, p.id as profile_id
    from public.houses h
    join public.house_classes hc on hc.house_id = h.id
    join public.profiles p on p.school_id = hc.school_id and p.grade = hc.grade and p.section = hc.section
    where h.school_id = public.my_school_id() and public.is_reader()
      and p.deactivated_at is null and p.onboarded_at is not null and p.alumni_year is null and p.role <> 'counselor'
  ), pts as (
    select l.profile_id, sum(l.points) as points from public.points_ledger l
    where l.school_id = public.my_school_id() and (p_period = 'all' or l.created_at >= public.week_start())
    group by l.profile_id
  ), bonus as (
    select s.house_id, sum(s.points) as points from public.competition_scores s
    where s.school_id = public.my_school_id() and s.house_id is not null
      and (p_period = 'all' or s.created_at >= public.week_start())
    group by s.house_id
  )
  select h.id, h.name, h.emoji, h.color,
         (select count(*) from m where m.house_id = h.id),
         coalesce((select sum(pts.points) from m join pts on pts.profile_id = m.profile_id where m.house_id = h.id), 0)::bigint,
         coalesce(b.points, 0)::bigint,
         (coalesce((select sum(pts.points) from m join pts on pts.profile_id = m.profile_id where m.house_id = h.id), 0) + coalesce(b.points, 0))::bigint,
         round((coalesce((select sum(pts.points) from m join pts on pts.profile_id = m.profile_id where m.house_id = h.id), 0) + coalesce(b.points, 0))::numeric
               / greatest((select count(*) from m where m.house_id = h.id), 1), 1)
  from public.houses h
  left join bonus b on b.house_id = h.id
  where h.school_id = public.my_school_id() and public.is_reader()
  order by 8 desc, h.sort, h.name
$$;

-- ---------------------------------------------------------------------------
-- C. Groups
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  name text not null check (char_length(name) between 3 and 60),
  description text not null default '' check (char_length(description) <= 500),
  emoji text not null default '👥' check (char_length(emoji) <= 8),
  kind text not null default 'student' check (kind in ('official', 'student')),
  privacy text not null default 'public' check (privacy in ('public', 'private')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  member_count int not null default 0,
  created_at timestamptz not null default now()
);
create unique index groups_unique_name on public.groups (school_id, lower(name)) where status = 'active';
create index on public.groups (school_id, status, created_at desc);
alter table public.groups enable row level security;

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'pending')),
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);
create index on public.group_members (profile_id);
alter table public.group_members enable row level security;

create function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and profile_id = (select auth.uid()) and status = 'active'
  )
$$;

create function public.is_group_admin(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and profile_id = (select auth.uid()) and status = 'active' and role in ('owner', 'admin')
  )
$$;

create function public.group_is_public(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.groups where id = p_group and privacy = 'public' and school_id = public.my_school_id()
  )
$$;

-- Posts of a public group are open to the school; a private group's only to its members.
create function public.can_see_group_posts(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group and g.school_id = public.my_school_id()
      and (g.privacy = 'public' or public.is_group_member(g.id))
  )
$$;

create policy "see groups" on public.groups for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader() and (status = 'active' or public.is_admin()));
revoke insert, update, delete on public.groups from authenticated;

create policy "see group members" on public.group_members for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (profile_id = (select auth.uid()) or public.is_group_member(group_id) or public.is_group_admin(group_id)
         or (status = 'active' and public.group_is_public(group_id)) or public.is_admin())
  );
revoke insert, update, delete on public.group_members from authenticated;

-- The group chat lives in the conversations table.
alter table public.conversations drop constraint conversations_kind_check;
alter table public.conversations add constraint conversations_kind_check check (kind in ('club', 'direct', 'group', 'groupchat'));
alter table public.conversations add column group_id uuid unique references public.groups (id) on delete cascade;
alter table public.conversations add constraint conversations_groupchat_check check ((kind = 'groupchat') = (group_id is not null));

create function public.group_members_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_chat uuid;
  v_group uuid := coalesce(new.group_id, old.group_id);
begin
  select id into v_chat from public.conversations where group_id = v_group;
  if tg_op = 'DELETE' or new.status <> 'active' then
    if v_chat is not null then
      delete from public.conversation_members where conversation_id = v_chat and profile_id = coalesce(old.profile_id, new.profile_id);
    end if;
  elsif v_chat is not null then
    insert into public.conversation_members (conversation_id, profile_id) values (v_chat, new.profile_id)
    on conflict do nothing;
  end if;
  update public.groups set member_count = (
    select count(*) from public.group_members where group_id = v_group and status = 'active') where id = v_group;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger sync after insert or update or delete on public.group_members
  for each row execute function public.group_members_sync();
create function public.points_on_group_join() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and new.role = 'member' then
    perform public.award_points(new.profile_id, public.points_for(new.profile_id, 'group_join'), 'group_join', new.group_id);
  end if;
  return new;
end;
$$;
create trigger points after insert on public.group_members
  for each row execute function public.points_on_group_join();

create function public.create_group(p_name text, p_description text, p_emoji text, p_privacy text, p_official boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_name text := left(btrim(coalesce(p_name, '')), 60);
  v_id uuid;
begin
  if not public.is_active() then
    raise exception 'Your account cannot create groups right now.';
  end if;
  if p_official then
    if not public.can_create_official_group() then
      raise exception 'Only admins, the student council and school staff can make official groups.';
    end if;
  else
    if not public.is_current_student(auth.uid()) then
      raise exception 'Only current students can make groups.';
    end if;
    if public.is_restricted('creating_groups') then
      raise exception 'RESTRICTED: An admin has paused this on your account for now.';
    end if;
    perform public.check_rate('group', 3, 86400);
  end if;
  if char_length(v_name) < 3 then
    raise exception 'Give the group a name (at least 3 letters).';
  end if;
  if p_privacy not in ('public', 'private') then
    raise exception 'Choose public or private.';
  end if;
  perform public.reject_blocked(v_school, v_name || ' ' || coalesce(p_description, ''));
  if exists (select 1 from public.groups where school_id = v_school and lower(name) = lower(v_name) and status = 'active') then
    raise exception 'A group with this name already exists.';
  end if;

  insert into public.groups (school_id, name, description, emoji, kind, privacy, created_by)
  values (v_school, v_name, left(btrim(coalesce(p_description, '')), 500),
          coalesce(nullif(left(btrim(coalesce(p_emoji, '')), 8), ''), '👥'),
          case when p_official then 'official' else 'student' end, p_privacy, auth.uid())
  returning id into v_id;
  insert into public.conversations (school_id, kind, group_id, title, created_by)
  values (v_school, 'groupchat', v_id, v_name, auth.uid());
  insert into public.group_members (group_id, profile_id, school_id, role) values (v_id, auth.uid(), v_school, 'owner');
  if p_official then
    perform public.log_action(v_school, 'create_official_group', 'group', v_id, v_name);
  end if;
  return v_id;
end;
$$;

create function public.join_group(p_group uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
  v_status text;
begin
  if not public.is_active() or not public.is_current_student(auth.uid()) then
    raise exception 'Only current students can join groups.';
  end if;
  select * into g from public.groups where id = p_group and school_id = public.my_school_id() and status = 'active';
  if g.id is null then
    raise exception 'Group not found.';
  end if;
  if exists (select 1 from public.group_members where group_id = g.id and profile_id = auth.uid()) then
    raise exception 'You already joined or asked to join this group.';
  end if;
  perform public.check_rate('group_join', 30, 3600);
  v_status := case when g.privacy = 'public' then 'active' else 'pending' end;
  insert into public.group_members (group_id, profile_id, school_id, status) values (g.id, auth.uid(), g.school_id, v_status);
  if v_status = 'pending' then
    insert into public.notifications (school_id, recipient_id, kind, title, body, link)
    select g.school_id, m.profile_id, 'group_request', 'Someone wants to join ' || g.name,
           (select full_name from public.profiles where id = auth.uid()), '/groups/' || g.id
    from public.group_members m where m.group_id = g.id and m.status = 'active' and m.role in ('owner', 'admin');
  end if;
  return v_status;
end;
$$;

create function public.respond_group_request(p_group uuid, p_profile uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
begin
  select * into g from public.groups where id = p_group and school_id = public.my_school_id();
  if g.id is null then
    raise exception 'Group not found.';
  end if;
  if not (public.is_group_admin(g.id) or public.is_admin()) then
    raise exception 'Only the group admins can answer join requests.';
  end if;
  if not exists (select 1 from public.group_members where group_id = g.id and profile_id = p_profile and status = 'pending') then
    raise exception 'Request not found.';
  end if;
  if p_approve then
    update public.group_members set status = 'active', joined_at = now() where group_id = g.id and profile_id = p_profile;
    perform public.notify(p_profile, 'group_request', 'You joined ' || g.name, 'Welcome!', '/groups/' || g.id);
  else
    delete from public.group_members where group_id = g.id and profile_id = p_profile;
    perform public.notify(p_profile, 'group_request', 'Your request to join ' || g.name || ' was not accepted', '', '/groups');
  end if;
end;
$$;

create function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.group_members;
  v_next uuid;
begin
  select * into m from public.group_members where group_id = p_group and profile_id = auth.uid();
  if m.group_id is null then
    raise exception 'You are not in this group.';
  end if;
  delete from public.group_members where group_id = p_group and profile_id = auth.uid();
  if m.role = 'owner' then
    select profile_id into v_next from public.group_members
    where group_id = p_group and status = 'active'
    order by (role = 'admin') desc, joined_at limit 1;
    if v_next is null then
      update public.groups set status = 'archived' where id = p_group;
    else
      update public.group_members set role = 'owner' where group_id = p_group and profile_id = v_next;
    end if;
  end if;
end;
$$;

create function public.remove_group_member(p_group uuid, p_profile uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.group_members;
  g public.groups;
begin
  select * into g from public.groups where id = p_group and school_id = public.my_school_id();
  select * into t from public.group_members where group_id = p_group and profile_id = p_profile;
  if g.id is null or t.group_id is null then
    raise exception 'Member not found.';
  end if;
  if t.role = 'owner' then
    raise exception 'The group owner cannot be removed.';
  end if;
  if not (public.is_admin() or (public.is_group_admin(g.id) and (t.role = 'member' or exists (
        select 1 from public.group_members o where o.group_id = g.id and o.profile_id = auth.uid() and o.role = 'owner')))) then
    raise exception 'You cannot remove this member.';
  end if;
  delete from public.group_members where group_id = p_group and profile_id = p_profile;
  perform public.notify(p_profile, 'group_request', 'You were removed from ' || g.name, '', '/groups');
end;
$$;

create function public.set_group_role(p_group uuid, p_profile uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_role not in ('admin', 'member') then
    raise exception 'Choose admin or member.';
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group and profile_id = auth.uid() and role = 'owner' and status = 'active')
     and not public.is_admin() then
    raise exception 'Only the group owner can change roles.';
  end if;
  update public.group_members set role = p_role
  where group_id = p_group and profile_id = p_profile and status = 'active' and role <> 'owner'
    and school_id = public.my_school_id();
  if not found then
    raise exception 'Member not found.';
  end if;
end;
$$;

create function public.update_group(p_group uuid, p_name text, p_description text, p_emoji text, p_privacy text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
  v_name text := left(btrim(coalesce(p_name, '')), 60);
begin
  select * into g from public.groups where id = p_group and school_id = public.my_school_id();
  if g.id is null or not (public.is_group_admin(g.id) or public.is_admin()) then
    raise exception 'Only the group admins can change the group.';
  end if;
  if char_length(v_name) < 3 then
    raise exception 'Give the group a name (at least 3 letters).';
  end if;
  if p_privacy not in ('public', 'private') then
    raise exception 'Choose public or private.';
  end if;
  perform public.reject_blocked(g.school_id, v_name || ' ' || coalesce(p_description, ''));
  if exists (select 1 from public.groups where school_id = g.school_id and lower(name) = lower(v_name) and status = 'active' and id <> g.id) then
    raise exception 'A group with this name already exists.';
  end if;
  update public.groups
  set name = v_name, description = left(btrim(coalesce(p_description, '')), 500),
      emoji = coalesce(nullif(left(btrim(coalesce(p_emoji, '')), 8), ''), emoji), privacy = p_privacy
  where id = g.id;
  update public.conversations set title = v_name where group_id = g.id;
end;
$$;

create function public.archive_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
begin
  select * into g from public.groups where id = p_group and school_id = public.my_school_id();
  if g.id is null or not (public.is_admin() or exists (
      select 1 from public.group_members where group_id = g.id and profile_id = auth.uid() and role = 'owner' and status = 'active')) then
    raise exception 'Only the group owner or an admin can close the group.';
  end if;
  update public.groups set status = 'archived' where id = g.id;
  if public.is_admin() then
    perform public.log_action(g.school_id, 'archive_group', 'group', g.id, g.name);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- C. Group posts and announcements (also used by clubs)
-- ---------------------------------------------------------------------------

alter table public.posts add column group_id uuid references public.groups (id) on delete cascade;
alter table public.posts add constraint posts_one_space check (club_id is null or group_id is null);
create index on public.posts (group_id, created_at desc) where group_id is not null;
alter table public.posts drop constraint posts_kind_check;
alter table public.posts add constraint posts_kind_check
  check (kind in ('text', 'photo', 'question', 'achievement', 'poll', 'repost', 'announcement'));

create or replace function public.posts_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.club_id is not null then
    select school_id into new.school_id from public.clubs where id = new.club_id;
  elsif new.group_id is not null then
    select school_id into new.school_id from public.groups where id = new.group_id;
  else
    new.school_id := coalesce(public.my_school_id(), new.school_id);
  end if;
  new.status := case
    when public.contains_blocked_word(new.school_id, new.body) then 'held'
    else 'visible'
  end;
  new.reaction_count := 0;
  new.comment_count := 0;
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop policy "see posts" on public.posts;
create policy "see posts" on public.posts for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (status = 'visible' or author_id = (select auth.uid()))
    and (club_id is null or exists (select 1 from public.clubs c where c.id = posts.club_id and c.status = 'approved'))
    and (group_id is null or public.can_see_group_posts(group_id))
  );
drop policy "students post" on public.posts;
create policy "students post" on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid()) and public.is_active() and school_id = public.my_school_id()
    and group_id is null and kind <> 'announcement'
    and (club_id is null or public.is_club_member(club_id))
    and (image_path is null or image_path like public.my_school_id()::text || '/' || (select auth.uid())::text || '/%')
  );

-- Posts inside a club or a group. Announcements are for leaders and group admins.
create function public.create_space_post(p_type text, p_id uuid, p_body text, p_kind text, p_image text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
  v_name text;
  v_status text;
begin
  if not public.is_active() then
    raise exception 'Your account cannot post right now.';
  end if;
  if p_kind not in ('text', 'question', 'announcement') then
    raise exception 'Unknown kind of post';
  end if;
  if v_body = '' then
    raise exception 'Write something first.';
  end if;
  if p_image is not null and p_image not like v_school::text || '/' || auth.uid()::text || '/%' then
    raise exception 'Invalid photo';
  end if;

  if p_type = 'club' then
    select name into v_name from public.clubs where id = p_id and school_id = v_school and status = 'approved';
    if v_name is null or not public.is_club_member(p_id) then
      raise exception 'Join the club to post there.';
    end if;
    if p_kind = 'announcement' and not (public.is_club_leader(p_id) or public.is_admin()) then
      raise exception 'Only club leaders can post announcements.';
    end if;
    insert into public.posts (school_id, club_id, author_id, body, image_path, kind)
    values (v_school, p_id, auth.uid(), left(v_body, 2000), p_image, p_kind) returning id, status into v_id, v_status;
    if p_kind = 'announcement' and v_status = 'visible' then
      insert into public.notifications (school_id, recipient_id, kind, title, body, link)
      select v_school, m.profile_id, 'announcement', 'Announcement from ' || v_name, left(v_body, 120), '/clubs/' || p_id
      from public.club_members m where m.club_id = p_id and m.profile_id <> auth.uid();
    end if;
  elsif p_type = 'group' then
    select name into v_name from public.groups where id = p_id and school_id = v_school and status = 'active';
    if v_name is null or not public.is_group_member(p_id) then
      raise exception 'Join the group to post there.';
    end if;
    if p_kind = 'announcement' and not (public.is_group_admin(p_id) or public.is_admin()) then
      raise exception 'Only group admins can post announcements.';
    end if;
    insert into public.posts (school_id, group_id, author_id, body, image_path, kind)
    values (v_school, p_id, auth.uid(), left(v_body, 2000), p_image, p_kind) returning id, status into v_id, v_status;
    if p_kind = 'announcement' and v_status = 'visible' then
      insert into public.notifications (school_id, recipient_id, kind, title, body, link)
      select v_school, m.profile_id, 'announcement', 'Announcement from ' || v_name, left(v_body, 120), '/groups/' || p_id
      from public.group_members m where m.group_id = p_id and m.status = 'active' and m.profile_id <> auth.uid();
    end if;
  else
    raise exception 'Unknown place to post';
  end if;
  return v_id;
end;
$$;

-- The feed also respects groups, and announcements get a small boost.
create or replace function public.feed_posts(p_limit int, p_offset int, p_tag text default null)
returns setof public.posts
language sql stable set search_path = '' as $$
  select p.*
  from public.posts p
  where p.status = 'visible'
    and (p.club_id is null or public.is_club_member(p.club_id))
    and (p.group_id is null or public.is_group_member(p.group_id))
    and not public.is_blocked_between(p.author_id, (select auth.uid()))
    and (p_tag is null or exists (select 1 from public.post_tags t where t.post_id = p.id and t.tag = lower(p_tag)))
    and p.created_at > now() - interval '120 days'
  order by
    2 * ln(1 + p.reaction_count + 2 * p.comment_count)
    + case
        when p.author_id = (select auth.uid()) then 1
        when public.are_friends(p.author_id, (select auth.uid())) then 4
        when exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followed_id = p.author_id) then 3
        else 0
      end
    + case when p.club_id is not null or p.group_id is not null then 2 else 0 end
    + case when p.kind = 'announcement' then 3 else 0 end
    + case when p.created_at > now() - interval '6 hours' then 3 else 0 end
    - extract(epoch from now() - p.created_at) / 43200.0 desc,
    p.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

-- ---------------------------------------------------------------------------
-- D. Clubs: recruitment, team roles, sessions, tasks, budget, resources,
--    achievements, analytics
-- ---------------------------------------------------------------------------

alter table public.clubs
  add column recruiting text not null default 'open' check (recruiting in ('open', 'application', 'closed')),
  add column application_question text not null default '' check (char_length(application_question) <= 200);
alter table public.club_members
  add column title text not null default '' check (char_length(title) <= 40);

-- Leaders and school admins run a club.
create function public.can_manage_club(p_club uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active() and (
    public.is_club_leader(p_club)
    or (public.is_admin() and exists (select 1 from public.clubs where id = p_club and school_id = public.my_school_id()))
  )
$$;

-- Joining on your own only works while the club is open. Other clubs use applications.
create function public.club_members_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_recruiting text;
begin
  if auth.uid() is not null and new.profile_id = auth.uid() then
    select recruiting into v_recruiting from public.clubs where id = new.club_id;
    if v_recruiting = 'application' then
      raise exception 'This club accepts members by application. Send an application instead.';
    elsif v_recruiting = 'closed' then
      raise exception 'This club is not taking new members right now.';
    end if;
  end if;
  return new;
end;
$$;
create trigger before_insert before insert on public.club_members
  for each row execute function public.club_members_before_insert();

create function public.club_child_school() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select school_id into new.school_id from public.clubs where id = new.club_id;
  if new.school_id is null then
    raise exception 'Club not found.';
  end if;
  return new;
end;
$$;

create function public.update_club_settings(p_club uuid, p_description text, p_emoji text, p_recruiting text, p_question text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.clubs;
begin
  select * into c from public.clubs where id = p_club and school_id = public.my_school_id() and status = 'approved';
  if c.id is null or not public.can_manage_club(c.id) then
    raise exception 'Only club leaders can change the club.';
  end if;
  if p_recruiting not in ('open', 'application', 'closed') then
    raise exception 'Choose how people join.';
  end if;
  perform public.reject_blocked(c.school_id, coalesce(p_description, '') || ' ' || coalesce(p_question, ''));
  update public.clubs
  set description = left(btrim(coalesce(p_description, '')), 500),
      emoji = coalesce(nullif(left(btrim(coalesce(p_emoji, '')), 8), ''), emoji),
      recruiting = p_recruiting, application_question = left(btrim(coalesce(p_question, '')), 200)
  where id = c.id;
end;
$$;

-- Team roles such as Treasurer or Media. (Leader roles are given by Super Admins only.)
create function public.set_member_title(p_club uuid, p_profile uuid, p_title text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_club(p_club) then
    raise exception 'Only club leaders can give team roles.';
  end if;
  perform public.reject_blocked(public.my_school_id(), coalesce(p_title, ''));
  update public.club_members set title = left(btrim(coalesce(p_title, '')), 40)
  where club_id = p_club and profile_id = p_profile;
  if not found then
    raise exception 'Member not found.';
  end if;
end;
$$;

create function public.remove_club_member(p_club uuid, p_profile uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_club(p_club) then
    raise exception 'Only club leaders can remove members.';
  end if;
  if exists (select 1 from public.club_members where club_id = p_club and profile_id = p_profile and role = 'leader') then
    raise exception 'Leaders can only be changed by a Super Admin.';
  end if;
  delete from public.club_members where club_id = p_club and profile_id = p_profile;
  perform public.notify(p_profile, 'club', 'You were removed from a club', '', '/clubs');
end;
$$;

-- Applications ---------------------------------------------------------------
create table public.club_applications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  message text not null default '' check (char_length(message) <= 800),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index club_applications_one_pending on public.club_applications (club_id, profile_id) where status = 'pending';
create index on public.club_applications (club_id, status);
create index on public.club_applications (profile_id);
alter table public.club_applications enable row level security;
create policy "own application or leader" on public.club_applications for select to authenticated
  using (profile_id = (select auth.uid()) or (school_id = public.my_school_id() and public.can_manage_club(club_id)));
revoke insert, update, delete on public.club_applications from authenticated;

create function public.apply_to_club(p_club uuid, p_message text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.clubs;
  v_id uuid;
begin
  if not public.is_active() or not public.is_current_student(auth.uid()) then
    raise exception 'Only current students can apply.';
  end if;
  select * into c from public.clubs where id = p_club and school_id = public.my_school_id() and status = 'approved';
  if c.id is null then
    raise exception 'Club not found.';
  end if;
  if c.recruiting <> 'application' then
    raise exception 'You can join this club directly, or it is not taking members.';
  end if;
  if public.is_club_member(c.id) then
    raise exception 'You are already in this club.';
  end if;
  if exists (select 1 from public.club_applications where club_id = c.id and profile_id = auth.uid() and status = 'pending') then
    raise exception 'You already applied. Please wait for an answer.';
  end if;
  perform public.reject_blocked(c.school_id, coalesce(p_message, ''));
  perform public.check_rate('club_application', 10, 86400);
  insert into public.club_applications (club_id, school_id, profile_id, message)
  values (c.id, c.school_id, auth.uid(), left(btrim(coalesce(p_message, '')), 800)) returning id into v_id;
  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select c.school_id, m.profile_id, 'club_application', 'New application to ' || c.name,
         (select full_name from public.profiles where id = auth.uid()), '/clubs/' || c.id || '/manage?tab=members'
  from public.club_members m where m.club_id = c.id and m.role = 'leader';
  return v_id;
end;
$$;

create function public.review_club_application(p_application uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.club_applications;
  c public.clubs;
begin
  select * into a from public.club_applications where id = p_application and status = 'pending' for update;
  if a.id is null or a.school_id <> public.my_school_id() then
    raise exception 'Application not found.';
  end if;
  if not public.can_manage_club(a.club_id) then
    raise exception 'Only club leaders can answer applications.';
  end if;
  if a.profile_id = auth.uid() then
    raise exception 'You cannot answer your own application.';
  end if;
  select * into c from public.clubs where id = a.club_id;
  if p_approve then
    insert into public.club_members (club_id, profile_id, role) values (a.club_id, a.profile_id, 'member')
    on conflict do nothing;
  end if;
  update public.club_applications set status = case when p_approve then 'accepted' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now() where id = a.id;
  perform public.notify(a.profile_id, 'club_application',
    case when p_approve then 'Welcome to ' || c.name else 'Your application to ' || c.name || ' was not accepted' end,
    '', '/clubs/' || c.id);
end;
$$;

create function public.withdraw_club_application(p_application uuid) returns void
language sql security definer set search_path = '' as $$
  update public.club_applications set status = 'withdrawn'
  where id = p_application and profile_id = auth.uid() and status = 'pending'
$$;

-- Sessions and attendance -----------------------------------------------------
create table public.club_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  title text not null check (char_length(title) between 2 and 100),
  held_on date not null,
  notes text not null default '' check (char_length(notes) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.club_sessions (club_id, held_on desc);
create trigger school before insert on public.club_sessions for each row execute function public.club_child_school();
alter table public.club_sessions enable row level security;
create policy "members see sessions" on public.club_sessions for select to authenticated
  using (school_id = public.my_school_id() and (public.is_club_member(club_id) or public.can_manage_club(club_id)));
create policy "leaders add sessions" on public.club_sessions for insert to authenticated
  with check (public.can_manage_club(club_id) and created_by = (select auth.uid()));
create policy "leaders remove sessions" on public.club_sessions for delete to authenticated
  using (public.can_manage_club(club_id));
revoke update on public.club_sessions from authenticated;

create table public.club_attendance (
  session_id uuid not null references public.club_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  present boolean not null default true,
  primary key (session_id, profile_id)
);
create index on public.club_attendance (club_id);
alter table public.club_attendance enable row level security;
create policy "own attendance or leader" on public.club_attendance for select to authenticated
  using (profile_id = (select auth.uid()) or public.can_manage_club(club_id));
revoke insert, update, delete on public.club_attendance from authenticated;

create function public.set_club_attendance(p_session uuid, p_profile uuid, p_present boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.club_sessions;
begin
  select * into s from public.club_sessions where id = p_session and school_id = public.my_school_id();
  if s.id is null or not public.can_manage_club(s.club_id) then
    raise exception 'Only club leaders can take attendance.';
  end if;
  if not exists (select 1 from public.club_members where club_id = s.club_id and profile_id = p_profile) then
    raise exception 'That student is not in this club.';
  end if;
  insert into public.club_attendance (session_id, profile_id, club_id, present) values (s.id, p_profile, s.club_id, p_present)
  on conflict (session_id, profile_id) do update set present = excluded.present;
end;
$$;

-- Projects and tasks ----------------------------------------------------------
create table public.club_projects (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  status text not null default 'active' check (status in ('active', 'done')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.club_projects (club_id);
create trigger school before insert on public.club_projects for each row execute function public.club_child_school();
alter table public.club_projects enable row level security;
create policy "members see projects" on public.club_projects for select to authenticated
  using (school_id = public.my_school_id() and (public.is_club_member(club_id) or public.can_manage_club(club_id)));
create policy "leaders add projects" on public.club_projects for insert to authenticated
  with check (public.can_manage_club(club_id) and created_by = (select auth.uid()));
create policy "leaders change projects" on public.club_projects for update to authenticated
  using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
create policy "leaders remove projects" on public.club_projects for delete to authenticated
  using (public.can_manage_club(club_id));
revoke update on public.club_projects from authenticated;
grant update (name, description, status) on public.club_projects to authenticated;

create table public.club_tasks (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  project_id uuid references public.club_projects (id) on delete set null,
  title text not null check (char_length(title) between 2 and 120),
  assignee_id uuid references public.profiles (id) on delete set null,
  due_on date,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.club_tasks (club_id, status);
create index on public.club_tasks (assignee_id);
create function public.club_tasks_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select school_id into new.school_id from public.clubs where id = new.club_id;
  if new.assignee_id is not null and not exists (
    select 1 from public.club_members where club_id = new.club_id and profile_id = new.assignee_id) then
    raise exception 'Tasks can only be given to club members.';
  end if;
  if new.project_id is not null and not exists (
    select 1 from public.club_projects where id = new.project_id and club_id = new.club_id) then
    raise exception 'Project not found.';
  end if;
  return new;
end;
$$;
create trigger task_check before insert or update on public.club_tasks for each row execute function public.club_tasks_check();
alter table public.club_tasks enable row level security;
create policy "members see tasks" on public.club_tasks for select to authenticated
  using (school_id = public.my_school_id() and (public.is_club_member(club_id) or public.can_manage_club(club_id)));
create policy "leaders add tasks" on public.club_tasks for insert to authenticated
  with check (public.can_manage_club(club_id) and created_by = (select auth.uid()));
create policy "leaders change tasks" on public.club_tasks for update to authenticated
  using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
create policy "leaders remove tasks" on public.club_tasks for delete to authenticated
  using (public.can_manage_club(club_id));
revoke update on public.club_tasks from authenticated;
grant update (title, assignee_id, due_on, status, project_id) on public.club_tasks to authenticated;

-- Whoever is given a task can move it along.
create function public.set_task_status(p_task uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.club_tasks;
begin
  if p_status not in ('todo', 'doing', 'done') then
    raise exception 'Unknown status';
  end if;
  select * into t from public.club_tasks where id = p_task and school_id = public.my_school_id();
  if t.id is null or not (t.assignee_id = auth.uid() or public.can_manage_club(t.club_id)) then
    raise exception 'You cannot change this task.';
  end if;
  update public.club_tasks set status = p_status where id = t.id;
end;
$$;

-- Budget (leaders and admins only) and shared resources ----------------------
create table public.club_budget (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(10, 2) not null check (amount > 0 and amount < 1000000),
  description text not null check (char_length(description) between 2 and 120),
  entry_date date not null default current_date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.club_budget (club_id, entry_date desc);
create trigger school before insert on public.club_budget for each row execute function public.club_child_school();
alter table public.club_budget enable row level security;
create policy "leaders see budget" on public.club_budget for select to authenticated
  using (school_id = public.my_school_id() and public.can_manage_club(club_id));
create policy "leaders add budget" on public.club_budget for insert to authenticated
  with check (public.can_manage_club(club_id) and created_by = (select auth.uid()));
create policy "leaders remove budget" on public.club_budget for delete to authenticated
  using (public.can_manage_club(club_id));
revoke update on public.club_budget from authenticated;

create table public.club_resources (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  title text not null check (char_length(title) between 2 and 100),
  url text check (url ~ '^https://[^ ]+$' and char_length(url) <= 300),
  notes text not null default '' check (char_length(notes) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.club_resources (club_id);
create trigger school before insert on public.club_resources for each row execute function public.club_child_school();
alter table public.club_resources enable row level security;
create policy "members see resources" on public.club_resources for select to authenticated
  using (school_id = public.my_school_id() and (public.is_club_member(club_id) or public.can_manage_club(club_id)));
create policy "leaders add resources" on public.club_resources for insert to authenticated
  with check (public.can_manage_club(club_id) and created_by = (select auth.uid()));
create policy "leaders remove resources" on public.club_resources for delete to authenticated
  using (public.can_manage_club(club_id));
revoke update on public.club_resources from authenticated;

-- Achievements: leaders propose, an admin or school staff approves (and may give points).
create table public.club_achievements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 500),
  achieved_on date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  points_each int not null default 0 check (points_each between 0 and 50),
  proposed_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.club_achievements (club_id, status);
alter table public.club_achievements enable row level security;
create policy "see achievements" on public.club_achievements for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader() and (status = 'approved' or public.can_manage_club(club_id) or public.can_manage_points()));
revoke insert, update, delete on public.club_achievements from authenticated;

create function public.propose_club_achievement(p_club uuid, p_title text, p_description text, p_date date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_school uuid := public.my_school_id();
begin
  if not public.can_manage_club(p_club) or not exists (select 1 from public.clubs where id = p_club and school_id = v_school) then
    raise exception 'Only club leaders can add achievements.';
  end if;
  perform public.reject_blocked(v_school, coalesce(p_title, '') || ' ' || coalesce(p_description, ''));
  perform public.check_rate('club_achievement', 10, 86400);
  insert into public.club_achievements (club_id, school_id, title, description, achieved_on, proposed_by)
  values (p_club, v_school, left(btrim(coalesce(p_title, '')), 100), left(btrim(coalesce(p_description, '')), 500),
          coalesce(p_date, current_date), auth.uid()) returning id into v_id;
  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select v_school, p.id, 'club_achievement', 'A club achievement needs checking', left(btrim(p_title), 100), '/admin/points'
  from public.profiles p
  where p.school_id = v_school and p.deactivated_at is null
    and (p.role in ('admin', 'super_admin') or exists (
      select 1 from public.leadership_roles l where l.profile_id = p.id and l.kind = 'school_staff'));
  return v_id;
end;
$$;

create function public.review_club_achievement(p_id uuid, p_approve boolean, p_points int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.club_achievements;
  m record;
  v_points int := coalesce(p_points, 0);
  v_club text;
begin
  if not public.can_manage_points() then
    raise exception 'Only admins and school staff can check achievements.';
  end if;
  select * into a from public.club_achievements
  where id = p_id and school_id = public.my_school_id() and status = 'pending' for update;
  if a.id is null then
    raise exception 'Achievement not found or already checked.';
  end if;
  if v_points < 0 or v_points > 50 then
    raise exception 'Give 0 to 50 points to each member.';
  end if;
  select name into v_club from public.clubs where id = a.club_id;
  update public.club_achievements
  set status = case when p_approve then 'approved' else 'rejected' end,
      points_each = case when p_approve then v_points else 0 end, reviewed_by = auth.uid(), reviewed_at = now()
  where id = a.id;
  if p_approve then
    for m in select profile_id from public.club_members where club_id = a.club_id loop
      if v_points > 0 then
        perform public.award_points(m.profile_id, v_points, 'club_achievement', a.id);
      end if;
      perform public.notify(m.profile_id, 'club_achievement', v_club || ' achieved: ' || a.title,
        case when v_points > 0 then 'You earned ' || v_points || ' points.' else '' end, '/clubs/' || a.club_id);
    end loop;
  end if;
  perform public.log_action(a.school_id, case when p_approve then 'approve_club_achievement' else 'reject_club_achievement' end,
    'club', a.club_id, v_club || ' · ' || a.title || ' · ' || v_points);
end;
$$;

-- Analytics for leaders and admins.
create function public.club_analytics(p_club uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v_members int;
  v_attend numeric;
begin
  if not public.can_manage_club(p_club) or not exists (select 1 from public.clubs where id = p_club and school_id = public.my_school_id()) then
    raise exception 'Only club leaders can see this.';
  end if;
  select count(*) into v_members from public.club_members where club_id = p_club;
  select round(100.0 * count(*) filter (where present) / nullif(count(*), 0), 0) into v_attend
  from public.club_attendance a join public.club_sessions s on s.id = a.session_id
  where a.club_id = p_club and s.held_on > current_date - 90;
  return json_build_object(
    'members', v_members,
    'new_members_30d', (select count(*) from public.club_members where club_id = p_club and joined_at > now() - interval '30 days'),
    'pending_applications', (select count(*) from public.club_applications where club_id = p_club and status = 'pending'),
    'posts_30d', (select count(*) from public.posts where club_id = p_club and status = 'visible' and created_at > now() - interval '30 days'),
    'sessions_90d', (select count(*) from public.club_sessions where club_id = p_club and held_on > current_date - 90),
    'attendance_rate', v_attend,
    'tasks_open', (select count(*) from public.club_tasks where club_id = p_club and status <> 'done'),
    'tasks_done', (select count(*) from public.club_tasks where club_id = p_club and status = 'done'),
    'upcoming_events', (select count(*) from public.events where club_id = p_club and status = 'approved' and starts_at > now()),
    'achievements', (select count(*) from public.club_achievements where club_id = p_club and status = 'approved'),
    'budget_balance', (select coalesce(sum(case when kind = 'income' then amount else -amount end), 0) from public.club_budget where club_id = p_club)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- E. Leadership tools
-- ---------------------------------------------------------------------------

create table public.class_announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  grade int not null check (grade between 1 and 12),
  section text not null check (section ~ '^[A-Z]$'),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  body text not null check (char_length(body) between 2 and 1000),
  created_at timestamptz not null default now()
);
create index on public.class_announcements (school_id, grade, section, created_at desc);
alter table public.class_announcements enable row level security;
create policy "class sees announcements" on public.class_announcements for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader() and (
    author_id = (select auth.uid()) or public.is_admin()
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.grade = class_announcements.grade and p.section = class_announcements.section)));
revoke insert, update, delete on public.class_announcements from authenticated;

-- A class representative writes to their own class only.
create function public.post_class_announcement(p_class text, p_title text, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  v_grade int;
  v_section text;
  v_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if p_class !~ '^[0-9]{1,2}[A-Z]$' then
    raise exception 'Write the class like 11A.';
  end if;
  v_grade := substring(p_class from '^[0-9]+')::int;
  v_section := right(p_class, 1);
  if not public.has_leadership('class_rep') or not exists (
    select 1 from public.leadership_roles where profile_id = me.id and kind = 'class_rep' and scope = p_class) then
    raise exception 'You are not the representative of this class.';
  end if;
  perform public.reject_blocked(me.school_id, coalesce(p_title, '') || ' ' || coalesce(p_body, ''));
  perform public.check_rate('class_announcement', 10, 86400);
  insert into public.class_announcements (school_id, grade, section, author_id, title, body)
  values (me.school_id, v_grade, v_section, me.id, left(btrim(coalesce(p_title, '')), 100), left(btrim(coalesce(p_body, '')), 1000))
  returning id into v_id;
  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select me.school_id, p.id, 'class_announcement', 'Class ' || p_class || ': ' || left(btrim(p_title), 80), left(btrim(p_body), 120), '/leadership/dashboard'
  from public.profiles p
  where p.school_id = me.school_id and p.grade = v_grade and p.section = v_section
    and p.deactivated_at is null and p.id <> me.id;
  return v_id;
end;
$$;

-- What a class representative may see about their class: how many students
-- and this week's points together. Nobody's own points are shown.
create function public.class_summary(p_class text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v_grade int;
  v_section text;
begin
  if p_class !~ '^[0-9]{1,2}[A-Z]$' or not exists (
    select 1 from public.leadership_roles where profile_id = auth.uid() and kind = 'class_rep' and scope = p_class) then
    raise exception 'You are not the representative of this class.';
  end if;
  v_grade := substring(p_class from '^[0-9]+')::int;
  v_section := right(p_class, 1);
  return json_build_object(
    'students', (select count(*) from public.profiles p where p.school_id = public.my_school_id() and p.grade = v_grade and p.section = v_section and p.deactivated_at is null and p.onboarded_at is not null),
    'points_week', (select coalesce(sum(l.points), 0) from public.points_ledger l join public.profiles p on p.id = l.profile_id
                    where p.school_id = public.my_school_id() and p.grade = v_grade and p.section = v_section and l.created_at >= public.week_start()),
    'house', (select h.name from public.house_classes hc join public.houses h on h.id = hc.house_id
              where hc.school_id = public.my_school_id() and hc.grade = v_grade and hc.section = v_section)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports can now be about groups
-- ---------------------------------------------------------------------------

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'message', 'profile', 'club', 'event', 'listing', 'question', 'answer', 'comment', 'group'));

create or replace function public.reports_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid;
  v_kind text;
  v_conversation uuid;
begin
  if new.reporter_id is null then
    return new; -- created by the filter
  end if;

  if new.reason = 'filter' then
    raise exception 'Invalid reason';
  end if;

  new.school_id := public.my_school_id();
  new.status := 'open';
  new.admin_only := false;

  if new.target_type = 'post' then
    select school_id, author_id,
           body || case when image_path is not null then ' [photo attached]' else '' end
      into v_school, new.target_author_id, new.snapshot
    from public.posts where id = new.target_id;
  elsif new.target_type = 'message' then
    select m.school_id, m.sender_id, m.body, c.kind, c.id
      into v_school, new.target_author_id, new.snapshot, v_kind, v_conversation
    from public.messages m join public.conversations c on c.id = m.conversation_id
    where m.id = new.target_id;
    if not public.is_conversation_member(v_conversation) then
      raise exception 'You can only report messages in your own chats.';
    end if;
    new.admin_only := v_kind = 'direct';
  elsif new.target_type = 'profile' then
    select school_id, id, full_name || ': ' || bio
      into v_school, new.target_author_id, new.snapshot
    from public.profiles where id = new.target_id;
  elsif new.target_type = 'club' then
    select school_id, requested_by, name || ': ' || description
      into v_school, new.target_author_id, new.snapshot
    from public.clubs where id = new.target_id;
  elsif new.target_type = 'event' then
    select school_id, created_by, title || ': ' || description
      into v_school, new.target_author_id, new.snapshot
    from public.events where id = new.target_id;
  elsif new.target_type = 'listing' then
    select school_id, seller_id,
           title || ': ' || description || case when image_path is not null then ' [photo attached]' else '' end
      into v_school, new.target_author_id, new.snapshot
    from public.listings where id = new.target_id;
  elsif new.target_type = 'question' then
    select school_id, author_id, title || ': ' || body
      into v_school, new.target_author_id, new.snapshot
    from public.tawjihi_questions where id = new.target_id;
  elsif new.target_type = 'group' then
    select school_id, created_by, name || ': ' || description
      into v_school, new.target_author_id, new.snapshot
    from public.groups where id = new.target_id;
  elsif new.target_type = 'comment' then
    select school_id, author_id, body
      into v_school, new.target_author_id, new.snapshot
    from public.post_comments where id = new.target_id;
  elsif new.target_type = 'answer' then
    select school_id, author_id, body
      into v_school, new.target_author_id, new.snapshot
    from public.tawjihi_answers where id = new.target_id;
  end if;

  if v_school is null or v_school <> new.school_id then
    raise exception 'Could not find what you are reporting.';
  end if;
  if new.target_author_id = auth.uid() then
    raise exception 'You cannot report yourself.';
  end if;
  return new;
end;
$$;

create or replace function public.moderate_report(p_report uuid, p_action text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.reports;
  v_note text := nullif(btrim(p_note), '');
begin
  if not public.is_staff() then
    raise exception 'Only moderators can review reports.';
  end if;
  if p_action not in ('dismiss', 'remove') then
    raise exception 'Unknown action';
  end if;
  select * into r from public.reports
  where id = p_report and school_id = public.my_school_id() and status = 'open';
  if r.id is null then
    raise exception 'Report not found or already handled.';
  end if;
  if r.admin_only and not public.is_admin() then
    raise exception 'Only admins can review reports about private messages.';
  end if;

  if p_action = 'remove' then
    if r.target_type = 'post' then
      update public.posts set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'removed' where id = r.target_id and status = 'visible';
      if found then
        update public.posts set comment_count = greatest(comment_count - 1, 0)
        where id = (select post_id from public.post_comments where id = r.target_id);
      else
        update public.post_comments set status = 'removed' where id = r.target_id;
      end if;
    elsif r.target_type = 'message' then
      update public.messages set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'group' then
      update public.groups set status = 'archived' where id = r.target_id;
    elsif r.target_type = 'club' then
      update public.clubs set status = 'archived' where id = r.target_id;
    elsif r.target_type = 'event' then
      update public.events set status = 'cancelled' where id = r.target_id and status in ('pending', 'approved');
    elsif r.target_type = 'listing' then
      update public.listings set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'question' then
      update public.tawjihi_questions set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'answer' then
      update public.tawjihi_answers set status = 'removed' where id = r.target_id;
    end if;
    if r.target_type <> 'profile' then
      perform public.notify(r.target_author_id, 'content_removed',
        'Something you shared was removed',
        'It broke the school''s community rules.' || coalesce(' Note: ' || v_note, ''), null);
    end if;
  else
    -- Nothing wrong: put back content the filter or other reports had hidden.
    if r.target_type = 'post' then
      update public.posts set status = 'visible' where id = r.target_id and status = 'held';
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'visible' where id = r.target_id and status = 'held';
      if found then
        update public.posts set comment_count = comment_count + 1
        where id = (select post_id from public.post_comments where id = r.target_id);
      end if;
    elsif r.target_type = 'message' then
      update public.messages set status = 'visible' where id = r.target_id and status = 'held';
    elsif r.target_type = 'listing' then
      update public.listings set status = 'active' where id = r.target_id and status = 'held';
    elsif r.target_type = 'question' then
      update public.tawjihi_questions set status = 'visible' where id = r.target_id and status = 'held';
    elsif r.target_type = 'answer' then
      update public.tawjihi_answers set status = 'visible' where id = r.target_id and status = 'held';
    end if;
  end if;

  update public.reports
  set status = case when p_action = 'remove' then 'resolved' else 'dismissed' end,
      resolution = coalesce(v_note, case when p_action = 'remove' then 'Content removed' else 'No action needed' end),
      resolved_by = auth.uid(), resolved_at = now()
  where target_type = r.target_type and target_id = r.target_id and status = 'open';

  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select distinct r.school_id, x.reporter_id, 'report_reviewed', 'Thanks for your report',
         'A moderator reviewed it and took care of it.', null
  from public.reports x
  where x.target_type = r.target_type and x.target_id = r.target_id
    and x.reporter_id is not null and x.resolved_at = now();

  perform public.log_action(r.school_id,
    case when p_action = 'remove' then 'remove_content' else 'dismiss_report' end,
    r.target_type, r.target_id, coalesce(v_note, ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
do $$
declare f text;
begin
  -- Internal helpers and trigger functions: never callable from the website.
  foreach f in array array[
    'points_for(uuid, text)', 'seed_school_rewards()', 'profiles_check_accent()', 'profiles_lock_section()', 'group_members_sync()',
    'points_on_group_join()', 'club_members_before_insert()', 'club_child_school()', 'club_tasks_check()'
  ] loop
    execute 'revoke execute on function public.' || f || ' from authenticated';
  end loop;
  foreach f in array array[
    'has_leadership(text)', 'can_manage_points()', 'can_create_official_group()',
    'claim_points(text, text)', 'review_point_claim(uuid, boolean, int, text)',
    'level_for_xp(bigint)', 'xp_for_level(int)', 'my_points()', 'redeem_reward(uuid)', 'handle_redemption(uuid, boolean, text)',
    'individual_leaderboard(text, int, int)', 'house_leaderboard(text)',
    'create_default_houses(int)', 'admin_set_section(uuid, text)', 'my_house()',
    'create_team(uuid, text)', 'join_team(uuid)', 'leave_team(uuid)', 'award_competition_points(uuid, uuid, uuid, int, text)',
    'is_group_member(uuid)', 'is_group_admin(uuid)', 'group_is_public(uuid)', 'can_see_group_posts(uuid)',
    'create_group(text, text, text, text, boolean)', 'join_group(uuid)', 'respond_group_request(uuid, uuid, boolean)',
    'leave_group(uuid)', 'remove_group_member(uuid, uuid)', 'set_group_role(uuid, uuid, text)',
    'update_group(uuid, text, text, text, text)', 'archive_group(uuid)', 'create_space_post(text, uuid, text, text, text)',
    'can_manage_club(uuid)', 'update_club_settings(uuid, text, text, text, text)', 'set_member_title(uuid, uuid, text)',
    'remove_club_member(uuid, uuid)', 'apply_to_club(uuid, text)', 'review_club_application(uuid, boolean)',
    'withdraw_club_application(uuid)', 'set_club_attendance(uuid, uuid, boolean)', 'set_task_status(uuid, text)',
    'propose_club_achievement(uuid, text, text, date)', 'review_club_achievement(uuid, boolean, int)', 'club_analytics(uuid)',
    'post_class_announcement(text, text, text)', 'class_summary(text)'
  ] loop
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
