-- Loop Points, Rewards, Streaks, XP and Achievements: one central system.
-- Extends what exists (points_ledger, point rules, badges, rewards shop); nothing is replaced or deleted.

-- ---------------------------------------------------------------------------
-- 1. The ledger: earn, adjust, reversal. History is never edited or deleted.
-- ---------------------------------------------------------------------------
alter table public.points_ledger
  add column kind text not null default 'earn' check (kind in ('earn', 'adjust', 'reversal')),
  add column note text,
  add column created_by uuid references public.profiles (id) on delete set null,
  add column reverses_id bigint references public.points_ledger (id);
alter table public.points_ledger drop constraint points_ledger_points_check;
alter table public.points_ledger add constraint points_ledger_points_check
  check ((kind = 'earn' and points > 0) or (kind <> 'earn' and points <> 0));
-- A mistake can be reversed once; the original row stays.
create unique index points_ledger_one_reversal on public.points_ledger (reverses_id) where reverses_id is not null;

drop policy "own points" on public.points_ledger;
create policy "own or staff points" on public.points_ledger for select to authenticated
  using (profile_id = (select auth.uid()) or (school_id = public.my_school_id() and public.can_manage_points()));

-- ---------------------------------------------------------------------------
-- 2. Rules: new rewards, configurable by admins (the same tables as before)
-- ---------------------------------------------------------------------------
alter table public.point_rule_defaults drop constraint point_rule_defaults_points_check;
alter table public.point_rule_defaults add constraint point_rule_defaults_points_check check (points between 0 and 1000);
alter table public.point_rules drop constraint point_rules_points_check;
alter table public.point_rules add constraint point_rules_points_check check (points between 0 and 1000);

insert into public.point_rule_defaults (reason, label, points, daily_limit, weekly_limit, requires_verification, sort) values
  ('daily_login', 'Daily login', 5, 1, null, false, 200),
  ('profile_complete', 'Completing your profile', 20, null, null, false, 205),
  ('streak_7', '7-day streak', 25, null, null, false, 210),
  ('streak_14', '14-day streak', 40, null, null, false, 211),
  ('streak_30', '30-day streak', 100, null, null, false, 212),
  ('streak_60', '60-day streak', 150, null, null, false, 213),
  ('streak_100', '100-day streak', 250, null, null, false, 214),
  ('resource_save', 'Saving a study resource', 1, 10, null, false, 220),
  ('resource_review', 'Reviewing a study resource', 3, 5, null, false, 221),
  ('library_resource', 'Sharing an approved study resource', 20, null, null, false, 222),
  ('tutor_apply', 'Applying to be a tutor', 5, null, null, false, 230),
  ('tutor_approved', 'Becoming an approved tutor', 25, null, null, false, 231),
  ('idea_planned', 'An idea that was planned', 10, null, null, false, 240),
  ('idea_done', 'An idea that was carried out', 25, null, null, false, 241),
  ('volunteer_5', 'Every 5 verified volunteering activities', 25, null, null, false, 250),
  ('club_leader', 'Becoming a club leader', 25, null, null, false, 260);

-- ---------------------------------------------------------------------------
-- 3. Small helpers
-- ---------------------------------------------------------------------------
create function public.school_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Hebron')::date
$$;

-- What a rule is worth right now (0 when an admin switched it off). Limits are checked by points_for().
create function public.rule_points(p_school uuid, p_reason text) returns int
language sql stable security definer set search_path = '' as $$
  select case when r.reason is not null then (case when r.enabled then r.points else 0 end) else coalesce(d.points, 0) end
  from (select 1) x
  left join public.point_rule_defaults d on d.reason = p_reason
  left join public.point_rules r on r.school_id = p_school and r.reason = p_reason
$$;

create function public.level_name(p_level int) returns text
language sql immutable set search_path = '' as $$
  select (array['Newcomer', 'Explorer', 'Contributor', 'Rising Star', 'Community Star', 'Achiever', 'Champion', 'Legend'])[least(greatest(p_level, 1), 8)]
$$;

-- ---------------------------------------------------------------------------
-- 4. Streaks
-- ---------------------------------------------------------------------------
create table public.login_days (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  -- true once the student did something eligible that day (a refresh never counts).
  active boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (profile_id, day)
);
alter table public.login_days enable row level security;
create policy "own login days" on public.login_days for select to authenticated using (profile_id = (select auth.uid()));
revoke insert, update, delete on public.login_days from authenticated;

create table public.student_stats (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.student_stats enable row level security;
create policy "own stats" on public.student_stats for select to authenticated using (profile_id = (select auth.uid()));
revoke insert, update, delete on public.student_stats from authenticated;

create table public.streak_milestones (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  days int not null,
  awarded_at timestamptz not null default now(),
  primary key (profile_id, days)
);
alter table public.streak_milestones enable row level security;
create policy "own milestones" on public.streak_milestones for select to authenticated using (profile_id = (select auth.uid()));
revoke insert, update, delete on public.streak_milestones from authenticated;

-- The current streak: consecutive active days ending today (or yesterday, while today is still open).
create function public.streak_now(p_profile uuid) returns int
language plpgsql stable security definer set search_path = '' as $$
declare
  d date := public.school_today();
  n int := 0;
begin
  if not exists (select 1 from public.login_days where profile_id = p_profile and day = d and active) then
    d := d - 1;
  end if;
  while exists (select 1 from public.login_days where profile_id = p_profile and day = d and active) loop
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end;
$$;

create function public.refresh_streak(p_profile uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n int := public.streak_now(p_profile);
  v_school uuid;
  m int;
begin
  select school_id into v_school from public.profiles where id = p_profile;
  insert into public.student_stats (profile_id, current_streak, longest_streak) values (p_profile, n, n)
  on conflict (profile_id) do update
    set current_streak = n, longest_streak = greatest(public.student_stats.longest_streak, n), updated_at = now();
  -- Each milestone is earned once, ever.
  foreach m in array array[7, 14, 30, 60, 100] loop
    if n >= m and not exists (select 1 from public.streak_milestones where profile_id = p_profile and days = m) then
      insert into public.streak_milestones (profile_id, days) values (p_profile, m) on conflict do nothing;
      if found then
        perform public.award_points(p_profile, public.rule_points(v_school, 'streak_' || m), 'streak_' || m, md5('streak:' || m)::uuid);
        perform public.notify(p_profile, 'streak', '🔥 Your ' || m || '-day streak is complete!',
          'Keep it going. See your streak and what comes next.', '/points');
      end if;
    end if;
  end loop;
end;
$$;

-- Something eligible happened today. Automated or staff-given rewards do not count as the student's own activity.
create function public.mark_active(p_profile uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_reason = any (array['daily_login', 'profile_complete', 'achievement', 'library_resource', 'tutor_approved', 'idea_planned', 'idea_done',
                           'volunteer_5', 'club_leader', 'challenge_rank', 'competition_team', 'club_achievement', 'competition'])
     or p_reason like 'streak\_%' then
    return;
  end if;
  insert into public.login_days (profile_id, day, active) values (p_profile, public.school_today(), true)
  on conflict (profile_id, day) do update set active = true;
  perform public.refresh_streak(p_profile);
end;
$$;

create function public.my_streak() returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v_now int := public.streak_now(auth.uid());
  v_longest int;
begin
  select longest_streak into v_longest from public.student_stats where profile_id = auth.uid();
  return json_build_object(
    'current', v_now,
    'longest', greatest(coalesce(v_longest, 0), v_now),
    'today_active', exists (select 1 from public.login_days where profile_id = auth.uid() and day = public.school_today() and active),
    'next', (select min(m) from unnest(array[7, 14, 30, 60, 100]) m where m > v_now),
    'earned', coalesce((select json_agg(days order by days) from public.streak_milestones where profile_id = auth.uid()), '[]'::json),
    'week', (select json_agg(json_build_object('day', g.d, 'active', coalesce(l.active, false)) order by g.d)
             from generate_series(public.school_today() - 6, public.school_today(), interval '1 day') as g(d)
             left join public.login_days l on l.profile_id = auth.uid() and l.day = g.d::date));
end;
$$;

-- Called once when the app opens. Safe to call as often as you like: one reward per school-local day.
create function public.record_login() returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_day date := public.school_today();
  v_new int;
  v_points int := 0;
begin
  if v_me is null or not public.is_active() or not public.is_current_student(v_me) then
    return null;
  end if;
  insert into public.login_days (profile_id, day) values (v_me, v_day) on conflict do nothing;
  get diagnostics v_new = row_count;
  if v_new > 0 then
    perform public.check_rate('record_login', 20, 3600);
    v_points := public.rule_points(public.my_school_id(), 'daily_login');
    perform public.award_points(v_me, v_points, 'daily_login', md5('login:' || v_day::text)::uuid);
    perform public.refresh_streak(v_me);
    perform public.award_badges(v_me);
  end if;
  return json_build_object('first_today', v_new > 0, 'points', case when v_new > 0 then v_points else 0 end, 'streak', public.my_streak());
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Awarding: the one function everything uses (same signature as before)
-- ---------------------------------------------------------------------------
create or replace function public.award_points(
  p_profile uuid, p_points int, p_reason text, p_source uuid, p_at timestamptz default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid;
  v_rows int;
  v_after bigint;
  v_label text;
begin
  if p_points is null or p_points <= 0 or not public.is_current_student(p_profile) then
    return;
  end if;
  select school_id into v_school from public.profiles where id = p_profile;
  insert into public.points_ledger (school_id, profile_id, points, reason, source_id, created_at, kind)
  values (v_school, p_profile, p_points, p_reason, p_source, coalesce(p_at, now()), 'earn')
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return; -- the same action never earns twice
  end if;

  -- A quiet notification for rewards that do not already announce themselves.
  if p_points >= 3 and p_reason <> all (array['daily_login', 'achievement', 'library_resource', 'challenge', 'challenge_rank', 'volunteer',
                                               'competition_team', 'club_achievement', 'adjustment', 'reversal'])
     and p_reason not like 'streak\_%' then
    select label into v_label from public.point_rule_defaults where reason = p_reason;
    perform public.notify(p_profile, 'points', '🐶 You earned ' || p_points || ' Loop Points!', coalesce(v_label, ''), '/points');
  end if;

  -- Level up?
  select coalesce(sum(points), 0) into v_after from public.points_ledger where profile_id = p_profile;
  if public.level_for_xp(v_after) > public.level_for_xp(v_after - p_points) then
    perform public.notify(p_profile, 'level_up',
      '⭐ You reached Level ' || public.level_for_xp(v_after) || ': ' || public.level_name(public.level_for_xp(v_after)) || '!',
      'See your level and what is next.', '/points');
  end if;

  perform public.mark_active(p_profile, p_reason);
  perform public.award_badges(p_profile);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Achievements: the existing badges, now with progress, tiers and rewards
-- ---------------------------------------------------------------------------
alter table public.badges
  add column category text not null default 'general',
  add column tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold')),
  add column metric text,
  add column threshold int check (threshold > 0),
  add column points_reward int not null default 0 check (points_reward between 0 and 500),
  add column active boolean not null default true;
alter table public.profile_badges add column pinned boolean not null default false;

update public.badges set category = 'community', metric = 'clubs_joined', threshold = 1 where code = 'first_club';
update public.badges set category = 'community', metric = 'clubs_joined', threshold = 3, tier = 'silver' where code = 'clubs_3';
update public.badges set category = 'community', metric = 'rsvps', threshold = 5 where code = 'events_5';
update public.badges set category = 'community', metric = 'votes', threshold = 1 where code = 'voter';
update public.badges set category = 'activities', metric = 'challenges_done', threshold = 1 where code = 'challenge_1';
update public.badges set category = 'activities', metric = 'challenges_done', threshold = 5, tier = 'gold' where code = 'challenge_5';
update public.badges set category = 'academic', metric = 'tutoring_done', threshold = 1 where code = 'helper';
update public.badges set category = 'academic', metric = 'answers', threshold = 3 where code = 'tawjihi_helper';
update public.badges set category = 'community', metric = 'volunteer_hours', threshold = 10 where code = 'volunteer_10';
update public.badges set category = 'community', metric = 'volunteer_hours', threshold = 50, tier = 'gold' where code = 'volunteer_50';
update public.badges set category = 'points', metric = 'points_earned', threshold = 100 where code = 'points_100';
update public.badges set category = 'points', metric = 'points_earned', threshold = 500, tier = 'silver' where code = 'points_500';

insert into public.badges (code, name, emoji, description, sort, category, tier, metric, threshold, points_reward) values
  ('first_day', 'First Day', '🐾', 'Your first day on Loop', 20, 'consistency', 'bronze', 'active_days', 1, 5),
  ('on_a_roll', 'On a Roll', '🔥', 'A 7-day streak', 21, 'consistency', 'bronze', 'best_streak', 7, 10),
  ('consistency_star', 'Consistency Star', '🌟', 'A 30-day streak', 22, 'consistency', 'silver', 'best_streak', 30, 25),
  ('dedicated', 'Dedicated', '💎', 'A 100-day streak', 23, 'consistency', 'gold', 'best_streak', 100, 50),
  ('bookworm', 'Bookworm', '📖', 'Saved 20 study resources', 30, 'academic', 'bronze', 'resources_saved', 20, 10),
  ('knowledge_sharer', 'Knowledge Sharer', '📚', '5 of your study resources were approved', 31, 'academic', 'silver', 'resources_approved', 5, 25),
  ('trusted_reviewer', 'Trusted Reviewer', '✍️', 'Wrote 10 resource reviews', 32, 'academic', 'silver', 'reviews_written', 10, 20),
  ('young_tutor', 'Young Tutor', '🧑‍🏫', 'Finished 10 tutoring sessions', 33, 'academic', 'gold', 'tutoring_done', 10, 40),
  ('voice_of_pbs', 'Voice of PBS', '🗳️', 'Voted in 10 polls', 40, 'community', 'silver', 'polls_voted', 10, 20),
  ('community_hero', 'Community Hero', '💚', '10 verified volunteering activities', 41, 'community', 'gold', 'volunteer_done', 10, 40),
  ('idea_machine', 'Idea Machine', '💡', '3 of your ideas were taken forward', 42, 'community', 'silver', 'ideas_approved', 3, 25),
  ('student_leader', 'Student Leader', '🎖️', 'An approved class representative', 50, 'leadership', 'silver', 'is_class_rep', 1, 25),
  ('club_leader_badge', 'Club Leader', '🧭', 'An approved club leader', 51, 'leadership', 'silver', 'is_club_leader', 1, 25),
  ('loop_explorer', 'Loop Explorer', '🗺️', 'Took part in 5 different parts of Loop', 60, 'exploration', 'silver', 'features_used', 5, 25);

create function public.achievement_metric(p_profile uuid, p_metric text) returns numeric
language plpgsql stable security definer set search_path = '' as $$
begin
  return case p_metric
    when 'clubs_joined' then (select count(*) from public.club_members where profile_id = p_profile)
    when 'rsvps' then (select count(*) from public.event_rsvps where profile_id = p_profile)
    when 'votes' then (select count(*) from public.poll_votes where profile_id = p_profile) + (select count(*) from public.election_votes where voter_id = p_profile)
    when 'polls_voted' then (select count(*) from public.poll_votes where profile_id = p_profile)
    when 'challenges_done' then (select count(*) from public.challenge_submissions where profile_id = p_profile and status = 'approved')
    when 'tutoring_done' then (select count(*) from public.tutoring_requests where tutor_id = p_profile and status = 'completed')
    when 'answers' then (select count(*) from public.tawjihi_answers where author_id = p_profile and status = 'visible')
    when 'volunteer_hours' then (select coalesce(sum(hours), 0) from public.volunteer_entries where profile_id = p_profile and status = 'approved')
    when 'volunteer_done' then (select count(*) from public.volunteer_entries where profile_id = p_profile and status = 'approved')
    when 'points_earned' then (select coalesce(sum(points), 0) from public.points_ledger where profile_id = p_profile and points > 0)
    when 'active_days' then (select count(*) from public.login_days where profile_id = p_profile)
    when 'best_streak' then greatest(coalesce((select longest_streak from public.student_stats where profile_id = p_profile), 0), public.streak_now(p_profile))
    when 'resources_saved' then (select count(*) from public.library_saves where profile_id = p_profile)
    when 'resources_approved' then (select count(*) from public.library_resources where submitter_id = p_profile and source = 'community' and published_at is not null and deleted_at is null)
    when 'reviews_written' then (select count(*) from public.library_ratings where profile_id = p_profile and review is not null)
    when 'ideas_approved' then (select count(*) from public.suggestions where author_id = p_profile and status in ('planned', 'done'))
    when 'is_class_rep' then (select count(*) from public.leadership_roles where profile_id = p_profile and kind = 'class_rep')
    when 'is_club_leader' then (select count(*) from public.leadership_roles where profile_id = p_profile and kind = 'club_leader')
    when 'features_used' then
        (exists (select 1 from public.posts where author_id = p_profile))::int
      + (exists (select 1 from public.event_rsvps where profile_id = p_profile))::int
      + (exists (select 1 from public.poll_votes where profile_id = p_profile))::int
      + (exists (select 1 from public.club_members where profile_id = p_profile))::int
      + (exists (select 1 from public.library_saves where profile_id = p_profile))::int
      + (exists (select 1 from public.challenge_submissions where profile_id = p_profile))::int
      + (exists (select 1 from public.volunteer_entries where profile_id = p_profile))::int
      + (exists (select 1 from public.suggestions where author_id = p_profile))::int
      + (exists (select 1 from public.tawjihi_answers where author_id = p_profile))::int
      + (exists (select 1 from public.listings where seller_id = p_profile))::int
    else 0
  end;
end;
$$;

-- Unlocks everything the student now qualifies for. Safe to call any time; each badge is given once.
create or replace function public.award_badges(p_profile uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid;
  b record;
begin
  select school_id into v_school from public.profiles where id = p_profile;
  for b in
    select code, name, emoji, points_reward, metric, threshold from public.badges
    where active and metric is not null
      and not exists (select 1 from public.profile_badges pb where pb.profile_id = p_profile and pb.badge_code = badges.code)
  loop
    if public.achievement_metric(p_profile, b.metric) >= b.threshold then
      insert into public.profile_badges (profile_id, badge_code, school_id) values (p_profile, b.code, v_school) on conflict do nothing;
      if found then
        perform public.notify(p_profile, 'badge', '🏆 New achievement unlocked: ' || b.name,
          case when b.points_reward > 0 then '+' || b.points_reward || ' Loop Points. ' else '' end || 'See all your achievements.', '/points');
        if b.points_reward > 0 then
          perform public.award_points(p_profile, b.points_reward, 'achievement', md5('achievement:' || b.code)::uuid);
        end if;
      end if;
    end if;
  end loop;
end;
$$;

create function public.my_achievements() returns table (
  code text, name text, emoji text, description text, category text, tier text, threshold int, points_reward int,
  progress numeric, unlocked boolean, earned_at timestamptz, pinned boolean
)
language sql stable security definer set search_path = '' as $$
  select b.code, b.name, b.emoji, b.description, b.category, b.tier, b.threshold, b.points_reward,
         least(public.achievement_metric(auth.uid(), b.metric), b.threshold::numeric),
         pb.profile_id is not null, pb.earned_at, coalesce(pb.pinned, false)
  from public.badges b
  left join public.profile_badges pb on pb.badge_code = b.code and pb.profile_id = auth.uid()
  where b.active and b.metric is not null
  order by (pb.profile_id is null), b.sort
$$;

-- Students choose which earned badges everyone can see on their profile (up to 6).
create function public.set_pinned_badges(p_codes text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active() then raise exception 'Not signed in'; end if;
  if coalesce(array_length(p_codes, 1), 0) > 6 then raise exception 'Show up to 6 badges on your profile.'; end if;
  update public.profile_badges set pinned = (badge_code = any (coalesce(p_codes, '{}'))) where profile_id = auth.uid();
end;
$$;

-- What anyone at the school may see about a student: level and the badges they chose to show.
create function public.profile_public_rewards(p_profile uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v_xp bigint;
begin
  if not public.is_reader() or not exists (select 1 from public.profiles where id = p_profile and school_id = public.my_school_id()) then
    return null;
  end if;
  select coalesce(sum(points), 0) into v_xp from public.points_ledger where profile_id = p_profile;
  return json_build_object(
    'level', public.level_for_xp(v_xp), 'level_name', public.level_name(public.level_for_xp(v_xp)),
    'badges', coalesce((select json_agg(json_build_object('code', b.code, 'name', b.name, 'emoji', b.emoji, 'tier', b.tier) order by b.sort)
                        from public.profile_badges pb join public.badges b on b.code = pb.badge_code
                        where pb.profile_id = p_profile and pb.pinned), '[]'::json));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. My points: the numbers on one screen
-- ---------------------------------------------------------------------------
create or replace function public.my_points() returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v_xp bigint;
  v_spent bigint;
  v_lifetime bigint;
  v_level int;
begin
  select coalesce(sum(points), 0), coalesce(sum(points) filter (where points > 0), 0) into v_xp, v_lifetime
  from public.points_ledger where profile_id = auth.uid();
  select coalesce(sum(cost), 0) into v_spent from public.reward_redemptions where profile_id = auth.uid() and status <> 'cancelled';
  v_level := public.level_for_xp(v_xp);
  return json_build_object(
    'xp', v_xp, 'spent', v_spent, 'balance', v_xp - v_spent, 'lifetime', v_lifetime, 'level', v_level, 'level_name', public.level_name(v_level),
    'level_start', public.xp_for_level(v_level), 'next_level', public.xp_for_level(v_level + 1),
    'badges', (select count(*) from public.profile_badges where profile_id = auth.uid()),
    'badges_total', (select count(*) from public.badges where active and metric is not null));
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. More ways to earn (only where Loop can verify the activity)
-- ---------------------------------------------------------------------------
-- Profile complete: finished setup, wrote a short bio and chose 3 interests. Once.
create function public.profile_check_complete(p_profile uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = p_profile;
  if me.id is null or me.onboarded_at is null or char_length(btrim(me.bio)) < 10 then return; end if;
  if (select count(*) from public.profile_interests where profile_id = p_profile) < 3 then return; end if;
  perform public.award_points(p_profile, public.rule_points(me.school_id, 'profile_complete'), 'profile_complete', md5('profile_complete')::uuid);
end;
$$;
create function public.profiles_after_complete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.profile_check_complete(new.id);
  return new;
end;
$$;
create trigger profile_complete after update of bio, onboarded_at on public.profiles
  for each row when (new.onboarded_at is not null) execute function public.profiles_after_complete();
create function public.interests_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.profile_check_complete(new.profile_id);
  return new;
end;
$$;
create trigger profile_complete after insert on public.profile_interests
  for each row execute function public.interests_after_insert();

-- Study resources: saving (once per resource) and reviewing (once per resource, the same for every star rating).
create or replace function public.library_save(p_resource uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active() then raise exception 'Sign in to save.'; end if;
  if p_on then
    if not exists (select 1 from public.library_resources where id = p_resource and school_id = public.my_school_id()
                   and published_at is not null and visibility = 'visible' and deleted_at is null) then
      raise exception 'Resource not found.';
    end if;
    perform public.check_rate('library_save', 100, 3600);
    insert into public.library_saves (profile_id, resource_id) values (auth.uid(), p_resource) on conflict do nothing;
    -- Saving and unsaving again never earns twice: the reward is keyed to the resource.
    perform public.award_points(auth.uid(), public.points_for(auth.uid(), 'resource_save'), 'resource_save', p_resource);
    perform public.award_badges(auth.uid());
  else
    delete from public.library_saves where profile_id = auth.uid() and resource_id = p_resource;
  end if;
end;
$$;

create or replace function public.library_rate(p_resource uuid, p_stars int, p_review text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  r public.library_resources;
  v_review text := nullif(left(btrim(coalesce(p_review, '')), 1000), '');
begin
  if not public.is_active() then raise exception 'Sign in to rate.'; end if;
  select * into r from public.library_resources
  where id = p_resource and school_id = public.my_school_id() and published_at is not null and visibility = 'visible' and deleted_at is null;
  if r.id is null then raise exception 'Resource not found.'; end if;
  if r.submitter_id = v_me then raise exception 'You cannot rate your own resource.'; end if;
  if p_stars is null then
    delete from public.library_ratings where resource_id = r.id and profile_id = v_me;
  else
    if p_stars not between 1 and 5 then raise exception 'Choose 1 to 5 stars.'; end if;
    if v_review is not null then perform public.reject_blocked(r.school_id, v_review); end if;
    perform public.check_rate('library_rate', 30, 3600);
    insert into public.library_ratings (resource_id, profile_id, school_id, stars, review)
    values (r.id, v_me, r.school_id, p_stars, v_review)
    on conflict (resource_id, profile_id) do update set stars = excluded.stars, review = excluded.review, updated_at = now();
    -- A written review earns the same whether it is 1 star or 5.
    if v_review is not null and char_length(v_review) >= 10 then
      perform public.award_points(v_me, public.points_for(v_me, 'resource_review'), 'resource_review', r.id);
    end if;
  end if;
  perform public.library_refresh_rating(r.id);
  perform public.award_badges(v_me);
end;
$$;

-- Shared resources use the same rule table as everything else.
create or replace function public.library_points() returns int
language sql stable security definer set search_path = '' as $$
  select public.rule_points(public.my_school_id(), 'library_resource')
$$;
create or replace function public.library_set_points(p_points int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_points() then raise exception 'Only admins and school staff can change this.'; end if;
  if p_points is null or p_points not between 0 and 200 then raise exception 'Choose 0 to 200 points.'; end if;
  insert into public.point_rules (school_id, reason, points, enabled, updated_by)
  values (public.my_school_id(), 'library_resource', p_points, true, auth.uid())
  on conflict (school_id, reason) do update set points = excluded.points, updated_by = excluded.updated_by, updated_at = now();
  perform public.library_note(public.my_school_id(), null, 'points_changed', p_points::text);
end;
$$;

-- Tutors: applying (once ever) and being approved (once ever).
create function public.tutor_points_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    perform public.award_points(new.profile_id, public.rule_points(new.school_id, 'tutor_apply'), 'tutor_apply', new.profile_id);
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    perform public.award_points(new.profile_id, public.rule_points(new.school_id, 'tutor_approved'), 'tutor_approved', new.profile_id);
  end if;
  return new;
end;
$$;
create trigger tutor_points after insert or update of status on public.tutor_applications
  for each row execute function public.tutor_points_trigger();

-- Ideas: when the school plans one, and when it is carried out.
create function public.idea_points_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'planned' and old.status is distinct from 'planned' then
    perform public.award_points(new.author_id, public.rule_points(new.school_id, 'idea_planned'), 'idea_planned', new.id);
  end if;
  if new.status = 'done' and old.status is distinct from 'done' then
    perform public.award_points(new.author_id, public.rule_points(new.school_id, 'idea_done'), 'idea_done', new.id);
  end if;
  return new;
end;
$$;
create trigger idea_points after update of status on public.suggestions
  for each row execute function public.idea_points_trigger();

-- Club leaders: when the role is given.
create function public.leader_points_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'club_leader' then
    perform public.award_points(new.profile_id, public.rule_points(new.school_id, 'club_leader'), 'club_leader', new.id);
  end if;
  perform public.award_badges(new.profile_id);
  return new;
end;
$$;
create trigger leader_points after insert on public.leadership_roles
  for each row execute function public.leader_points_trigger();

-- Volunteering: a bonus for every 5 verified activities (volunteer points are only given after approval).
create function public.volunteer_bonus_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if new.reason = 'volunteer' and new.kind = 'earn' then
    select count(*) into n from public.points_ledger where profile_id = new.profile_id and reason = 'volunteer' and kind = 'earn';
    if n % 5 = 0 then
      perform public.award_points(new.profile_id, public.rule_points(new.school_id, 'volunteer_5'), 'volunteer_5', md5('volunteer5:' || n)::uuid);
    end if;
  end if;
  return null;
end;
$$;
create trigger volunteer_bonus after insert on public.points_ledger
  for each row execute function public.volunteer_bonus_trigger();

-- ---------------------------------------------------------------------------
-- 9. Administration: adjustments, reversals, achievement settings, statistics
-- ---------------------------------------------------------------------------
create function public.admin_adjust_points(p_profile uuid, p_points int, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
  t public.profiles;
begin
  if not public.is_admin() then raise exception 'Only admins can change a balance by hand.'; end if;
  if char_length(v_reason) < 5 then raise exception 'Write the reason (at least 5 characters). It is kept in the history.'; end if;
  if p_points is null or p_points = 0 or abs(p_points) > 1000 then raise exception 'Choose an amount between 1 and 1000 (use a minus to take points away).'; end if;
  select * into t from public.profiles where id = p_profile and school_id = public.my_school_id();
  if t.id is null or not public.is_current_student(t.id) then raise exception 'Only current students collect points.'; end if;
  if t.id = auth.uid() then raise exception 'You cannot change your own balance.'; end if;
  perform public.reject_blocked(t.school_id, v_reason);
  perform public.check_rate('adjust_points', 60, 3600);
  insert into public.points_ledger (school_id, profile_id, points, reason, source_id, kind, note, created_by)
  values (t.school_id, t.id, p_points, 'adjustment', gen_random_uuid(), 'adjust', v_reason, auth.uid());
  perform public.log_action(t.school_id, 'adjust_points', 'profile', t.id, p_points || ' · ' || v_reason);
  perform public.notify(t.id, 'points', case when p_points > 0 then '🐶 You received ' || p_points || ' Loop Points' else 'Your Loop Points were adjusted (' || p_points || ')' end,
    v_reason, '/points');
  perform public.award_badges(t.id);
end;
$$;

create function public.admin_reverse_entry(p_entry bigint, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.points_ledger;
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
begin
  if not public.is_admin() then raise exception 'Only admins can reverse a reward.'; end if;
  if char_length(v_reason) < 5 then raise exception 'Write the reason (at least 5 characters). It is kept in the history.'; end if;
  select * into e from public.points_ledger where id = p_entry and school_id = public.my_school_id();
  if e.id is null then raise exception 'Entry not found.'; end if;
  if e.kind = 'reversal' then raise exception 'A reversal cannot be reversed.'; end if;
  if exists (select 1 from public.points_ledger where reverses_id = e.id) then raise exception 'This entry was already reversed.'; end if;
  -- The original stays. A new row of the opposite sign is added next to it.
  insert into public.points_ledger (school_id, profile_id, points, reason, source_id, kind, note, created_by, reverses_id)
  values (e.school_id, e.profile_id, -e.points, 'reversal', md5('reversal:' || e.id)::uuid, 'reversal', v_reason, auth.uid(), e.id);
  perform public.log_action(e.school_id, 'reverse_points', 'profile', e.profile_id, 'entry ' || e.id || ' · ' || v_reason);
  perform public.notify(e.profile_id, 'points', 'A reward was corrected', v_reason, '/points');
end;
$$;

create function public.admin_set_achievement(p_code text, p_points int, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_points() then raise exception 'Only admins and school staff can change achievements.'; end if;
  if p_points is null or p_points not between 0 and 500 then raise exception 'Choose 0 to 500 points.'; end if;
  update public.badges set points_reward = p_points, active = coalesce(p_active, active) where code = p_code;
  if not found then raise exception 'Achievement not found.'; end if;
  perform public.log_action(public.my_school_id(), 'set_achievement', 'school', public.my_school_id(), p_code || ' · ' || p_points || ' · ' || coalesce(p_active::text, ''));
end;
$$;

create function public.staff_points_summary(p_profile uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v_xp bigint;
  v_spent bigint;
begin
  if not public.can_manage_points() or not exists (select 1 from public.profiles where id = p_profile and school_id = public.my_school_id()) then
    return null;
  end if;
  select coalesce(sum(points), 0) into v_xp from public.points_ledger where profile_id = p_profile;
  select coalesce(sum(cost), 0) into v_spent from public.reward_redemptions where profile_id = p_profile and status <> 'cancelled';
  return json_build_object('xp', v_xp, 'spent', v_spent, 'balance', v_xp - v_spent, 'level', public.level_for_xp(v_xp), 'level_name', public.level_name(public.level_for_xp(v_xp)),
    'streak', public.streak_now(p_profile), 'longest', coalesce((select longest_streak from public.student_stats where profile_id = p_profile), 0));
end;
$$;

create function public.reward_stats() returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
begin
  if not public.can_manage_points() then return null; end if;
  return json_build_object(
    'points_7d', (select coalesce(sum(points), 0) from public.points_ledger where school_id = v_school and points > 0 and created_at > now() - interval '7 days'),
    'points_30d', (select coalesce(sum(points), 0) from public.points_ledger where school_id = v_school and points > 0 and created_at > now() - interval '30 days'),
    'earners_7d', (select count(distinct profile_id) from public.points_ledger where school_id = v_school and points > 0 and created_at > now() - interval '7 days'),
    'spent_30d', (select coalesce(sum(cost), 0) from public.reward_redemptions where school_id = v_school and status <> 'cancelled' and created_at > now() - interval '30 days'),
    'adjustments_30d', (select count(*) from public.points_ledger where school_id = v_school and kind <> 'earn' and created_at > now() - interval '30 days'),
    'achievements_30d', (select count(*) from public.profile_badges where school_id = v_school and earned_at > now() - interval '30 days'),
    'top_reasons', coalesce((select json_agg(x) from (
        select reason, sum(points)::int as points, count(*)::int as n from public.points_ledger
        where school_id = v_school and points > 0 and created_at > now() - interval '30 days' group by reason order by sum(points) desc limit 8) x), '[]'::json));
end;
$$;

-- Students who earned an unusual amount in the last day. A prompt to look, not proof of anything.
create function public.suspicious_rewards() returns table (profile_id uuid, full_name text, points_24h int, entries_24h int, reasons text)
language sql stable security definer set search_path = '' as $$
  select l.profile_id, p.full_name, sum(l.points)::int, count(*)::int, string_agg(distinct l.reason, ', ')
  from public.points_ledger l join public.profiles p on p.id = l.profile_id
  where public.can_manage_points() and l.school_id = public.my_school_id() and l.kind = 'earn' and l.created_at > now() - interval '24 hours'
  group by l.profile_id, p.full_name
  having sum(l.points) >= 80 or count(*) >= 25
  order by sum(l.points) desc
  limit 20
$$;

-- ---------------------------------------------------------------------------
-- 10. Who can call what
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array['rule_points(uuid, text)', 'streak_now(uuid)', 'refresh_streak(uuid)', 'mark_active(uuid, text)', 'achievement_metric(uuid, text)',
                           'profile_check_complete(uuid)', 'profiles_after_complete()', 'interests_after_insert()', 'tutor_points_trigger()',
                           'idea_points_trigger()', 'leader_points_trigger()', 'volunteer_bonus_trigger()'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['record_login()', 'my_streak()', 'my_achievements()', 'set_pinned_badges(text[])', 'profile_public_rewards(uuid)',
                           'admin_adjust_points(uuid, int, text)', 'admin_reverse_entry(bigint, text)', 'admin_set_achievement(text, int, boolean)',
                           'staff_points_summary(uuid)', 'reward_stats()', 'suspicious_rewards()', 'level_name(int)', 'school_today()'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

-- Existing students get the achievements they already qualify for.
do $$
declare
  p record;
begin
  for p in select id from public.profiles where deactivated_at is null and onboarded_at is not null loop
    perform public.award_badges(p.id);
  end loop;
end $$;
