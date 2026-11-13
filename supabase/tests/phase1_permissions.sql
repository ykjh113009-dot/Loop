-- Phase 1 permission tests. Runs inside one transaction that is rolled back,
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
grant execute on all functions in schema tests to authenticated, anon;

-- People: a1 Rania (owner, super admin), a2 Omar (moderator), a3 Layla,
-- a4 Yousef (made admin here), a5 Maya (student).
\set rania '''00000000-0000-0000-0000-0000000000a1'''
\set omar  '''00000000-0000-0000-0000-0000000000a2'''
\set layla '''00000000-0000-0000-0000-0000000000a3'''
\set yousef '''00000000-0000-0000-0000-0000000000a4'''
\set maya  '''00000000-0000-0000-0000-0000000000a5'''
update public.profiles set role = 'admin' where id = :yousef;

-- A second school with one student, to prove schools cannot see each other.
insert into public.schools (id, name, email_domain, google_only, admin_mfa_required)
values ('eeeeeeee-0000-0000-0000-00000000b001', 'Other School', 'other.example', false, false);
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated',
        'sam@other.example', '{"provider":"email"}', '{"full_name":"Sam Other"}', now(), now());
update public.profiles set onboarded_at = now(), grade = 10 where id = 'eeeeeeee-0000-0000-0000-0000000000b1';

-- ---- Signed out -----------------------------------------------------------
set local role anon;
select tests.refused('select count(*) from public.profiles', 'permission denied', 'signed-out visitors cannot read profiles');
select tests.refused($$select public.record_security_event('sign_in', '', '')$$, 'permission denied', 'signed-out visitors cannot call functions');
reset role;

-- ---- Student --------------------------------------------------------------
select tests.login(:layla);
select tests.refused($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'permission denied', 'a student cannot make themself admin');
select tests.refused($$update public.profiles set is_owner = true where id = auth.uid()$$, 'permission denied', 'a student cannot make themself owner');
select tests.refused($$select public.admin_update_member('00000000-0000-0000-0000-0000000000a5', 9, 'moderator')$$, 'Only admins', 'a student cannot change accounts');
select tests.refused($$select public.suspend_user('00000000-0000-0000-0000-0000000000a5', 1, 'x')$$, 'Only admins', 'a student cannot suspend');
select tests.refused($$insert into public.admin_applications (school_id, applicant_id, requested_role, motivation, contribution, status)
  values (public.my_school_id(), auth.uid(), 'admin', repeat('x', 30), repeat('x', 30), 'approved')$$, 'permission denied', 'a student cannot insert an approved application directly');
select tests.refused($$insert into public.leadership_roles (school_id, profile_id, kind) values (public.my_school_id(), auth.uid(), 'school_staff')$$, 'permission denied', 'a student cannot give themself a leadership role');
select tests.refused($$select public.check_rate('x', 1, 1)$$, 'permission denied', 'internal helpers are not callable');
select tests.refused($$select public.grant_leadership(auth.uid(), 'school_staff', '', null)$$, 'permission denied', 'grant_leadership is not callable');
select public.submit_admin_application('admin', 'Student', 'I want to help keep Loop friendly and safe.', 'I will review reports every day after school.', 'Class rep last year');
select tests.ok((select role from public.profiles where id = auth.uid()) = 'student', 'applying gives no permissions');
select tests.refused($$select public.submit_admin_application('admin', '', repeat('x', 30), repeat('x', 30), '')$$, 'already have an application', 'only one pending application');
select tests.refused($$select public.review_admin_application((select id from public.admin_applications limit 1), true, 'admin', '')$$, 'Only a Super Admin', 'a student cannot approve their own application');
select public.request_leadership_role('class_rep', '10A', null, 'I want to represent my class this year.');
select tests.refused($$select public.request_leadership_role('class_rep', '10A', null, 'I want to represent my class this year.')$$, 'already asked', 'no duplicate leadership requests');
select tests.refused($$select public.request_leadership_role('class_rep', 'my class', null, 'I want to represent my class.')$$, 'like 11A', 'class must look like 11A');
reset role;

select tests.login(:maya);
select tests.ok((select count(*) from public.admin_applications) = 0, 'students cannot see other people''s applications');
select tests.ok((select count(*) from public.leadership_requests) = 0, 'students cannot see other people''s leadership requests');
select tests.ok((select count(*) from public.security_events) = 0, 'students cannot see other people''s security events');
reset role;

-- ---- Moderator ------------------------------------------------------------
select tests.login(:omar);
select tests.ok(public.is_staff() and not public.is_admin(), 'a moderator is staff but not admin');
select tests.refused($$select public.suspend_user('00000000-0000-0000-0000-0000000000a5', 1, 'x')$$, 'Only admins', 'a moderator cannot suspend');
select tests.refused($$select public.set_restriction('00000000-0000-0000-0000-0000000000a5', 'posting', 3, 'x')$$, 'Only admins', 'a moderator cannot restrict activities');
select tests.refused($$select public.review_leadership_request((select id from public.leadership_requests limit 1), true, '')$$, 'Only admins', 'a moderator cannot review leadership requests');
select tests.refused($$select public.admin_update_member('00000000-0000-0000-0000-0000000000a5', 9, 'student')$$, 'Only admins', 'a moderator cannot change accounts');
select tests.ok((select count(*) from public.admin_applications) = 0, 'a moderator cannot see admin applications');
reset role;

-- ---- Admin ----------------------------------------------------------------
select tests.login(:yousef);
select tests.ok(public.is_admin() and not public.is_super_admin(), 'an admin is not a super admin');
select public.suspend_user(:maya, 3, 'Test');
select tests.ok((select suspended_until > now() + interval '2 days' from public.profiles where id = :maya), 'an admin can suspend a student for 3 days');
select public.unsuspend_user(:maya);
select tests.refused($$select public.suspend_user('00000000-0000-0000-0000-0000000000a5', null, 'x')$$, 'between 1 and 365', 'no permanent suspensions');
select tests.refused($$select public.suspend_user('00000000-0000-0000-0000-0000000000a1', 1, 'x')$$, 'cannot suspend this', 'an admin cannot suspend a super admin');
select tests.refused($$select public.admin_set_deactivated('00000000-0000-0000-0000-0000000000a1', true)$$, 'cannot remove this', 'an admin cannot remove a super admin');
select tests.refused($$select public.admin_update_member('00000000-0000-0000-0000-0000000000a5', 9, 'moderator')$$, 'Only a Super Admin', 'an admin cannot change roles');
select tests.refused($$select public.review_admin_application((select id from public.admin_applications limit 1), true, 'admin', '')$$, 'Only a Super Admin', 'an admin cannot review admin applications');
select tests.ok((select count(*) from public.admin_applications) = 0, 'an admin cannot see admin applications');
update public.schools set name = 'Hacked' where id = public.my_school_id();
select tests.ok((select name from public.schools where id = public.my_school_id()) = 'Pioneers School', 'an admin cannot change school settings');
select public.review_leadership_request((select id from public.leadership_requests where profile_id = :layla), true, 'Welcome');
select tests.ok(exists (select 1 from public.leadership_roles where profile_id = :layla and kind = 'class_rep' and scope = '10A'), 'an admin can approve a leadership request');
select tests.refused($$select public.remove_leadership_role((select id from public.leadership_roles where kind = 'class_rep' limit 1))$$, 'Only a Super Admin', 'an admin cannot remove a leadership role');
select tests.refused($$select public.assign_leadership_role('00000000-0000-0000-0000-0000000000a5', 'school_staff', '', null)$$, 'Only a Super Admin', 'an admin cannot assign leadership directly');
select public.set_restriction(:layla, 'posting', 7, 'Spam');
reset role;

select tests.login(:layla);
select tests.refused($$insert into public.posts (school_id, club_id, author_id, body)
  select public.my_school_id(), club_id, auth.uid(), 'hello' from public.club_members where profile_id = auth.uid() limit 1$$, 'RESTRICTED', 'a posting restriction blocks new posts');
reset role;
select tests.login(:yousef);
select public.set_restriction(:layla, 'posting', null, null);
reset role;

-- Rate limit: the 21st post in an hour is refused.
select tests.login(:layla);
insert into public.posts (school_id, club_id, author_id, body)
  select public.my_school_id(), (select club_id from public.club_members where profile_id = auth.uid() limit 1), auth.uid(), 'post ' || n
  from generate_series(1, 20) n;
select tests.refused($$insert into public.posts (school_id, club_id, author_id, body)
  select public.my_school_id(), club_id, auth.uid(), 'one too many' from public.club_members where profile_id = auth.uid() limit 1$$, 'RATE_LIMIT', 'posting is rate limited');
reset role;

-- ---- Super Admin (owner) --------------------------------------------------
select tests.login(:rania);
select tests.ok(public.is_super_admin() and public.is_owner(), 'the owner is a super admin');
select tests.ok((select count(*) from public.admin_applications) = 1, 'a super admin sees admin applications');
select public.review_admin_application((select id from public.admin_applications where applicant_id = :layla), true, 'moderator', 'Start as a moderator');
select tests.ok((select role from public.profiles where id = :layla) = 'moderator', 'an application can be approved with a different role');
select tests.ok((select assigned_role from public.admin_applications where applicant_id = :layla) = 'moderator', 'the assigned role is recorded');
select tests.refused($$select public.review_admin_application((select id from public.admin_applications limit 1), true, 'admin', '')$$, 'already reviewed', 'an application is reviewed once');
select public.admin_update_member(:maya, 9, 'super_admin');
select tests.ok((select role from public.profiles where id = :maya) = 'super_admin', 'the owner can appoint a super admin');
select tests.refused($$select public.admin_update_member('00000000-0000-0000-0000-0000000000a1', 12, 'admin')$$, 'your own role', 'nobody changes their own role');
select public.remove_leadership_role((select id from public.leadership_roles where profile_id = :layla and kind = 'class_rep'));
select tests.ok(not exists (select 1 from public.leadership_roles where profile_id = :layla and kind = 'class_rep'), 'a super admin can remove a leadership role');
select public.assign_leadership_role(:layla, 'council_member', 'Treasurer', null);
select tests.ok(exists (select 1 from public.council_members where profile_id = :layla), 'a council role also appears on the council list');
update public.schools set name = 'Pioneers School 2' where id = public.my_school_id();
select tests.ok((select name from public.schools where id = public.my_school_id()) = 'Pioneers School 2', 'a super admin can change school settings');
reset role;

-- A second super admin is not the owner.
select tests.login(:maya);
select tests.ok(public.is_super_admin() and not public.is_owner(), 'a second super admin is not the owner');
select tests.refused($$select public.admin_update_member('00000000-0000-0000-0000-0000000000a1', 12, 'admin')$$, 'owner''s role', 'the owner cannot be demoted');
select tests.refused($$select public.admin_update_member('00000000-0000-0000-0000-0000000000a3', 10, 'super_admin')$$, 'platform owner', 'only the owner appoints super admins');
select tests.refused($$select public.suspend_user('00000000-0000-0000-0000-0000000000a1', 1, 'x')$$, 'cannot suspend this', 'the owner cannot be suspended');
select public.admin_update_member(:layla, 10, 'admin');
select tests.ok((select role from public.profiles where id = :layla) = 'admin', 'a super admin can appoint an admin');
reset role;

-- ---- Two-step sign-in ------------------------------------------------------
update public.schools set admin_mfa_required = true where id = '00000000-0000-0000-0000-00000000a001';
select tests.login(:rania, 'aal1');
select tests.ok(not public.is_admin() and not public.is_staff(), 'without the second step an admin has no admin powers');
select tests.refused($$select public.admin_update_member('00000000-0000-0000-0000-0000000000a5', 9, 'student')$$, 'Only admins', 'admin actions need the second step');
select tests.ok((select count(*) from public.admin_applications) = 0, 'admin data is hidden without the second step');
reset role;
select tests.login(:rania, 'aal2');
select tests.ok(public.is_admin() and public.is_owner(), 'with the second step the powers are back');
reset role;
select tests.login(:omar, 'aal1');
select tests.ok(public.is_staff(), 'moderators do not need the second step');
reset role;

-- ---- School isolation -------------------------------------------------------
select tests.login('eeeeeeee-0000-0000-0000-0000000000b1');
select tests.ok(public.is_reader(), 'the other school''s student is signed in');
select tests.ok((select count(*) from public.profiles where school_id = '00000000-0000-0000-0000-00000000a001') = 0, 'another school cannot see our students');
select tests.ok((select count(*) from public.posts) = 0, 'another school cannot see our posts');
select tests.ok((select count(*) from public.clubs) = 0, 'another school cannot see our clubs');
select tests.ok((select count(*) from public.events) = 0, 'another school cannot see our events');
select tests.ok((select count(*) from public.announcements) = 0, 'another school cannot see our announcements');
select tests.ok((select count(*) from public.messages) = 0, 'another school cannot see our messages');
select tests.ok((select count(*) from public.leadership_roles) = 0, 'another school cannot see our leadership roles');
select tests.ok((select count(*) from public.schools) = 1, 'a student only sees their own school');
select tests.refused($$select public.start_direct_conversation('00000000-0000-0000-0000-0000000000a3')$$, '', 'another school cannot message our students');
reset role;
select tests.login(:omar);
select tests.ok((select count(*) from public.profiles where school_id = 'eeeeeeee-0000-0000-0000-00000000b001') = 0, 'we cannot see the other school''s students');
reset role;

-- ---- Security events --------------------------------------------------------
select tests.login(:omar);
select public.record_security_event('sign_in', '1.1.1.1', 'Browser A');
select public.record_security_event('sign_in', '1.1.1.1', 'Browser A');
select tests.ok((select count(*) from public.security_events where kind = 'new_device') = 0, 'the same browser is not a new device');
select public.record_security_event('sign_in', '2.2.2.2', 'Browser B');
select tests.ok((select count(*) from public.security_events where kind = 'new_device') = 1, 'a new browser is recorded and the student is told');
select tests.refused($$select public.record_security_event('made_up', '', '')$$, 'Unknown event', 'only known security events are accepted');
select tests.refused($$delete from public.security_events$$, 'permission denied', 'security events cannot be deleted');
reset role;

-- ---- Activity log -----------------------------------------------------------
select tests.ok((select count(*) from public.moderation_log where action in ('suspend', 'change_role', 'approve_admin_application', 'restrict', 'remove_leadership')) >= 5, 'admin actions are written to the activity log');
select tests.refused($$update public.moderation_log set details = 'edited'$$, 'cannot be changed', 'the activity log cannot be edited, even by the database owner');
select tests.refused($$delete from public.moderation_log$$, 'cannot be deleted', 'the activity log cannot be deleted');

rollback;
