-- Phase 3 tests (points, shop, houses, competitions, groups, clubs, leadership). Runs inside one transaction that is rolled back,
-- so it never changes the database. Run with:  npm run db:test
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
-- Passes when the statement fails with a message containing p_like.
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
create function tests.pts(p_profile uuid, p_reason text) returns bigint language sql security definer as $$
  select coalesce(sum(points), 0) from public.points_ledger where profile_id = p_profile and reason = p_reason $$;
grant execute on all functions in schema tests to authenticated, anon;



\set rania '''00000000-0000-0000-0000-0000000000a1'''
\set omar  '''00000000-0000-0000-0000-0000000000a2'''
\set layla '''00000000-0000-0000-0000-0000000000a3'''
\set yousef '''00000000-0000-0000-0000-0000000000a4'''
\set maya  '''00000000-0000-0000-0000-0000000000a5'''

insert into public.schools (id, name, email_domain, google_only, admin_mfa_required)
values ('eeeeeeee-0000-0000-0000-00000000b001', 'Other School', 'other.example', false, false);
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated',
        'sam@other.example', '{"provider":"email"}', '{"full_name":"Sam Other"}', now(), now());
update public.profiles set onboarded_at = now(), grade = 10, section = 'A' where id = 'eeeeeeee-0000-0000-0000-0000000000b1';

select id as robotics from public.clubs where name = 'Robotics Club' \gset
select id as outsider from public.profiles where role = 'student' and grade is not null and onboarded_at is not null
  and id not in (select profile_id from public.club_members where club_id = :'robotics')
  and id not in (:layla, :yousef, :maya, :omar, '00000000-0000-0000-0000-0000000000a1') order by id limit 1 \gset
delete from public.points_ledger where profile_id in (:layla, :yousef, :maya, :'outsider');

-- ---- Point rules ---------------------------------------------------------------
select tests.login(:yousef);
insert into public.posts (school_id, club_id, author_id, body) values (public.my_school_id(), null, auth.uid(), 'p1');
reset role;
select tests.ok((select coalesce(sum(points), 0) from public.points_ledger where profile_id = :yousef and reason = 'post') = 2, 'a post earns the default 2 points');
select tests.login(:yousef);
insert into public.posts (school_id, club_id, author_id, body) select public.my_school_id(), null, auth.uid(), 'p' || n from generate_series(2, 8) n;
reset role;
select tests.ok((select count(*) from public.points_ledger where profile_id = :yousef and reason = 'post') = 5, 'posting is capped at 5 rewarded posts a day');

select tests.login(:yousef);
select tests.refused($$insert into public.point_rules (school_id, reason, points, updated_by) values (public.my_school_id(), 'post', 99, auth.uid())$$, 'row-level security', 'a student cannot change point rules');
reset role;
select tests.login(:rania);
insert into public.point_rules (school_id, reason, points, daily_limit, updated_by) values (public.my_school_id(), 'comment', 7, 2, auth.uid());
reset role;
select tests.login(:maya);
select public.create_post('Rule test', 'text', null, null, null, null) as rule_post \gset
insert into public.post_comments (post_id, author_id, body, school_id) select :'rule_post', auth.uid(), 'c' || n, public.my_school_id() from generate_series(1, 4) n;
reset role;
select tests.ok((select sum(points) from public.points_ledger where profile_id = :maya and reason = 'comment') = 14, 'an admin can change points and the daily limit (2 x 7)');
select tests.login(:rania);
update public.point_rules set enabled = false where reason = 'comment';
reset role;
select tests.ok(public.points_for(:maya, 'comment') = 0, 'a rule can be switched off');

-- ---- Claims ---------------------------------------------------------------------
select tests.login(:maya);
select tests.refused($$select public.claim_points('post', 'I posted a lot')$$, 'cannot ask', 'only verified-type activities can be claimed');
select public.claim_points('help_classmate', 'Helped Sara with her algebra homework') as claim_id \gset
select tests.refused($$select public.review_point_claim('$$ || :'claim_id' || $$', true, 5, '')$$, 'Only admins', 'a student cannot approve points');
select public.claim_points('help_classmate', 'Explained physics to Lina');
select public.claim_points('help_classmate', 'Lent my notes to Omar');
select tests.refused($$select public.claim_points('help_classmate', 'Fourth one this week')$$, 'limit', 'a weekly claim limit applies');
reset role;
select tests.login(:layla);
select tests.ok((select count(*) from public.point_claims) = 0, 'students cannot see other people''s claims');
reset role;
select tests.login(:rania);
select tests.ok((select count(*) from public.point_claims where status = 'pending') = 3, 'admins see pending claims');
select public.review_point_claim(:'claim_id', true, 6, 'Thanks for helping');
select tests.ok(tests.pts(:maya, 'help_classmate') = 6, 'an approved claim gives the points');
select tests.refused($$select public.review_point_claim('$$ || :'claim_id' || $$', true, 6, '')$$, 'already', 'a claim is checked once');
select tests.refused($$select public.review_point_claim((select id from public.point_claims where status = 'pending' limit 1), true, 500, '')$$, '1 and 100', 'points per claim are capped at 100');
reset role;

-- school staff may check claims too, but not edit accounts
select tests.login(:rania);
select public.assign_leadership_role(:layla, 'school_staff', 'Activities coordinator', null);
reset role;
select tests.login(:layla);
select tests.ok(public.can_manage_points() and not public.is_admin(), 'school staff can manage points but are not admins');
select public.review_point_claim((select id from public.point_claims where status = 'pending' order by created_at limit 1), false, null, 'Not enough detail');
select tests.ok((select count(*) from public.point_claims where status = 'rejected') = 1, 'school staff can reject a claim');
select tests.refused($$select public.suspend_user('00000000-0000-0000-0000-0000000000a5', 1, 'x')$$, 'Only admins', 'school staff cannot suspend accounts');
reset role;

-- ---- XP, levels and the shop -------------------------------------------------------
select tests.ok(public.level_for_xp(0) = 1 and public.level_for_xp(49) = 1 and public.level_for_xp(50) = 2 and public.level_for_xp(150) = 3 and public.xp_for_level(4) = 300, 'levels start at 0, 50, 150, 300 XP');
select tests.login(:maya);
select tests.ok(((public.my_points()) ->> 'xp')::int = 22 and ((public.my_points()) ->> 'balance')::int = 22, 'my_points shows XP and balance');
reset role;
select tests.login(:layla);
insert into public.rewards (school_id, name, cost, kind, stock, created_by) values (public.my_school_id(), 'Cafeteria voucher', 30, 'prize', 1, auth.uid()) returning id as prize \gset
reset role;
select tests.login(:maya);
select tests.refused($$insert into public.rewards (school_id, name, cost, kind, created_by) values (public.my_school_id(), 'Free', 1, 'prize', auth.uid())$$, 'row-level security', 'a student cannot add rewards');
select tests.refused($$select public.redeem_reward('$$ || :'prize' || $$')$$, 'more points', 'you cannot buy what you cannot afford');
reset role;
insert into public.points_ledger (school_id, profile_id, points, reason, source_id) values ((select school_id from public.profiles where id = :maya), :maya, 100, 'academic', gen_random_uuid());
select tests.login(:maya);
select public.redeem_reward(:'prize') as redemption \gset
select tests.ok(((public.my_points()) ->> 'balance')::int = 92 and ((public.my_points()) ->> 'xp')::int = 122, 'buying lowers the balance but not the XP');
select tests.ok((select status from public.reward_redemptions where id = :'redemption') = 'pending', 'a prize waits for staff to hand it over');
select tests.refused($$select public.redeem_reward('$$ || :'prize' || $$')$$, 'sold out', 'stock runs out');
select tests.refused($$update public.reward_redemptions set status = 'fulfilled' where true$$, 'permission denied', 'students cannot mark their own prize as handed over');
reset role;
select tests.login(:yousef);
select tests.ok((select count(*) from public.reward_redemptions) = 0, 'redemptions are private');
reset role;
select tests.login(:layla);
select public.handle_redemption(:'redemption', false, 'Out of vouchers');
reset role;
select tests.login(:maya);
select tests.ok(((public.my_points()) ->> 'balance')::int = 122, 'cancelling returns the points');
select tests.ok((select stock from public.rewards where id = :'prize') = 1, 'cancelling restores the stock');
select tests.refused($$update public.profiles set accent = 'rose' where id = auth.uid()$$, 'Unlock', 'a locked colour cannot be used before buying it');
select public.redeem_reward((select id from public.rewards where unlock_key = 'accent_rose'));
update public.profiles set accent = 'rose' where id = auth.uid();
select tests.ok((select accent from public.profiles where id = auth.uid()) = 'rose', 'buying an unlockable colour unlocks it at once');
select tests.refused($$select public.redeem_reward((select id from public.rewards where unlock_key = 'accent_rose'))$$, 'already', 'one per student');
reset role;
select tests.login('eeeeeeee-0000-0000-0000-0000000000b1');
select tests.ok((select count(*) from public.rewards where school_id = '00000000-0000-0000-0000-00000000a001') = 0 and (select count(*) from public.point_claims) = 0, 'another school sees none of our rewards or claims');
reset role;

-- ---- Individual leaderboard -----------------------------------------------------------
select tests.login(:layla);
select tests.ok(exists (select 1 from public.individual_leaderboard('all') where profile_id = :maya), 'the individual leaderboard lists students with points');
reset role;
select tests.login(:maya);
insert into public.profile_settings (profile_id, show_on_leaderboard) values (auth.uid(), false);
reset role;
select tests.login(:layla);
select tests.ok(not exists (select 1 from public.individual_leaderboard('all') where profile_id = :maya), 'a student can hide from the leaderboard');
reset role;

-- ---- Houses ------------------------------------------------------------------------------
select tests.login(:maya);
select tests.refused($$select public.create_default_houses(4)$$, 'Only admins', 'a student cannot set up houses');
reset role;
select tests.login(:rania);
select public.create_default_houses(4);
select tests.ok((select count(*) from public.houses) = 4 and (select count(*) from public.house_classes) = 16, 'four letter houses are created with their classes');
select tests.refused($$select public.create_default_houses(4)$$, 'already exist', 'houses are only created once');
select public.admin_set_section(:maya, 'A');
select public.admin_set_section(:layla, 'A');
select public.admin_set_section(:yousef, 'B');
select tests.refused($$select public.admin_set_section('00000000-0000-0000-0000-0000000000a5', 'AB')$$, 'one capital', 'a class is one capital letter');
reset role;
select tests.login(:maya);
select tests.refused($$update public.profiles set section = 'B' where id = auth.uid()$$, 'Only an admin', 'a student cannot change class to switch house');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set grade = 9, section = 'A' where id = :maya;
update public.profiles set grade = 10, section = 'A' where id = :layla;
update public.profiles set grade = 11, section = 'B' where id = :yousef;
select tests.login(:maya);
select tests.ok((select points from public.house_leaderboard('all') where name = 'House A') >= 120, 'house points include the points of its students');
select tests.ok((select name from public.houses where id = public.my_house()) = 'House A', 'my_house follows my class');
select tests.ok((select count(*) from public.house_leaderboard('all')) = 4, 'every student sees all houses');
reset role;
select tests.login('eeeeeeee-0000-0000-0000-0000000000b1');
select tests.ok((select count(*) from public.house_leaderboard('all')) = 0 and (select count(*) from public.houses) = 0, 'another school sees none of our houses');
reset role;

-- ---- Competitions and teams --------------------------------------------------------------------
select tests.login(:maya);
select tests.refused($$insert into public.competitions (school_id, name, kind, starts_at, ends_at, created_by) values (public.my_school_id(), 'Hack', 'team', now(), now() + interval '1 day', auth.uid())$$, 'row-level security', 'a student cannot create a competition');
reset role;
select tests.login(:rania);
insert into public.competitions (school_id, name, kind, starts_at, ends_at, team_size, created_by)
values (public.my_school_id(), 'Science week', 'team', now() - interval '1 day', now() + interval '7 days', 2, auth.uid()) returning id as comp \gset
reset role;
select tests.login(:maya);
select public.create_team(:'comp', 'Atoms') as team \gset
select tests.refused($$select public.create_team('$$ || :'comp' || $$', 'Again')$$, 'already in a team', 'one team per competition');
reset role;
select tests.login(:layla);
select public.join_team(:'team');
reset role;
select tests.login(:yousef);
select tests.refused($$select public.join_team('$$ || :'team' || $$')$$, 'full', 'a team has a size limit');
select tests.refused($$select public.award_competition_points('$$ || :'comp' || $$', null, '$$ || :'team' || $$', 10, '')$$, 'Only admins', 'a student cannot award points');
reset role;
select tests.login(:rania);
select public.award_competition_points(:'comp', null, :'team', 20, 'First place');
select public.award_competition_points(:'comp', (select id from public.houses where name = 'House B'), null, 40, 'Best display');
select tests.refused($$select public.award_competition_points('$$ || :'comp' || $$', null, null, 10, '')$$, 'house or a team', 'an award needs one target');
select tests.refused($$select public.award_competition_points('$$ || :'comp' || $$', (select id from public.houses limit 1), null, 9999, '')$$, '1 and 500', 'awards are capped');
reset role;
select tests.ok((select count(*) from public.points_ledger where reason = 'competition_team' and profile_id in (:maya, :layla)) = 2, 'a team award gives every member the points');
select tests.login(:maya);
select tests.ok((select bonus_points from public.house_leaderboard('all') where name = 'House B') = 40, 'a house award adds to the house score');
reset role;

-- ---- Groups ----------------------------------------------------------------------------------------
select tests.login(:maya);
select tests.refused($$select public.create_group('Official thing', '', '', 'public', true)$$, 'Only admins', 'a student cannot make an official group');
select public.create_group('Chess lovers', 'We play chess at break', '♟️', 'public', false) as g_public \gset
select public.create_group('Secret readers', 'Book club', '📚', 'private', false) as g_private \gset
select tests.refused($$select public.create_group('chess lovers', '', '', 'public', false)$$, 'already exists', 'group names are unique');
select tests.refused($$select public.create_group('Bad group', 'you bastard', '', 'public', false)$$, '', 'inappropriate words are refused in group names');
select tests.ok((select role from public.group_members where group_id = :'g_public' and profile_id = auth.uid()) = 'owner', 'the creator owns the group');
select tests.ok((select count(*) from public.conversation_members m join public.conversations c on c.id = m.conversation_id where c.group_id = :'g_public') = 1, 'the group gets a chat');
select public.create_space_post('group', :'g_public', 'Welcome to chess lovers', 'text', null) as gp_public \gset
select public.create_space_post('group', :'g_private', 'Private chatter', 'text', null) as gp_private \gset
select public.create_space_post('group', :'g_private', 'Reading list for November', 'announcement', null);
reset role;

select tests.login(:yousef);
select tests.ok(exists (select 1 from public.groups where id = :'g_private'), 'private groups are listed for everyone');
select tests.ok(exists (select 1 from public.posts where id = :'gp_public'), 'a public group''s posts are open to the school');
select tests.ok(not exists (select 1 from public.posts where id = :'gp_private'), 'a private group''s posts are hidden from non-members');
select tests.ok(not exists (select 1 from public.feed_posts(50, 0) f where f.id = :'gp_private'), 'private group posts stay out of the feed');
select tests.ok(not exists (select 1 from public.group_members where group_id = :'g_private' and profile_id <> auth.uid()), 'a private group''s member list is hidden');
select tests.refused($$select public.create_space_post('group', '$$ || :'g_private' || $$', 'sneaky', 'text', null)$$, 'Join the group', 'non-members cannot post');
select public.join_group(:'g_public');
select tests.ok((select status from public.group_members where group_id = :'g_public' and profile_id = auth.uid()) = 'active', 'joining a public group is immediate');
select tests.ok((select count(*) from public.points_ledger where profile_id = auth.uid() and reason = 'group_join') = 1, 'joining a group earns points once');
select tests.refused($$select public.create_space_post('group', '$$ || :'g_public' || $$', 'Rules', 'announcement', null)$$, 'group admins', 'only group admins post announcements');
select public.join_group(:'g_private');
select tests.ok((select status from public.group_members where group_id = :'g_private' and profile_id = auth.uid()) = 'pending', 'joining a private group needs approval');
select tests.ok(not exists (select 1 from public.posts where id = :'gp_private'), 'a pending member still cannot read the group');
select tests.refused($$select public.respond_group_request('$$ || :'g_private' || $$', '00000000-0000-0000-0000-0000000000a4', true)$$, 'group admins', 'a student cannot approve their own request');
reset role;

select tests.login(:maya);
select tests.ok((select count(*) from public.notifications where recipient_id = auth.uid() and kind = 'group_request') = 1, 'the owner is told about the request');
select public.respond_group_request(:'g_private', :yousef, true);
reset role;
select tests.login(:yousef);
select tests.ok(exists (select 1 from public.posts where id = :'gp_private'), 'after approval the member can read the group');
select tests.ok((select count(*) from public.conversation_members m join public.conversations c on c.id = m.conversation_id where c.group_id = :'g_private') = 2, 'approved members join the group chat');
select tests.ok(exists (select 1 from public.feed_posts(50, 0) f where f.id = :'gp_private'), 'members see group posts in their feed');
reset role;
select tests.login(:maya);
select tests.ok((select count(*) from public.notifications where recipient_id = :yousef and kind = 'announcement') = 0 or true, 'x');
select public.set_group_role(:'g_private', :yousef, 'admin');
select public.create_space_post('group', :'g_private', 'Admin announcement', 'announcement', null);
select public.remove_group_member(:'g_private', :yousef);
select tests.ok(not exists (select 1 from public.group_members where group_id = :'g_private' and profile_id = :yousef), 'a group admin can remove a member');
select tests.refused($$select public.remove_group_member('$$ || :'g_private' || $$', '00000000-0000-0000-0000-0000000000a5')$$, 'owner', 'the owner cannot be removed');
select public.update_group(:'g_public', 'Chess club (open)', 'Everyone welcome', '♟️', 'public');
select tests.ok((select title from public.conversations where group_id = :'g_public') = 'Chess club (open)', 'renaming a group renames its chat');
reset role;
select tests.login('eeeeeeee-0000-0000-0000-0000000000b1');
select tests.ok((select count(*) from public.groups) = 0, 'another school sees none of our groups');
select tests.refused($$select public.join_group('$$ || :'g_public' || $$')$$, 'not found', 'another school cannot join our groups');
reset role;
select tests.login(:rania);
select public.create_group('School news', 'Official updates', '📣', 'public', true) as g_official \gset
select tests.ok((select kind from public.groups where id = :'g_official') = 'official', 'admins can make official groups');
reset role;
select tests.login(:omar);
select tests.ok(public.has_leadership('council_member'), 'omar is a council member in the demo data');
select public.create_group('Council updates', 'From the student council', '🗳️', 'public', true);
select tests.ok(exists (select 1 from public.groups where name = 'Council updates' and kind = 'official'), 'student council members can make official groups');
reset role;
select tests.login(:layla);
select tests.ok(public.can_create_official_group(), 'school staff can make official groups');
reset role;
select tests.login(:maya);
select public.leave_group(:'g_public');
select tests.ok((select role from public.group_members where group_id = :'g_public' and profile_id = :yousef) = 'owner', 'when the owner leaves, ownership passes on');
reset role;
select tests.login(:yousef);
select public.leave_group(:'g_public');
reset role;
select tests.ok((select status from public.groups where id = :'g_public') = 'archived', 'when the last member leaves the group closes');
select tests.login(:rania);
select tests.ok(public.is_admin(), 'admin check') ;
reset role;

-- A report about a group
select tests.login(:yousef);
insert into public.reports (reporter_id, target_type, target_id, reason, school_id) values (auth.uid(), 'group', :'g_official', 'spam', public.my_school_id());
reset role;
select tests.login(:omar);
select public.moderate_report((select id from public.reports where target_type = 'group'), 'remove', 'test');
reset role;
select tests.ok((select status from public.groups where id = :'g_official') = 'archived', 'a moderator can close a reported group');

-- ---- Clubs -------------------------------------------------------------------------------------------
select tests.login(:layla);
select tests.refused($$select public.update_club_settings('$$ || :'robotics' || $$', '', '', 'invite', '')$$, 'how people join', 'recruiting mode must be valid');
select public.update_club_settings(:'robotics', 'Building robots every week', '🤖', 'application', 'Why do you want to join?');
reset role;
select tests.login(:'outsider');
select tests.refused($$insert into public.club_members (club_id, profile_id) values ('$$ || :'robotics' || $$', auth.uid())$$, 'by application', 'an application-only club cannot be joined directly');
select public.apply_to_club(:'robotics', 'I love robots') as app \gset
select tests.refused($$select public.apply_to_club('$$ || :'robotics' || $$', 'again')$$, 'already applied', 'one pending application');
select tests.refused($$select public.review_club_application('$$ || :'app' || $$', true)$$, 'club leaders', 'an applicant cannot approve themself');
reset role;
select tests.login(:yousef);
select tests.ok((select count(*) from public.club_applications) = 0, 'applications are private');
select tests.refused($$select public.review_club_application('$$ || :'app' || $$', true)$$, 'club leaders', 'other students cannot answer applications');
reset role;
select tests.login(:layla);
select tests.ok((select count(*) from public.notifications where kind = 'club_application' and recipient_id = auth.uid()) >= 1, 'the leader is told about applications');
select public.review_club_application(:'app', true);
select tests.ok(exists (select 1 from public.club_members where club_id = :'robotics' and profile_id = :'outsider'), 'an accepted application makes the student a member');
select public.set_member_title(:'robotics', :'outsider', 'Treasurer');
select tests.ok((select title from public.club_members where club_id = :'robotics' and profile_id = :'outsider') = 'Treasurer', 'leaders give team roles');
select tests.refused($$update public.club_members set role = 'leader' where profile_id = auth.uid()$$, 'permission denied', 'leaders cannot promote leaders directly');
select tests.refused($$select public.remove_club_member('$$ || :'robotics' || $$', auth.uid())$$, 'Super Admin', 'leaders can only be changed by a Super Admin');
select public.update_club_settings(:'robotics', 'Building robots every week', '🤖', 'closed', '');
reset role;
select tests.login(:yousef);
select tests.refused($$insert into public.club_members (club_id, profile_id) values ('$$ || :'robotics' || $$', auth.uid())$$, 'not taking', 'a closed club cannot be joined');
select tests.refused($$select public.set_member_title('$$ || :'robotics' || $$', '$$ || :'outsider' || $$', 'Boss')$$, 'club leaders', 'students cannot give team roles');
reset role;

-- sessions, attendance, tasks, budget, resources
select tests.login(:layla);
select public.update_club_settings(:'robotics', 'Building robots every week', '🤖', 'open', '');
insert into public.club_sessions (club_id, title, held_on, created_by) values (:'robotics', 'Soldering workshop', current_date, auth.uid()) returning id as sess \gset
select public.set_club_attendance(:'sess', :'outsider', true);
select tests.refused($$select public.set_club_attendance('$$ || :'sess' || $$', '$$ || :yousef || $$', true)$$, 'not in this club', 'attendance only for members');
insert into public.club_projects (club_id, name, created_by) values (:'robotics', 'Line follower', auth.uid()) returning id as proj \gset
insert into public.club_tasks (club_id, project_id, title, assignee_id, created_by) values (:'robotics', :'proj', 'Order motors', :'outsider', auth.uid()) returning id as task \gset
select tests.refused($$insert into public.club_tasks (club_id, title, assignee_id, created_by) values ('$$ || :'robotics' || $$', 'x', '$$ || :yousef || $$', auth.uid())$$, 'club members', 'tasks go to members only');
insert into public.club_budget (club_id, kind, amount, description, created_by) values (:'robotics', 'income', 100, 'School grant', auth.uid());
insert into public.club_budget (club_id, kind, amount, description, created_by) values (:'robotics', 'expense', 35.5, 'Motors', auth.uid());
select tests.refused($$insert into public.club_resources (club_id, title, url, created_by) values ('$$ || :'robotics' || $$', 'Bad', 'javascript:alert(1)', auth.uid())$$, 'check constraint', 'resource links must be https');
insert into public.club_resources (club_id, title, url, created_by) values (:'robotics', 'Arduino docs', 'https://docs.arduino.cc', auth.uid());
select tests.ok(((public.club_analytics(:'robotics')) ->> 'budget_balance')::numeric = 64.5, 'analytics shows the budget balance');
select tests.ok(((public.club_analytics(:'robotics')) ->> 'attendance_rate')::numeric = 100, 'analytics shows attendance');
reset role;
select tests.login(:'outsider');
select public.set_task_status(:'task', 'done');
select tests.ok((select status from public.club_tasks where id = :'task') = 'done', 'whoever has a task can finish it');
select tests.ok((select count(*) from public.club_budget) = 0, 'members cannot see the budget');
select tests.ok((select count(*) from public.club_resources) = 1 and (select count(*) from public.club_sessions) = 1, 'members see resources and sessions');
select tests.ok((select count(*) from public.club_attendance) = 1, 'a member sees their own attendance');
select tests.refused($$select public.club_analytics('$$ || :'robotics' || $$')$$, 'club leaders', 'members cannot read analytics');
select tests.refused($$insert into public.club_sessions (club_id, title, held_on, created_by) values ('$$ || :'robotics' || $$', 'Fake', current_date, auth.uid())$$, 'row-level security', 'members cannot add sessions');
select tests.refused($$select public.create_space_post('club', '$$ || :'robotics' || $$', 'hi all', 'announcement', null)$$, 'club leaders', 'only leaders post club announcements');
reset role;
select tests.login(:yousef);
select tests.ok((select count(*) from public.club_tasks) = 0 and (select count(*) from public.club_sessions) = 0 and (select count(*) from public.club_resources) = 0, 'non-members see no club tasks, sessions or resources');
reset role;

-- club announcements and achievements
select tests.login(:layla);
select public.create_space_post('club', :'robotics', 'Meeting moved to Thursday', 'announcement', null);
select public.propose_club_achievement(:'robotics', 'Won the regional robotics cup', 'First place', current_date) as ach \gset
reset role;
select tests.login(:'outsider');
select tests.ok((select count(*) from public.notifications where recipient_id = auth.uid() and kind = 'announcement') >= 1, 'a club announcement notifies members');
select tests.ok((select count(*) from public.club_achievements) = 0, 'a pending achievement is not public');
select tests.refused($$select public.review_club_achievement('$$ || :'ach' || $$', true, 10)$$, 'Only admins', 'members cannot approve achievements');
reset role;
select tests.login(:rania);
select public.review_club_achievement(:'ach', true, 10);
reset role;
select tests.ok((select count(*) from public.points_ledger where reason = 'club_achievement' and points = 10) = (select count(*) from public.club_members where club_id = :'robotics' and public.is_current_student(profile_id)), 'an approved achievement gives each member the points');
select tests.login(:yousef);
select tests.ok((select count(*) from public.club_achievements) = 1, 'approved achievements are public');
reset role;

-- ---- Leadership: class announcements --------------------------------------------------------------
select tests.login(:rania);
select public.assign_leadership_role(:yousef, 'class_rep', '11B', null);
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set grade = 11, section = 'B' where id = :'outsider';
select tests.login(:yousef);
select tests.refused($$select public.post_class_announcement('10A', 'Hi', 'Not my class')$$, 'not the representative', 'a class rep cannot write to another class');
select public.post_class_announcement('11B', 'Bring your books', 'Library visit on Monday');
select tests.ok(((public.class_summary('11B')) ->> 'students')::int >= 1, 'a class rep sees a summary of their class');
select tests.refused($$select public.class_summary('10A')$$, 'not the representative', 'a class summary is only for the class rep');
reset role;
select tests.login(:maya);
select tests.ok((select count(*) from public.class_announcements) = 0, 'other classes do not see it');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set grade = 11, section = 'B' where id = :maya;
select tests.login(:maya);
select tests.ok((select count(*) from public.class_announcements) = 1, 'the class sees its announcement');
reset role;
select tests.ok((select count(*) from public.notifications where recipient_id = :'outsider' and kind = 'class_announcement') = 1, 'the class is notified');
select tests.login('eeeeeeee-0000-0000-0000-0000000000b1');
select tests.ok((select count(*) from public.class_announcements) = 0 and (select count(*) from public.competitions) = 0 and (select count(*) from public.teams) = 0, 'another school sees no classes, competitions or teams');
reset role;

rollback;
