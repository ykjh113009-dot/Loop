-- Phase 4 tests: events and calendar, volunteering hub, Student Council hub.
-- Runs inside one transaction that is rolled back, so it never changes the database. Run with:  npm run db:test
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
create function tests.pts(p_profile uuid, p_reason text) returns bigint language sql security definer as $$
  select coalesce(sum(points), 0) from public.points_ledger where profile_id = p_profile and reason = p_reason $$;
create function tests.notes(p_profile uuid, p_kind text) returns bigint language sql security definer as $$
  select count(*) from public.notifications where recipient_id = p_profile and kind = p_kind $$;
create function tests.chat_members(p_event uuid) returns bigint language sql security definer as $$
  select count(*) from public.conversation_members m join public.conversations c on c.id = m.conversation_id where c.event_id = p_event $$;
create function tests.in_chat(p_event uuid, p_profile uuid) returns boolean language sql security definer as $$
  select exists (select 1 from public.conversation_members m join public.conversations c on c.id = m.conversation_id
                 where c.event_id = p_event and m.profile_id = p_profile) $$;
-- An event idea: starts in two days.
create function tests.ev(p jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('title', 'Spring fair', 'description', 'Games, food and music in the yard.', 'location', 'School yard',
    'category', 'social', 'starts_at', now() + interval '2 days', 'ends_at', now() + interval '2 days 3 hours') || p $$;
grant execute on all functions in schema tests to authenticated, anon;

\set rania '''00000000-0000-0000-0000-0000000000a1'''
\set omar  '''00000000-0000-0000-0000-0000000000a2'''
\set layla '''00000000-0000-0000-0000-0000000000a3'''
\set yousef '''00000000-0000-0000-0000-0000000000a4'''
\set maya  '''00000000-0000-0000-0000-0000000000a5'''
\set ahmad '''00000000-0000-0000-0000-000000001001'''
\set khaled '''00000000-0000-0000-0000-000000001005'''
\set hamza '''00000000-0000-0000-0000-000000001009'''

insert into public.schools (id, name, email_domain, google_only, admin_mfa_required)
values ('eeeeeeee-0000-0000-0000-00000000b001', 'Other School', 'other.example', false, false);
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated',
        'sam@other.example', '{"provider":"email"}', '{"full_name":"Sam Other"}', now(), now());
update public.profiles set onboarded_at = now(), grade = 10, section = 'A' where id = 'eeeeeeee-0000-0000-0000-0000000000b1';
delete from public.points_ledger where profile_id in (:layla, :yousef, :maya, :ahmad, :khaled, :hamza);
-- Omar is only a moderator here. Layla is on the Student Council. Maya, Ahmad, Khaled and Hamza are plain students.
delete from public.leadership_roles where profile_id = :omar and kind = 'council_member';
delete from public.leadership_roles where profile_id in (:maya, :ahmad, :khaled, :hamza, :layla) and kind in ('council_member', 'club_leader');
delete from public.club_members where profile_id in (:maya, :ahmad, :khaled, :hamza) and role = 'leader';
select tests.login(:rania);
select public.assign_leadership_role(:layla, 'council_member', 'Secretary', null);
reset role;
select id as football from public.clubs where name = 'Football Team' \gset
select id as robotics from public.clubs where name = 'Robotics Club' \gset

-- ==== Events: proposing and publishing =====================================================
select tests.notes('00000000-0000-0000-0000-0000000000a1', 'event_proposal') as proposals_before \gset
select tests.login(:maya);
select tests.refused($$insert into public.events (school_id, title, starts_at, created_by) values (public.my_school_id(), 'Direct', now() + interval '1 day', auth.uid())$$,
  'permission denied', 'events cannot be inserted directly');
select tests.refused($$select public.create_event(tests.ev('{"title": "A"}'))$$, 'title', 'an event needs a title');
select tests.refused($$select public.create_event(tests.ev('{"title": "You fuck"}'))$$, 'inappropriate', 'bad words are refused in events');
select tests.refused($$select public.create_event(tests.ev('{"starts_at": "2020-01-01T10:00:00Z", "ends_at": "2020-01-01T12:00:00Z"}'))$$, 'future', 'an event must be in the future');
select tests.refused($$select public.create_event(tests.ev('{"capacity": 0}'))$$, 'limit', 'a capacity limit must make sense');
select tests.refused($$select public.create_event(tests.ev('{"cover_path": "x/y/z.jpg"}'))$$, 'not yours', 'a cover photo must be your own upload');
select public.create_event(tests.ev('{"title": "Students charity day"}')) as e_prop \gset
select tests.ok((select status from public.events where id = :'e_prop') = 'pending', 'a student proposal waits for approval');
select tests.ok(tests.chat_members(:'e_prop') = 0, 'a proposal has no chat yet');
reset role;
select tests.ok(tests.notes('00000000-0000-0000-0000-0000000000a1', 'event_proposal') = :proposals_before + 1, 'admins are told about a proposal');
select tests.login(:ahmad);
select tests.ok((select count(*) from public.events where id = :'e_prop') = 0, 'other students cannot see a proposal');
select tests.refused($$select public.join_event('$$ || :'e_prop' || $$')$$, 'not available', 'nobody can join an unapproved event');
reset role;
select tests.login(:omar);
select tests.ok((select count(*) from public.events where id = :'e_prop') = 1, 'moderators can see proposals');
select tests.refused($$select public.review_event('$$ || :'e_prop' || $$', true, '')$$, 'admins', 'a moderator cannot approve a proposal');
reset role;
select tests.login(:layla);
select tests.refused($$select public.review_event('$$ || :'e_prop' || $$', true, '')$$, 'admins', 'the council cannot approve a proposal');
reset role;
select tests.login(:rania);
select tests.refused($$select public.review_event('$$ || :'e_prop' || $$', false, '')$$, 'why', 'a rejection needs a reason');
select public.review_event(:'e_prop', true, '');
reset role;
select tests.ok((select status from public.events where id = :'e_prop') = 'approved', 'an admin approves a proposal');
select tests.ok(tests.in_chat(:'e_prop', :maya), 'an approved event gets a chat with its creator in it');
select tests.ok(tests.notes(:maya, 'event_approved') = 1, 'the student is told it was approved');

-- direct publishing
select tests.login(:layla);
select public.create_event(tests.ev('{"title": "Council quiz night"}')) as e_council \gset
select public.create_event(tests.ev(('{"title": "Robotics demo", "club_id": "' || :'robotics' || '"}')::jsonb)) as e_club \gset
reset role;
select tests.ok((select status from public.events where id = :'e_council') = 'approved', 'the Student Council publishes directly');
select tests.ok((select status from public.events where id = :'e_club') = 'approved', 'a club leader publishes a club event directly');
select tests.login(:yousef);
select public.create_event(tests.ev(('{"title": "Football friendly", "club_id": "' || :'football' || '"}')::jsonb)) as e_foot \gset
select public.create_event(tests.ev(('{"title": "Other club idea", "club_id": "' || :'robotics' || '"}')::jsonb)) as e_notmine \gset
reset role;
select tests.ok((select status from public.events where id = :'e_foot') = 'approved', 'a club leader publishes for their own club');
select tests.ok((select status from public.events where id = :'e_notmine') = 'pending', 'a club leader proposing for another club needs approval');
select tests.login(:rania);
select public.create_event(tests.ev('{"title": "School open day", "capacity": 2}')) as e_cap \gset
reset role;
select tests.ok((select status from public.events where id = :'e_cap') = 'approved', 'an admin publishes directly');

-- ==== Going, capacity and the waiting list =================================================
select tests.login(:maya);
select tests.refused($$insert into public.event_rsvps (event_id, profile_id, school_id) values ('$$ || :'e_cap' || $$', auth.uid(), public.my_school_id())$$, 'permission denied', 'going cannot be set directly');
select tests.ok(public.join_event(:'e_cap') = 'going', 'the first student goes');
select tests.ok(public.join_event(:'e_cap') = 'going', 'joining twice changes nothing');
reset role;
select tests.login(:ahmad);
select tests.ok(public.join_event(:'e_cap') = 'going', 'the second student goes');
reset role;
select tests.login(:khaled);
select tests.ok(public.join_event(:'e_cap') = 'waitlist', 'the third student goes on the waiting list');
reset role;
select tests.login(:hamza);
select tests.ok(public.join_event(:'e_cap') = 'waitlist', 'the fourth student is next on the list');
reset role;
select tests.ok(tests.in_chat(:'e_cap', :maya) and not tests.in_chat(:'e_cap', :khaled), 'people going are in the chat, the waiting list is not');
select tests.login(:maya);
select public.leave_event(:'e_cap');
reset role;
select tests.ok((select status from public.event_rsvps where event_id = :'e_cap' and profile_id = :khaled) = 'going', 'when someone leaves the first person on the list moves up');
select tests.ok((select status from public.event_rsvps where event_id = :'e_cap' and profile_id = :hamza) = 'waitlist', 'the next person keeps waiting');
select tests.ok(tests.notes(:khaled, 'event_waitlist') = 1, 'the student who moved up is told');
select tests.ok(tests.in_chat(:'e_cap', :khaled) and not tests.in_chat(:'e_cap', :maya), 'the chat follows who is going');
select tests.login(:ahmad);
select tests.refused($$select public.manage_attendee('$$ || :'e_cap' || $$', '$$ || :hamza || $$', 'promote')$$, 'organizers', 'a student cannot manage who is going');
reset role;
select tests.login(:rania);
select public.manage_attendee(:'e_cap', :hamza, 'promote');
select tests.ok((select status from public.event_rsvps where event_id = :'e_cap' and profile_id = :hamza) = 'going', 'organizers can let someone in over the limit');
select public.manage_attendee(:'e_cap', :hamza, 'remove');
select tests.ok(not exists (select 1 from public.event_rsvps where event_id = :'e_cap' and profile_id = :hamza), 'organizers can remove someone');
select tests.refused($$select public.manage_attendee('$$ || :'e_cap' || $$', '$$ || :khaled || $$', 'dance')$$, 'unknown', 'unknown attendee actions are refused');
reset role;

-- reminders skip the waiting list
select tests.login(:maya);
select public.join_event(:'e_cap');
reset role;
update public.events set starts_at = now() + interval '30 minutes', ends_at = now() + interval '3 hours' where id = :'e_cap';
select public.send_event_reminders();
select tests.ok(tests.notes(:ahmad, 'event_reminder') >= 1, 'people going get reminders');
select tests.ok(tests.notes(:maya, 'event_reminder') = 0, 'people on the waiting list do not');

-- ==== Editing, announcements and the organizing team ======================================
select tests.login(:maya);
select tests.refused($$select public.update_event('$$ || :'e_council' || $$', tests.ev())$$, 'cannot change', 'a student cannot edit someone else''s event');
select tests.refused($$select public.post_event_update('$$ || :'e_council' || $$', 'Hello', 'x')$$, 'organizers', 'a student cannot post updates');
select tests.refused($$select public.set_event_organizers('$$ || :'e_council' || $$', array['$$ || :maya || $$']::uuid[])$$, 'creator', 'a student cannot choose the team');
reset role;
select tests.login(:ahmad);
select public.join_event(:'e_council');
reset role;
select tests.login(:layla);
select public.set_event_organizers(:'e_council', array[:ahmad]::uuid[]);
select tests.ok(tests.in_chat(:'e_council', :ahmad), 'organizers are in the event chat');
select public.update_event(:'e_council', tests.ev('{"title": "Council quiz night", "location": "Room 12"}'));
select tests.ok((select location from public.events where id = :'e_council') = 'Room 12', 'the organizers can edit a published event');
select tests.ok((select count(*) from public.event_updates where event_id = :'e_council' and kind = 'change') = 1, 'an important change is recorded');
select public.post_event_update(:'e_council', 'Bring a pen', 'Teams of four.');
select tests.refused($$select public.update_event('$$ || :'e_council' || $$', tests.ev('{"starts_at": "2020-01-01T10:00:00Z", "ends_at": "2020-01-01T12:00:00Z"}'))$$, 'future', 'a new time must be in the future');
reset role;
select tests.ok(tests.notes(:ahmad, 'event_update') = 1, 'an announcement reaches the people involved');
select tests.login(:ahmad);
select public.update_event(:'e_council', tests.ev('{"title": "Council quiz night", "location": "Room 14"}'));
select tests.ok((select location from public.events where id = :'e_council') = 'Room 14', 'a team member can edit too');
select tests.ok((select count(*) from public.event_updates where event_id = :'e_council') = 3, 'everyone can read the updates');
reset role;
select tests.login(:khaled);
select tests.ok((select count(*) from public.event_updates where event_id = :'e_council') = 3, 'students can read an event''s updates');
reset role;

-- files
select tests.login(:layla);
select tests.ok(public.event_file_uploader(public.my_school_id()::text || '/' || :'e_council' || '/poster.pdf'), 'organizers can upload files for their event');
select public.add_event_attachment(:'e_council', public.my_school_id()::text || '/' || :'e_council' || '/poster.pdf', 'Poster') as att \gset
select tests.refused($$select public.add_event_attachment('$$ || :'e_council' || $$', 'a/b/c.pdf', 'x')$$, 'does not belong', 'a file must be in the event''s folder');
reset role;
select tests.login(:khaled);
select tests.ok(not public.event_file_uploader(public.my_school_id()::text || '/' || :'e_council' || '/evil.pdf'), 'other students cannot upload to an event');
select tests.ok((select count(*) from public.event_attachments where event_id = :'e_council') = 1, 'students can see the files');
select tests.refused($$select public.remove_event_attachment('$$ || :'att' || $$')$$, 'cannot remove', 'a student cannot remove files');
reset role;

-- cancelling tells everyone
select tests.login(:layla);
select public.cancel_event(:'e_council', 'Teacher is ill');
reset role;
select tests.ok(tests.notes(:ahmad, 'event_cancelled') = 1, 'cancelling tells the people involved');

-- another school sees nothing
select tests.login('eeeeeeee-0000-0000-0000-0000000000b1');
select tests.ok((select count(*) from public.events) = 0 and (select count(*) from public.event_updates) = 0, 'another school sees no events');
reset role;

-- ==== Volunteering hub =======================================================================
select tests.login(:maya);
select tests.refused($$select public.publish_opportunity('{"title": "Help at the fair"}'::jsonb)$$, 'Only admins', 'a student cannot publish a standalone opportunity');
select tests.refused($$select public.publish_opportunity(('{"title": "Fair helpers", "event_id": "' || '$$ || :'e_foot' || $$' || '"}')::jsonb)$$, 'organizers of that event', 'a student cannot add roles to someone else''s event');
reset role;
select tests.login(:yousef);
select public.publish_opportunity(('{"title": "Match day helpers", "spots": 1, "requirements": "Be there at 8", "event_id": "' || :'e_foot' || '"}')::jsonb) as o1 \gset
select public.publish_opportunity('{"title": "Football camp helpers"}'::jsonb) as o2 \gset
reset role;
select tests.ok((select event_id from public.volunteer_opportunities where id = :'o1') = :'e_foot', 'an organizer adds volunteer roles to their event');
select tests.ok((select count(*) from public.volunteer_opportunities where id = :'o2') = 1, 'a club leader publishes a standalone opportunity');
select tests.login(:maya);
select tests.ok((select count(*) from public.volunteer_opportunities) >= 2, 'students can browse opportunities');
select public.apply_volunteer(:'o1', 'I can help with the water') as a1 \gset
select tests.refused($$select public.apply_volunteer('$$ || :'o1' || $$', 'again')$$, 'already applied', 'you cannot apply twice');
select tests.ok((select count(*) from public.volunteer_applications) = 1, 'a student sees their own applications');
reset role;
select tests.login(:khaled);
select tests.ok((select count(*) from public.volunteer_applications) = 0, 'other students cannot see applications');
select public.apply_volunteer(:'o1', 'Me too') as a2 \gset
reset role;
select tests.login(:yousef);
select tests.refused($$select public.apply_volunteer('$$ || :'o1' || $$', 'I organize it')$$, 'organize', 'organizers cannot apply to their own opportunity');
select tests.ok((select count(*) from public.volunteer_applications where opportunity_id = :'o1') = 2, 'organizers see the applications');
select tests.refused($$select public.review_volunteer_application('$$ || :'a2' || $$', false, '', '')$$, 'why', 'a rejection needs a reason');
select public.review_volunteer_application(:'a1', true, 'Hand out water at the touchline', '');
select tests.refused($$select public.review_volunteer_application('$$ || :'a2' || $$', true, 'Tickets', '')$$, 'spots', 'accepting is limited by the number of spots');
select public.review_volunteer_application(:'a2', false, '', 'All spots are full, thank you');
reset role;
select tests.ok(tests.notes(:maya, 'volunteer_accepted') = 1 and tests.notes(:khaled, 'volunteer_rejected') = 1, 'applicants are told');
select tests.ok(tests.in_chat(:'e_foot', :maya), 'an accepted event volunteer joins the event chat');
select tests.login(:maya);
select tests.ok((select responsibility from public.volunteer_applications where id = :'a1') like '%water%', 'a volunteer sees their assignment');
select tests.refused($$select public.review_volunteer_application('$$ || :'a1' || $$', true, 'x', '')$$, 'organizers', 'a volunteer cannot accept themselves');
select tests.refused($$select public.complete_volunteering('$$ || :'a1' || $$', 3)$$, 'organizers', 'a volunteer cannot record their own hours');
reset role;
select tests.login(:yousef);
select public.set_responsibility(:'a1', 'Hand out water and tidy up');
select tests.refused($$select public.complete_volunteering('$$ || :'a1' || $$', 20)$$, 'between', 'hours must be sensible');
select public.complete_volunteering(:'a1', 3);
select tests.refused($$select public.complete_volunteering('$$ || :'a1' || $$', 3)$$, 'accepted volunteers', 'hours cannot be recorded twice');
reset role;
select tests.ok(tests.pts(:maya, 'volunteer') = 30, 'recorded hours earn points once (10 per hour)');
select tests.ok((select count(*) from public.volunteer_entries where application_id = :'a1' and status = 'approved' and hours = 3) = 1, 'the hours join the verified volunteering record');
select tests.login(:ahmad);
select tests.ok(exists (select 1 from public.volunteer_history(:maya) where organization = 'Match day helpers' and hours = 3), 'a profile can show verified volunteering');
reset role;
select tests.login(:yousef);
select public.set_opportunity_status(:'o2', 'cancelled');
reset role;
select tests.login(:khaled);
select tests.ok((select count(*) from public.volunteer_opportunities where id = :'o2') = 0, 'cancelled opportunities disappear');
select tests.refused($$select public.set_opportunity_status('$$ || :'o1' || $$', 'closed')$$, 'cannot change', 'a student cannot close an opportunity');
reset role;

-- ==== Student Council hub ===================================================================
select tests.login(:maya);
select tests.refused($$select public.post_council(null, '{"kind": "announcement", "title": "Free pizza"}'::jsonb)$$, 'Only the Student Council', 'a student cannot post as the council');
select tests.refused($$insert into public.council_posts (school_id, kind, title) values (public.my_school_id(), 'update', 'sneaky')$$, 'permission denied', 'posts cannot be inserted directly');
select tests.refused($$select public.set_council_info('{"contact_email": "x@y.com"}'::jsonb)$$, 'Only the Student Council', 'a student cannot change the contact info');
reset role;
select tests.login(:layla);
select public.post_council(null, '{"kind": "announcement", "title": "Spirit week next week", "body": "Dress up every day!"}'::jsonb) as c1 \gset
select public.post_council(null, '{"kind": "initiative", "title": "Water bottle refill station", "body": "We asked the school.", "status": "in_progress"}'::jsonb) as c2 \gset
select public.post_council(null, '{"kind": "update", "title": "Meeting notes", "status": "done"}'::jsonb) as c3 \gset
select tests.ok((select status from public.council_posts where id = :'c2') = 'in_progress' and (select status from public.council_posts where id = :'c3') is null, 'only initiatives have a status');
select tests.refused($$select public.post_council(null, '{"kind": "initiative", "title": "Odd", "status": "maybe"}'::jsonb)$$, 'Unknown status', 'an initiative status must be valid');
select tests.refused($$select public.post_council(null, '{"kind": "party", "title": "Odd"}'::jsonb)$$, 'Choose', 'the post type must be valid');
select tests.refused($$select public.post_council(null, '{"kind": "update", "title": "You fuck"}'::jsonb)$$, 'inappropriate', 'bad words are refused');
select public.post_council(:'c2', '{"kind": "initiative", "title": "Water bottle refill station", "body": "Installed!", "status": "done"}'::jsonb);
select tests.ok((select status from public.council_posts where id = :'c2') = 'done', 'the council can update an initiative');
select tests.refused($$select public.set_council_info('{"contact_email": "not-an-email"}'::jsonb)$$, 'does not look right', 'the contact email must look right');
select public.set_council_info('{"about": "We represent you.", "contact_email": "council@pioneers.edu.ps", "office": "Room 3", "meeting_info": "Thursdays at lunch"}'::jsonb);
reset role;
select tests.ok(tests.notes(:maya, 'council_announcement') = 1, 'an announcement notifies the school');
select tests.login(:khaled);
select tests.ok((select count(*) from public.council_posts) = 3, 'students can read council posts');
select tests.ok((select contact_email from public.council_info) = 'council@pioneers.edu.ps', 'students can read the contact info');
-- reaching the council
select public.contact_council('More lockers', 'Please can we ask for more lockers in grade 10?') as m1 \gset
select tests.refused($$select public.contact_council('x', 'y')$$, 'subject', 'a message needs a subject and text');
select tests.refused($$select public.contact_council('Rude one', 'you fuck')$$, 'inappropriate', 'bad words are refused in messages to the council');
select public.contact_council('Cleaner yard', 'The yard needs more bins, thanks.');
select public.contact_council('Bus times', 'Can we change the bus time?');
select tests.refused($$select public.contact_council('Fourth', 'one too many today')$$, 'too often', 'messages to the council are rate limited');
select tests.ok((select count(*) from public.council_messages) = 3, 'a student sees their own messages');
select tests.refused($$select public.reply_council_message('$$ || :'m1' || $$', 'I answer myself')$$, 'Only the Student Council', 'a student cannot reply');
reset role;
select tests.login(:ahmad);
select tests.ok((select count(*) from public.council_messages) = 0, 'other students cannot read messages to the council');
reset role;
select tests.ok(tests.notes(:layla, 'council_message') = 3, 'the council is told about new messages');
select tests.login(:layla);
select tests.ok((select count(*) from public.council_messages) = 3, 'the council reads the messages');
select public.reply_council_message(:'m1', 'We will ask the principal and tell you.');
reset role;
select tests.ok((select status from public.council_messages where id = :'m1') = 'answered', 'a reply marks it answered');
select tests.ok(tests.notes(:khaled, 'council_reply') = 1, 'the student is told about the reply');
select tests.login(:rania);
select tests.ok((select count(*) from public.council_messages) = 3, 'admins can read messages to the council');
select public.delete_council_post(:'c3');
reset role;
select tests.ok((select count(*) from public.council_posts) = 2, 'the council can delete a post');
select tests.login('eeeeeeee-0000-0000-0000-0000000000b1');
select tests.ok((select count(*) from public.council_posts) = 0 and (select count(*) from public.volunteer_opportunities) = 0, 'another school sees nothing');
reset role;

rollback;
