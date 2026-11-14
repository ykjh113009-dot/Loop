-- Study Hub tests: tutor applications (review workflow and privacy), academic resources, opportunities,
-- reward images and the Top 10 prizes. Runs inside one transaction that is rolled back. Run with:  npm run db:test
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
-- A complete application.
create function tests.app(p jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('grade', 'Grade 11', 'subjects', jsonb_build_array('SAT', 'AP Chemistry'), 'other_subjects', 'Latin, Chess',
    'achievements', 'Chemistry 96, SAT practice 1480', 'experience', 'Helped my cousins for two years', 'qualifications', 'Chemistry olympiad finalist',
    'intro', 'I like explaining chemistry step by step.', 'motivation', 'I want to help classmates feel confident before exams.',
    'topics', 'Stoichiometry, equilibrium', 'format', 'both', 'days', jsonb_build_array('mon', 'wed'), 'hours', '15:00-17:00',
    'preferred_times', 'After school', 'availability_notes', 'Not during exams') || p $$;
grant execute on all functions in schema tests to authenticated, anon;

\set rania '''00000000-0000-0000-0000-0000000000a1'''
\set omar  '''00000000-0000-0000-0000-0000000000a2'''
\set layla '''00000000-0000-0000-0000-0000000000a3'''
\set maya  '''00000000-0000-0000-0000-0000000000a5'''
\set ahmad '''00000000-0000-0000-0000-000000001001'''
\set khaled '''00000000-0000-0000-0000-000000001005'''

insert into public.schools (id, name, email_domain, google_only, admin_mfa_required)
values ('eeeeeeee-0000-0000-0000-00000000b001', 'Other School', 'other.example', false, false);
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated',
        'sam@other.example', '{"provider":"email"}', '{"full_name":"Sam Other"}', now(), now());
update public.profiles set onboarded_at = now(), grade = 10, section = 'A' where id = 'eeeeeeee-0000-0000-0000-0000000000b1';
-- Omar is only a moderator here. Layla is on the Student Council (and was already a tutor in the demo data).
delete from public.leadership_roles where profile_id = :omar and kind = 'council_member';
delete from public.leadership_roles where profile_id in (:maya, :ahmad, :khaled) and kind in ('council_member', 'school_staff');
select tests.login(:rania);
select public.assign_leadership_role(:layla, 'council_member', 'Secretary', null);
reset role;

-- ==== Tutors: the directory only lists approved tutors ============================================
select tests.login(:maya);
select tests.ok((select count(*) from public.tutor_profiles where approved_at is not null) >= 5, 'students see the approved tutors');
select tests.refused($$insert into public.tutor_profiles (profile_id, school_id, subjects) values (auth.uid(), public.my_school_id(), array['Math'])$$,
  'permission denied', 'a student cannot add themselves to the directory');
select tests.refused($$update public.tutor_profiles set active = false where profile_id = auth.uid()$$, 'permission denied', 'tutor profiles cannot be edited directly');
select tests.refused($$update public.tutor_applications set status = 'approved' where profile_id = auth.uid()$$, 'permission denied', 'a student cannot approve their own application');
select tests.refused($$insert into public.tutor_applications (school_id, profile_id, status) values (public.my_school_id(), auth.uid(), 'approved')$$,
  'permission denied', 'a student cannot create an approved application');
select tests.refused($$select public.update_tutor_profile('{"intro": "hello"}'::jsonb)$$, 'approved tutors', 'only approved tutors have a profile to edit');
select tests.refused($$select public.review_tutor_application(gen_random_uuid(), true, '')$$, 'admins and the Student Council', 'a student cannot review applications');

-- documents and drafts
select tests.refused($$select public.add_tutor_document('x/y/z.pdf', 'CV', 'cv', 1000)$$, 'not yours', 'a document must be in your own folder');
select tests.refused($$select public.add_tutor_document(public.my_school_id()::text || '/' || auth.uid()::text || '/cv.pdf', 'CV', 'resume', 1000)$$, 'kind of document', 'the document type must be valid');
select tests.refused($$select public.add_tutor_document(public.my_school_id()::text || '/' || auth.uid()::text || '/cv.pdf', 'CV', 'cv', 99999999)$$, '8 MB', 'documents have a size limit');
select public.add_tutor_document(public.my_school_id()::text || '/' || :maya || '/cv.pdf', 'My CV', 'cv', 120000) as doc1 \gset
select tests.ok((select status from public.tutor_applications where profile_id = :maya) = 'draft', 'adding a document starts a draft');
select tests.refused($$select public.save_tutor_application(tests.app('{"intro": "short"}'), true)$$, 'introduction', 'a short introduction cannot be submitted');
select tests.refused($$select public.save_tutor_application(tests.app('{"days": []}'), true)$$, 'days and hours', 'availability is required to submit');
select tests.refused($$select public.save_tutor_application(tests.app('{"subjects": [], "other_subjects": ""}'), true)$$, 'subject', 'a subject is required to submit');
select tests.refused($$select public.save_tutor_application(tests.app('{"intro": "You are a fuck head and more words"}'), false)$$, 'inappropriate', 'bad words are refused');
select tests.refused($$select public.save_tutor_application(tests.app('{"format": "telepathy"}'), false)$$, 'online', 'the format must be valid');
select tests.refused($$select public.save_tutor_application(tests.app('{"photo_path": "a/b/c.jpg"}'), false)$$, 'not yours', 'a profile photo must be your own');
select public.save_tutor_application(tests.app('{"intro": ""}'), false) as app \gset
select tests.ok((select count(*) from public.tutor_applications where profile_id = :maya) = 1, 'saving a draft keeps one application per student');
select tests.ok((select intro from public.tutor_applications where id = :'app') = '', 'drafts can be unfinished');
select public.save_tutor_application(tests.app(), true);
select tests.ok((select status from public.tutor_applications where id = :'app') = 'pending', 'a complete application goes to review');
select tests.refused($$select public.save_tutor_application(tests.app(), false)$$, 'waiting for review', 'a pending application cannot be changed');
select tests.refused($$select public.add_tutor_document(public.my_school_id()::text || '/' || auth.uid()::text || '/more.pdf', 'More', 'other', 100)$$, 'under review', 'documents cannot change during review');
select tests.refused($$select public.remove_tutor_document('$$ || :'doc1' || $$')$$, 'under review', 'documents cannot be removed during review');
select public.withdraw_tutor_application();
select tests.ok((select status from public.tutor_applications where id = :'app') = 'draft', 'an application can be taken back');
select public.save_tutor_application(tests.app(), true);
reset role;
select tests.ok(tests.notes(:layla, 'tutor_application') >= 1, 'reviewers are told about a new application');

-- privacy
select tests.login(:ahmad);
select tests.ok((select count(*) from public.tutor_applications where profile_id = :maya) = 0, 'other students cannot see applications');
select tests.ok((select count(*) from public.tutor_application_documents) = 0, 'other students cannot see documents');
select tests.ok((select count(*) from public.tutor_application_events) = 0, 'other students cannot see the history');
select tests.ok(not public.tutor_doc_viewer(public.my_school_id()::text || '/' || :maya || '/cv.pdf'), 'other students cannot open a document');
select tests.ok(not public.tutor_doc_uploader(public.my_school_id()::text || '/' || :maya || '/evil.pdf'), 'nobody can upload into someone else''s folder');
select tests.refused($$select public.review_tutor_application('$$ || :'app' || $$', true, '')$$, 'admins and the Student Council', 'an ordinary student cannot approve');
reset role;
select tests.login(:omar);
select tests.refused($$select public.review_tutor_application('$$ || :'app' || $$', true, '')$$, 'admins and the Student Council', 'a moderator cannot approve');
select tests.ok((select count(*) from public.tutor_applications where profile_id = :maya) = 0, 'a moderator cannot read applications');
reset role;
select tests.login(:maya);
select tests.ok(public.tutor_doc_viewer(public.my_school_id()::text || '/' || :maya || '/cv.pdf'), 'the applicant can open their own document');
reset role;
select tests.login(:layla);
select tests.ok((select count(*) from public.tutor_applications where profile_id = :maya) = 1, 'the Student Council can read applications');
select tests.ok((select count(*) from public.tutor_application_documents where profile_id = :maya) = 1, 'reviewers can see the documents');
select tests.ok(public.tutor_doc_viewer(public.my_school_id()::text || '/' || :maya || '/cv.pdf'), 'reviewers can open documents');

-- review
select tests.refused($$select public.review_tutor_application('$$ || :'app' || $$', false, '')$$, 'improve', 'a rejection needs feedback');
select public.review_tutor_application(:'app', false, 'Please add your latest chemistry grade.');
reset role;
select tests.ok((select status from public.tutor_applications where id = :'app') = 'rejected', 'reviewers can reject');
select tests.ok(not exists (select 1 from public.tutor_profiles where profile_id = :maya), 'a rejected student is not listed');
select tests.ok(tests.notes(:maya, 'tutor_rejected') = 1, 'the student is told');
select tests.login(:maya);
select tests.ok((select review_note from public.tutor_applications where id = :'app') like '%chemistry grade%', 'the applicant can read the feedback');
select public.save_tutor_application(tests.app('{"achievements": "Chemistry 96, SAT 1480, olympiad"}'), true);
select tests.ok((select status from public.tutor_applications where id = :'app') = 'pending', 'a rejected application can be edited and resubmitted');
reset role;
select tests.login(:layla);
select public.review_tutor_application(:'app', true, 'Welcome!');
reset role;
select tests.ok((select status from public.tutor_applications where id = :'app') = 'approved', 'reviewers can approve');
select tests.ok(exists (select 1 from public.tutor_profiles where profile_id = :maya and approved_at is not null and active
  and 'Latin' = any (subjects) and 'SAT' = any (subjects) and format = 'both'), 'approval publishes the public profile with the extra subjects');
select tests.ok((select count(*) from public.tutor_application_events where application_id = :'app' and action in ('reject', 'resubmit', 'approve')) = 3, 'the history keeps the earlier rejection');
select tests.ok(tests.notes(:maya, 'tutor_approved') = 1, 'the student is told they are approved');
select tests.login(:maya);
select tests.refused($$select public.save_tutor_application(tests.app(), true)$$, 'already an approved tutor', 'an approved tutor cannot apply again');
select public.update_tutor_profile('{"intro": "Chemistry made easy.", "format": "online", "days": ["tue"], "hours": "16:00-18:00", "active": true}'::jsonb);
select tests.ok((select about from public.tutor_profiles where profile_id = :maya) = 'Chemistry made easy.' and (select format from public.tutor_profiles where profile_id = :maya) = 'online',
  'an approved tutor can complete their public profile');
reset role;
select tests.login(:ahmad);
select tests.ok(exists (select 1 from public.tutor_profiles where profile_id = :maya), 'other students can see the approved tutor');
select tests.ok(public.request_tutoring(:maya, 'SAT', 'Can you help me with the math section?') is not null, 'students can ask an approved tutor for help');
reset role;
select tests.login(:maya);
select public.update_tutor_profile('{"intro": "Chemistry made easy.", "format": "online", "days": ["tue"], "hours": "16:00-18:00", "active": false}'::jsonb);
reset role;
select tests.login(:khaled);
select tests.ok(not exists (select 1 from public.tutor_profiles where profile_id = :maya and active), 'a paused tutor is not available');
select tests.refused($$select public.request_tutoring('$$ || :maya || $$', 'SAT', 'hello there')$$, 'not available', 'nobody can ask a paused tutor');
reset role;

-- a council member who applies needs someone else to review
select tests.login(:layla);
select tests.ok((select count(*) from public.tutor_profiles where profile_id = :layla) = 1, 'existing tutors stay listed');
reset role;
select tests.login(:khaled);
select public.save_tutor_application(tests.app(), true) as app2 \gset
reset role;
select tests.login(:khaled);
select tests.refused($$select public.review_tutor_application('$$ || :'app2' || $$', true, '')$$, 'admins and the Student Council', 'a student cannot approve even their own');
reset role;
select tests.login(:rania);
select public.review_tutor_application(:'app2', true, '');
reset role;
select tests.ok(exists (select 1 from public.tutor_profiles where profile_id = :khaled), 'admins can approve too');

-- ==== Academic resources ======================================================================
select tests.login(:ahmad);
select tests.ok((select count(*) from public.study_categories) = 6, 'every school starts with its subject categories');
select id as sat from public.study_categories where slug = 'sat' \gset
select tests.refused($$select public.add_study_resource('$$ || :'sat' || $$', '{"title": "SAT guide", "url": "https://example.org/sat"}'::jsonb)$$, 'Only admins', 'an ordinary student cannot add materials');
reset role;
select tests.login(:khaled);
select public.add_study_resource(:'sat', '{"title": "SAT practice sets", "url": "https://example.org/sat", "kind": "practice", "description": "Free practice questions"}'::jsonb) as res1 \gset
select tests.refused($$select public.add_study_resource('$$ || :'sat' || $$', '{"title": "Bad link", "url": "javascript:alert(1)"}'::jsonb)$$, 'https', 'only web links are accepted');
select tests.refused($$select public.add_study_resource('$$ || :'sat' || $$', '{"title": "Bad kind", "url": "https://example.org", "kind": "movie"}'::jsonb)$$, 'type', 'the type must be valid');
select tests.refused($$select public.add_study_category('Latin', '📜')$$, 'Only admins', 'only admins add a subject');
reset role;
select tests.login(:ahmad);
select tests.ok((select count(*) from public.study_resources where category_id = :'sat') = 1, 'students can read the materials');
select tests.refused($$select public.remove_study_resource('$$ || :'res1' || $$')$$, 'cannot remove', 'a student cannot remove someone else''s material');
reset role;
select tests.login(:rania);
select public.add_study_category('Latin', '📜');
select tests.refused($$select public.add_study_category('Latin', '📜')$$, 'already exists', 'a subject cannot be added twice');
select tests.ok((select count(*) from public.study_categories where slug = 'latin') = 1, 'admins can add a subject');
select public.remove_study_resource(:'res1');
reset role;
select tests.ok((select count(*) from public.study_resources) = 0, 'admins can remove a material');

-- ==== University and opportunities ===============================================================
select tests.login(:ahmad);
select tests.refused($$select public.save_study_opportunity(null, '{"category": "scholarships", "title": "Sneaky"}'::jsonb)$$, 'Only admins', 'a student cannot add an opportunity');
reset role;
select tests.login(:layla);
select public.save_study_opportunity(null, jsonb_build_object('category', 'scholarships', 'title', 'Sample scholarship', 'organization', 'Sample foundation',
  'description', 'A clearly marked sample.', 'eligibility', 'Grade 11', 'deadline', (current_date + 30)::text, 'link', 'https://example.org/apply',
  'is_sample', true, 'documents', jsonb_build_array(jsonb_build_object('label', 'Form', 'url', 'https://example.org/form.pdf'),
  jsonb_build_object('label', 'Bad', 'url', 'javascript:alert(1)')))) as o1 \gset
select tests.ok((select jsonb_array_length(documents) from public.study_opportunities where id = :'o1') = 1, 'only safe document links are kept');
select tests.refused($$select public.save_study_opportunity(null, '{"category": "parties", "title": "Nope"}'::jsonb)$$, 'category', 'the category must be valid');
select tests.refused($$select public.save_study_opportunity(null, '{"category": "other", "title": "Bad link", "link": "ftp://x"}'::jsonb)$$, 'https', 'the application link must be a web link');
select public.save_study_opportunity(null, '{"category": "summer", "title": "Hidden program", "status": "hidden"}'::jsonb) as o2 \gset
reset role;
select tests.login(:ahmad);
select tests.ok((select count(*) from public.study_opportunities where id = :'o1') = 1 and (select is_sample from public.study_opportunities where id = :'o1'), 'students see opportunities, sample data is labelled');
select tests.ok((select count(*) from public.study_opportunities where id = :'o2') = 0, 'hidden opportunities are not shown to students');
select tests.refused($$select public.delete_study_opportunity('$$ || :'o1' || $$')$$, 'Only admins', 'a student cannot delete an opportunity');
reset role;
select tests.login(:rania);
select public.delete_study_opportunity(:'o2');
reset role;
select tests.ok((select count(*) from public.study_opportunities where id = :'o2') = 0, 'staff can delete an opportunity');
select tests.login('eeeeeeee-0000-0000-0000-0000000000b1');
select tests.ok((select count(*) from public.study_opportunities) = 0 and (select count(*) from public.tutor_applications) = 0 and (select count(*) from public.study_categories) = 6,
  'another school sees none of this school''s data');
reset role;

-- ==== Rewards shop: images and Top 10 prizes ======================================================
select tests.login(:ahmad);
select tests.refused($$select public.set_top10_prize(1, 'Gold trophy', '')$$, 'Only admins', 'a student cannot set Top 10 prizes');
select tests.refused($$select public.set_top10_settings('all', 'x')$$, 'Only admins', 'a student cannot change the Top 10 rules');
select tests.refused($$insert into public.top10_prizes (school_id, place, title) values (public.my_school_id(), 1, 'Mine')$$, 'permission denied', 'Top 10 prizes cannot be inserted directly');
reset role;
select tests.login(:rania);
select public.set_top10_prize(1, 'Pizza party for you and 3 friends', 'Held at the end of the month');
select public.set_top10_prize(2, 'Cinema tickets', '');
select tests.refused($$select public.set_top10_prize(11, 'x', '')$$, 'place', 'places run from 1 to 10');
select public.set_top10_settings('all', 'Be in the top 10 students by points to win.');
select public.set_top10_prize(2, '', '');
select tests.refused($$insert into public.rewards (school_id, name, cost, kind, image_path, created_by) values (public.my_school_id(), 'Mug', 50, 'prize', 'x/y/z.jpg', auth.uid())$$, 'not yours', 'a reward image must be your own upload');
insert into public.rewards (school_id, name, cost, kind, image_path, created_by)
values (public.my_school_id(), 'School mug', 50, 'prize', public.my_school_id()::text || '/' || :rania || '/mug.jpg', auth.uid());
reset role;
select tests.login(:ahmad);
select tests.ok((select count(*) from public.top10_prizes) = 1 and (select period from public.top10_settings) = 'all', 'students can read the Top 10 prizes and rules');
select tests.ok(exists (select 1 from public.rewards where name = 'School mug' and image_path is not null), 'rewards can have an image');
select tests.ok((select count(*) from public.individual_leaderboard('all', null, 10)) <= 10, 'the Top 10 uses the existing ranking');
reset role;
select tests.login('eeeeeeee-0000-0000-0000-0000000000b1');
select tests.ok((select count(*) from public.top10_prizes) = 0, 'another school sees no Top 10 prizes');
reset role;

rollback;
