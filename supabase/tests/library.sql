-- Academic Resources Library tests: submissions, review, versions, points, ratings, flags, privacy. Runs inside one transaction that is rolled back. Run with:  npm run db:test
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

create function tests.res(p jsonb default '{}') returns jsonb language sql security definer as $$
  select jsonb_build_object('subject_id', (select id from public.study_categories where slug = 'sat' and school_id = (select school_id from public.profiles where id = '00000000-0000-0000-0000-0000000000a1')),
    'title', 'SAT Math Notes', 'description', 'Clear notes covering every algebra topic.', 'type', 'pdf_notes', 'author', 'Layla',
    'link_url', 'https://example.org/sat-notes', 'downloadable', false) || p $$;
create function tests.path(p_user uuid, p_name text default 'notes.pdf') returns text language sql security definer as $$
  select (select school_id from public.profiles where id = '00000000-0000-0000-0000-0000000000a1')::text || '/' || p_user::text || '/' || gen_random_uuid()::text || '/' || p_name $$;
grant execute on all functions in schema tests to authenticated, anon;

\set rania '''00000000-0000-0000-0000-0000000000a1'''
\set omar  '''00000000-0000-0000-0000-0000000000a2'''
\set layla '''00000000-0000-0000-0000-0000000000a3'''
\set yousef '''00000000-0000-0000-0000-0000000000a4'''
\set maya  '''00000000-0000-0000-0000-0000000000a5'''
\set ahmad '''00000000-0000-0000-0000-000000001001'''
\set khaled '''00000000-0000-0000-0000-000000001005'''

insert into public.schools (id, name, email_domain, google_only, admin_mfa_required)
values ('eeeeeeee-0000-0000-0000-00000000b001', 'Other School', 'other.example', false, false);
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated',
        'sam@other.example', '{"provider":"email"}', '{"full_name":"Sam Other"}', now(), now());
update public.profiles set onboarded_at = now(), grade = 10, section = 'A' where id = 'eeeeeeee-0000-0000-0000-0000000000b1';
delete from public.leadership_roles where profile_id = :omar and kind = 'council_member';
delete from public.leadership_roles where profile_id in (:maya, :ahmad, :khaled, :yousef) and kind in ('council_member', 'school_staff');
delete from public.rate_events;
delete from public.library_resources;
delete from public.library_settings;
delete from public.points_ledger where reason = 'library_resource';
select tests.login(:rania);
select public.assign_leadership_role(:layla, 'council_member', 'Secretary', null);
reset role;
-- Yousef is a plain student; Ahmad is a plain student; Maya too.

-- 1. Submitting
select tests.login(:yousef);
select set_config('t.r1', public.library_submit(null, tests.res(), true)::text, true);
select tests.ok((select status from public.library_revisions where resource_id = current_setting('t.r1')::uuid) = 'pending', 'a student can submit a resource for review');
select tests.ok(not exists (select 1 from public.library_resources where id = current_setting('t.r1')::uuid and published_at is not null), 'a pending resource is not published');
select tests.refused($$select public.library_submit(null, tests.res('{"link_url":"http://localhost/x","title":"Local thing"}'), true)$$, 'safe', 'local links are refused');
select tests.refused($$select public.library_submit(null, tests.res('{"link_url":"javascript:alert(1)","title":"Script thing"}'), true)$$, 'safe', 'script links are refused');
select tests.refused($$select public.library_submit(null, tests.res('{"link_url":"http://10.0.0.5/x","title":"Ip thing"}'), true)$$, 'safe', 'raw IP links are refused');
select tests.refused($$select public.library_submit(null, tests.res('{"link_url":"https://example.org/sat-notes/","title":"Same again"}'), true)$$, 'already', 'the same link cannot be shared twice');
select tests.refused($$select public.library_submit(null, tests.res('{"title":"No content","link_url":null}'), true)$$, 'Upload a file', 'a submission needs a file or a link');
select tests.refused(format($$select public.library_submit(null, tests.res('{"title":"Both","link_url":"https://example.org/both","file_path":"%s","file_name":"a.pdf","file_size":100,"file_mime":"application/pdf","rights_confirmed":true}'), true)$$, tests.path(:yousef)), 'not both', 'a file and a link together are refused');
select tests.refused(format($$select public.library_submit(null, tests.res('{"title":"No rights","link_url":null,"file_path":"%s","file_name":"a.pdf","file_size":100,"file_mime":"application/pdf"}'), true)$$, tests.path(:yousef)), 'allowed to share', 'a file needs the sharing confirmation');
select tests.refused(format($$select public.library_submit(null, tests.res('{"title":"Bad type","link_url":null,"file_path":"%s","file_name":"a.exe","file_size":100,"file_mime":"application/x-msdownload","rights_confirmed":true}'), true)$$, tests.path(:yousef)), 'not allowed', 'unsafe file types are refused');
select tests.refused(format($$select public.library_submit(null, tests.res('{"title":"Too big","link_url":null,"file_path":"%s","file_name":"a.pdf","file_size":99999999,"file_mime":"application/pdf","rights_confirmed":true}'), true)$$, tests.path(:yousef)), 'too large', 'huge files are refused');
select tests.refused(format($$select public.library_submit(null, tests.res('{"title":"Not mine","link_url":null,"file_path":"%s","file_name":"a.pdf","file_size":100,"file_mime":"application/pdf","rights_confirmed":true}'), true)$$, tests.path(:maya)), 'not yours', 'a file from someone else''s folder is refused');
select tests.refused($$select public.library_submit(null, tests.res('{"title":"x"}'), true)$$, 'title', 'a very short title is refused');

-- 2. Privacy before approval
select tests.login(:maya);
select tests.ok(not exists (select 1 from public.library_resources where id = current_setting('t.r1')::uuid), 'other students cannot see a pending resource');
select tests.ok(not exists (select 1 from public.library_revisions), 'other students cannot see anyone else''s submissions');
select tests.ok(public.library_file_info(current_setting('t.r1')::uuid, 'read') is null, 'no file access to a pending resource');
select tests.refused($$select public.library_review((select id from public.library_revisions limit 1), true, '', null)$$, 'only', 'students cannot approve');
select tests.refused($$select public.library_submit(current_setting('t.r1')::uuid, tests.res(), true)$$, 'cannot edit', 'students cannot edit someone else''s resource');
select tests.refused($$select public.library_delete(current_setting('t.r1')::uuid)$$, 'cannot delete', 'students cannot delete someone else''s resource');
select tests.refused($$select public.library_flag(current_setting('t.r1')::uuid, 'bad')$$, 'only', 'students cannot flag');
select tests.refused($$select public.library_official_save(null, tests.res())$$, 'only admins', 'students cannot add official resources');
select tests.refused($$select public.library_set_points(500)$$, 'only', 'students cannot change the points');
select tests.refused($$insert into public.library_resources (school_id, source, subject_id, title, type) select school_id, 'official', id, 'Hack', 'other' from public.study_categories limit 1$$, 'permission', 'students cannot write the table directly');
select tests.refused($$select file_path from public.library_resources$$, 'permission', 'the private file location is not readable');

-- 3. Review
select tests.login(:layla);
select tests.ok((select count(*) from public.library_revisions where status = 'pending') = 1, 'the Council sees pending submissions');
select tests.ok(public.library_file_info(current_setting('t.r1')::uuid, 'read') is null, 'a link-only resource has no file');
select tests.refused(format($$select public.library_review('%s', false, '', null)$$, (select id from public.library_revisions where status = 'pending')), 'explain', 'rejecting needs a reason');
select public.library_review((select id from public.library_revisions where status = 'pending'), false, 'Please add the chapter names to the description.', null);
select tests.ok((select status from public.library_revisions where resource_id = current_setting('t.r1')::uuid) = 'rejected', 'rejected with an explanation');
select tests.ok((select count(*) from public.library_decisions where resource_id = current_setting('t.r1')::uuid and decision = 'rejected') = 1, 'the decision is kept in the history');
select tests.refused(format($$select public.library_review('%s', true, '', null)$$, (select id from public.library_revisions limit 1)), 'already', 'a decided submission cannot be decided again');

select tests.login(:yousef);
select tests.ok(tests.notes(:yousef, 'library_rejected') = 1, 'the student is told it was rejected');
select tests.ok((select review_note from public.library_revisions where resource_id = current_setting('t.r1')::uuid) like '%chapter names%', 'the student sees the reason');
select public.library_submit(current_setting('t.r1')::uuid, tests.res('{"description":"Clear notes covering every algebra topic, chapters 1 to 6."}'), true);
select tests.ok((select count(*) from public.library_revisions where resource_id = current_setting('t.r1')::uuid) = 1 and
  (select status from public.library_revisions where resource_id = current_setting('t.r1')::uuid) = 'pending', 'edit and resubmit puts the same submission back in the queue');
select tests.ok(not exists (select 1 from public.library_revisions where reviewed_by is not null and status = 'pending'), 'resubmitting clears the old decision');

-- A reviewer cannot approve their own
select tests.login(:layla);
select set_config('t.own', public.library_submit(null, tests.res('{"title":"Council notes","link_url":"https://example.org/council"}'), true)::text, true);
select tests.refused(format($$select public.library_review('%s', true, '', null)$$, (select latest_revision_id from public.library_resources where id = current_setting('t.own')::uuid)), 'own', 'a reviewer cannot approve their own submission');

select tests.login(:rania);
select tests.ok((select count(*) from public.library_revisions where status = 'pending') = 2, 'admins see all pending submissions');
select tests.ok(tests.notes(:rania, 'library_pending') >= 2, 'reviewers are notified of new submissions');
select public.library_review((select latest_revision_id from public.library_resources where id = current_setting('t.own')::uuid), true, '', null);
select public.library_review((select latest_revision_id from public.library_resources where id = current_setting('t.r1')::uuid), true, 'Thanks!', null);
select tests.ok((select published_at is not null from public.library_resources where id = current_setting('t.r1')::uuid), 'approved resources are published');
select tests.ok((select source from public.library_resources where id = current_setting('t.r1')::uuid) = 'community', 'approved student resources carry the Community label');

-- 4. Points: once
reset role;
select tests.ok((select count(*) from public.points_ledger where profile_id = :yousef and reason = 'library_resource') = 1, 'points awarded on approval');
select tests.ok((select points from public.points_ledger where profile_id = :yousef and reason = 'library_resource') = 20, 'the default amount is 20');
select tests.login(:yousef);
select tests.ok(tests.notes(:yousef, 'library_approved') = 1 and tests.notes(:yousef, 'library_points') = 1, 'the student is told about approval and points');

-- editing an approved resource: live version stays, a new version waits for review, no extra points
select public.library_submit(current_setting('t.r1')::uuid, tests.res('{"title":"SAT Math Notes v2"}'), true);
select tests.ok((select count(*) from public.library_revisions where resource_id = current_setting('t.r1')::uuid) = 2, 'editing an approved resource creates a new version');
select tests.login(:maya);
select tests.ok((select title from public.library_resources where id = current_setting('t.r1')::uuid) = 'SAT Math Notes', 'the approved version stays visible while the edit waits');
select tests.login(:rania);
select tests.ok((select count(*) from public.library_revisions where resource_id = current_setting('t.r1')::uuid and status = 'pending') = 1, 'reviewers see the updated version to compare');
select public.library_review((select latest_revision_id from public.library_resources where id = current_setting('t.r1')::uuid), false, 'Keep the old title please.', null);
select tests.login(:maya);
select tests.ok((select title from public.library_resources where id = current_setting('t.r1')::uuid) = 'SAT Math Notes', 'a rejected update keeps the old approved version');
select tests.login(:yousef);
select public.library_submit(current_setting('t.r1')::uuid, tests.res('{"title":"SAT Math Notes v3"}'), true);
select tests.login(:rania);
select public.library_review((select latest_revision_id from public.library_resources where id = current_setting('t.r1')::uuid), true, '', null);
select tests.login(:maya);
select tests.ok((select title from public.library_resources where id = current_setting('t.r1')::uuid) = 'SAT Math Notes v3', 'an approved update replaces the live version');
reset role;
select tests.ok((select count(*) from public.points_ledger where profile_id = :yousef and reason = 'library_resource') = 1, 'editing never earns more points');

-- delete and re-share cannot farm points
select tests.login(:yousef);
select public.library_delete(current_setting('t.r1')::uuid);
select tests.login(:maya);
select tests.ok(not exists (select 1 from public.library_resources where id = current_setting('t.r1')::uuid), 'a deleted resource leaves public browsing');
select tests.login(:rania);
select tests.ok(exists (select 1 from public.library_resources where id = current_setting('t.r1')::uuid and deleted_at is not null), 'reviewers keep the history of a deleted resource');
select tests.ok((select count(*) from public.library_decisions where resource_id = current_setting('t.r1')::uuid) >= 3, 'decisions survive deletion');
select tests.login(:yousef);
select set_config('t.r2', public.library_submit(null, tests.res(), true)::text, true);
select tests.login(:rania);
select public.library_review((select latest_revision_id from public.library_resources where id = current_setting('t.r2')::uuid), true, '', null);
reset role;
select tests.ok((select count(*) from public.points_ledger where profile_id = :yousef and reason = 'library_resource') = 1, 'deleting and sharing the same resource again earns no new points');

-- 5. Points setting
select tests.login(:rania);
select public.library_set_points(25);
select tests.refused($$select public.library_set_points(1000)$$, '0 to 200', 'the points setting is limited');
select tests.login(:ahmad);
select set_config('t.r3', public.library_submit(null, tests.res('{"title":"Biology flashcards","link_url":"https://example.org/bio"}'), true)::text, true);
select tests.login(:layla);
select public.library_review((select latest_revision_id from public.library_resources where id = current_setting('t.r3')::uuid), true, '', null);
reset role;
select tests.ok((select points from public.points_ledger where profile_id = :ahmad and reason = 'library_resource') = 25, 'the configured amount is used');

-- 6. Ratings and top rated
select tests.login(:maya);
select public.library_rate(current_setting('t.r3')::uuid, 5, 'Very helpful');
select public.library_rate(current_setting('t.r3')::uuid, 4, null);
select tests.ok((select rating_count from public.library_resources where id = current_setting('t.r3')::uuid) = 1, 'one rating per student, updated in place');
select tests.ok((select rating_avg from public.library_resources where id = current_setting('t.r3')::uuid) = 4.00, 'the average follows the latest rating');
select tests.refused($$select public.library_rate(current_setting('t.r3')::uuid, 6, null)$$, '1 to 5', 'stars must be 1 to 5');
select tests.login(:ahmad);
select tests.refused($$select public.library_rate(current_setting('t.r3')::uuid, 5, null)$$, 'own', 'you cannot rate your own resource');
select tests.login(:khaled);
select public.library_rate(current_setting('t.r3')::uuid, 5, 'Great');
select tests.login(:yousef);
select public.library_rate(current_setting('t.r3')::uuid, 5, null);
select tests.login(:rania);
select public.library_rate(current_setting('t.r3')::uuid, 5, null);
select tests.login(:maya);
select public.library_rate(current_setting('t.r3')::uuid, 5, 'Very helpful');
select public.library_rate(current_setting('t.r2')::uuid, 5, null);
select tests.ok((select resource_id from public.library_top_rated(1)) = current_setting('t.r3')::uuid, 'top rated weighs the number of ratings, not just the average');
select tests.ok((select review_count from public.library_resources where id = current_setting('t.r3')::uuid) = 2, 'written reviews are counted');
select public.library_rate(current_setting('t.r3')::uuid, null, null);
select tests.ok((select rating_count from public.library_resources where id = current_setting('t.r3')::uuid) = 3, 'a student can remove their rating');

-- 7. Saving and statistics
select public.library_save(current_setting('t.r3')::uuid, true);
select tests.ok((select count(*) from public.library_saves) = 1, 'saving to My Library works');
select tests.login(:khaled);
select tests.ok((select count(*) from public.library_saves) = 0, 'My Library is private');
select public.library_track(current_setting('t.r3')::uuid, 'view');
select public.library_track(current_setting('t.r3')::uuid, 'view');
select tests.ok((select views_count from public.library_resources where id = current_setting('t.r3')::uuid) = 1, 'refreshing does not count extra views');
select tests.login(:ahmad);
select public.library_track(current_setting('t.r3')::uuid, 'view');
select tests.ok((select views_count from public.library_resources where id = current_setting('t.r3')::uuid) = 1, 'owners do not count as viewers');
select public.library_track(current_setting('t.r3')::uuid, 'download');
select tests.ok((select downloads_count from public.library_resources where id = current_setting('t.r3')::uuid) = 0, 'link resources have no downloads');

-- 8. Official library
select tests.login(:rania);
select set_config('t.o1', public.library_official_save(null, tests.res('{"title":"Official SAT Guide","link_url":"https://example.org/official-sat","downloadable":true}'))::text, true);
select tests.ok((select source from public.library_resources where id = current_setting('t.o1')::uuid) = 'official', 'admins add Official resources directly');
select tests.login(:maya);
select tests.ok((select published_at is not null from public.library_resources where id = current_setting('t.o1')::uuid), 'official resources are live immediately');
select tests.refused($$select public.library_delete(current_setting('t.o1')::uuid)$$, 'cannot delete', 'students cannot delete official resources');
select tests.login(:rania);
select public.library_official_save(current_setting('t.o1')::uuid, tests.res('{"title":"Official SAT Guide 2","link_url":"https://example.org/official-sat","downloadable":true}'));
select tests.ok((select title from public.library_resources where id = current_setting('t.o1')::uuid) = 'Official SAT Guide 2', 'admins edit Official resources');

-- 9. Flags are internal
select public.library_flag(current_setting('t.r3')::uuid, 'Looks copied from a textbook');
select tests.ok((select count(*) from public.library_flags where status = 'open') = 1, 'reviewers can flag');
select public.library_resolve_flag((select id from public.library_flags where status = 'open'), 'hidden', 'Checking the source.');
select tests.login(:maya);
select tests.ok(not exists (select 1 from public.library_resources where id = current_setting('t.r3')::uuid), 'a hidden resource disappears from browsing');
select tests.ok(not exists (select 1 from public.library_flags), 'students cannot see flags');
select tests.ok(not exists (select 1 from public.library_actions), 'students cannot see the audit record');
select tests.login(:layla);
select tests.ok((select count(*) from public.library_actions where resource_id = current_setting('t.r3')::uuid) >= 2, 'the audit record keeps the actions');
select public.library_restore(current_setting('t.r3')::uuid);
select tests.login(:maya);
select tests.ok(exists (select 1 from public.library_resources where id = current_setting('t.r3')::uuid), 'a restored resource is back');

-- 10. Other school
select tests.login('eeeeeeee-0000-0000-0000-0000000000b1');
select tests.ok(not exists (select 1 from public.library_resources), 'another school sees nothing');

rollback;
\echo done
