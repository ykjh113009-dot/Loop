-- Rewards v2 tests: streaks, ledger, achievements, adjustments, reversals. Runs inside one transaction that is rolled back. Run with:  npm run db:test
\set ON_ERROR_STOP on
begin;

create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.login(p_user uuid, p_aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true),
    set_config('role', 'authenticated', true);
$$;
create function tests.ok(p_pass boolean, p_name text) returns void language plpgsql as $$
begin
  if p_pass is not true then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
create function tests.refused(p_sql text, p_like text, p_name text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_like || '%' then
      raise notice 'ok - %', p_name;
      return;
    end if;
    raise exception 'FAILED: % (wrong error: %)', p_name, sqlerrm;
  end;
  raise exception 'FAILED: % (it was allowed)', p_name;
end $$;
create function tests.notes(p_profile uuid, p_kind text) returns bigint language sql security definer as $$
  select count(*) from public.notifications where recipient_id = p_profile and kind = p_kind $$;


grant execute on all functions in schema tests to authenticated, anon;
\set rania '''00000000-0000-0000-0000-0000000000a1'''
\set maya  '''00000000-0000-0000-0000-0000000000a5'''
\set yousef '''00000000-0000-0000-0000-0000000000a4'''
delete from public.rate_events;
delete from public.points_ledger where profile_id in (:maya, :yousef);
delete from public.profile_badges where profile_id in (:maya, :yousef);
delete from public.login_days where profile_id in (:maya, :yousef);
delete from public.student_stats where profile_id in (:maya, :yousef);
delete from public.streak_milestones where profile_id in (:maya, :yousef);
delete from public.notifications where recipient_id in (:maya, :yousef);
delete from public.poll_votes where profile_id in (:maya, :yousef);
delete from public.library_saves where profile_id in (:maya, :yousef);

-- 1. Daily login: once per day
select tests.login(:maya);
select public.record_login();
select public.record_login();
select tests.ok((select count(*) from public.points_ledger where profile_id = :maya and reason = 'daily_login') = 1, 'daily login pays once a day, however often you call it');
select tests.ok((select points from public.points_ledger where profile_id = :maya and reason = 'daily_login') = 5, 'daily login is worth 5');
select tests.ok((select (public.my_streak() ->> 'current')::int) = 0, 'signing in alone does not start a streak');

-- 2. An eligible activity starts the streak
select tests.ok((select count(*) from public.login_days where profile_id = :maya and active) = 0, 'no active day yet');
reset role;
insert into public.library_resources (school_id, source, submitter_id, subject_id, title, description, type, link_url, content_key, published_at, points_awarded)
select s.school_id, 'official', :yousef, s.id, 'Rewards test resource', 'x', 'website', 'https://example.org/r1', 'rk1', now(), true from public.study_categories s limit 1;
select tests.login(:maya);
select public.library_save((select id from public.library_resources where title = 'Rewards test resource'), true);
select tests.ok((select count(*) from public.points_ledger where profile_id = :maya and reason = 'resource_save') = 1, 'saving a resource earns once');
select public.library_save((select id from public.library_resources where title = 'Rewards test resource'), false);
select public.library_save((select id from public.library_resources where title = 'Rewards test resource'), true);
select tests.ok((select count(*) from public.points_ledger where profile_id = :maya and reason = 'resource_save') = 1, 'saving, unsaving and saving again earns nothing more');
select tests.ok((select (public.my_streak() ->> 'current')::int) = 1, 'an eligible activity starts the streak');

-- 3. Streak milestones: once ever
reset role;
insert into public.login_days (profile_id, day, active) select :maya, public.school_today() - g, true from generate_series(1, 6) g on conflict do nothing;
select public.refresh_streak(:maya);
select tests.ok((select current_streak from public.student_stats where profile_id = :maya) = 7, 'seven active days in a row make a 7-day streak');
select tests.ok((select count(*) from public.points_ledger where profile_id = :maya and reason = 'streak_7') = 1, 'the 7-day milestone paid 25');
select public.refresh_streak(:maya);
select tests.ok((select count(*) from public.points_ledger where profile_id = :maya and reason = 'streak_7') = 1, 'the same milestone never pays twice');
delete from public.login_days where profile_id = :maya and day = public.school_today() - 3;
select public.refresh_streak(:maya);
select tests.ok((select current_streak from public.student_stats where profile_id = :maya) = 3, 'a missed day resets the current streak');
select tests.ok((select longest_streak from public.student_stats where profile_id = :maya) = 7, 'the longest streak is kept');

-- 4. Achievements unlock automatically, once
select tests.ok(exists (select 1 from public.profile_badges where profile_id = :maya and badge_code = 'first_day'), 'First Day unlocks');
select tests.ok(exists (select 1 from public.profile_badges where profile_id = :maya and badge_code = 'on_a_roll'), 'On a Roll unlocks at a 7-day streak');
select tests.ok((select count(*) from public.points_ledger where profile_id = :maya and reason = 'achievement') = (select count(*) from public.profile_badges pb join public.badges b on b.code = pb.badge_code where pb.profile_id = :maya and b.points_reward > 0), 'each achievement pays its reward once');
select tests.login(:maya);
select tests.ok((select count(*) from public.my_achievements() where unlocked) >= 2, 'students see their unlocked achievements');
select tests.ok((select progress from public.my_achievements() where code = 'bookworm') = 1, 'progress is shown for locked achievements');
select public.set_pinned_badges(array['first_day']);
select tests.ok((select (public.profile_public_rewards(:maya) -> 'badges' -> 0 ->> 'code')) = 'first_day', 'chosen badges show on the public profile');
select tests.refused($$select public.set_pinned_badges(array['a','b','c','d','e','f','g'])$$, 'up to 6', 'at most 6 badges can be shown');

-- 5. XP, balance and levels
select tests.ok(((public.my_points()) ->> 'xp')::int = (select sum(points) from public.points_ledger where profile_id = :maya), 'XP is everything earned');
select tests.ok((public.my_points() ->> 'level_name') = public.level_name((public.my_points() ->> 'level')::int) and public.level_name(1) = 'Newcomer' and public.level_name(5) = 'Community Star', 'level names come with the level');

-- 6. Students cannot touch balances
select tests.refused($$select public.admin_adjust_points('00000000-0000-0000-0000-0000000000a5', 500, 'because I want it')$$, 'only admins', 'a student cannot adjust points');
select tests.refused($$insert into public.points_ledger (school_id, profile_id, points, reason, source_id) select school_id, id, 99, 'x', gen_random_uuid() from public.profiles limit 1$$, 'permission', 'a student cannot write the ledger');
select tests.refused($$select public.award_points('00000000-0000-0000-0000-0000000000a5', 50, 'x', gen_random_uuid())$$, 'permission', 'a student cannot call the award function');
select tests.refused($$select public.admin_set_achievement('on_a_roll', 500, true)$$, 'only', 'a student cannot change achievements');
select tests.ok(public.reward_stats() is null, 'a student gets no statistics');

-- 7. Admin adjustments and reversals keep history
select tests.login(:rania);
select tests.refused($$select public.admin_adjust_points('00000000-0000-0000-0000-0000000000a5', 50, 'no')$$, 'reason', 'an adjustment needs a reason');
select public.admin_adjust_points(:maya, 50, 'Won the school quiz');
select tests.ok((select count(*) from public.points_ledger where profile_id = :maya and kind = 'adjust' and points = 50 and note = 'Won the school quiz') = 1, 'a manual award is recorded with its reason');
select public.admin_adjust_points(:maya, -20, 'Correction for a duplicate award');
select tests.ok((select count(*) from public.points_ledger where profile_id = :maya and kind = 'adjust' and points = -20) = 1, 'a deduction is recorded too');
select set_config('t.entry', (select id::text from public.points_ledger where profile_id = :maya and reason = 'daily_login'), true);
select public.admin_reverse_entry(current_setting('t.entry')::bigint, 'Test of a wrong reward');
select tests.ok((select count(*) from public.points_ledger where id = current_setting('t.entry')::bigint) = 1, 'the original entry is kept after a reversal');
select tests.ok((select points from public.points_ledger where reverses_id = current_setting('t.entry')::bigint) = -5, 'the reversal is a separate opposite entry');
select tests.refused($$select public.admin_reverse_entry(current_setting('t.entry')::bigint, 'Doing it again')$$, 'already reversed', 'an entry can only be reversed once');
select tests.refused($$select public.admin_adjust_points('00000000-0000-0000-0000-0000000000a1', 10, 'my own points')$$, 'own balance', 'an admin cannot change their own balance');
select tests.ok(public.reward_stats() is not null, 'admins get statistics');

-- 8. Spending does not lower XP
select tests.login(:maya);
select tests.ok(((public.my_points()) ->> 'xp')::int = (select sum(points) from public.points_ledger where profile_id = :maya), 'XP still equals what was earned after adjustments');

-- 9. Admin settings
select tests.login(:rania);
select public.admin_set_achievement('on_a_roll', 12, true);
select tests.ok((select points_reward from public.badges where code = 'on_a_roll') = 12, 'admins can change an achievement reward');
insert into public.point_rules (school_id, reason, points, enabled, updated_by) select school_id, 'daily_login', 8, true, :rania from public.profiles where id = :rania on conflict (school_id, reason) do update set points = 8;
select tests.login(:yousef);
select public.record_login();
select tests.ok((select points from public.points_ledger where profile_id = :yousef and reason = 'daily_login') = 8, 'a changed rule applies to the next reward');
rollback;
\echo done
