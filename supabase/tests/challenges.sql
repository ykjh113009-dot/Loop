-- Loop Challenges tests. Runs inside one transaction that is rolled back, so it never changes the database.
-- Run with:  npm run db:test
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
-- A normal challenge idea; pass overrides.
create function tests.base(p jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('title', 'Photo hunt', 'description', 'Find the hidden spots around the school and photograph them.',
    'category', 'creative', 'kind', 'real_life', 'starts_at', now() - interval '1 hour', 'ends_at', now() + interval '7 days',
    'points', 50, 'proof_kinds', jsonb_build_array('photo', 'text'), 'safety_confirmed', true) || p $$;
grant execute on all functions in schema tests to authenticated, anon;

\set rania '''00000000-0000-0000-0000-0000000000a1'''
\set omar  '''00000000-0000-0000-0000-0000000000a2'''
\set layla '''00000000-0000-0000-0000-0000000000a3'''
\set yousef '''00000000-0000-0000-0000-0000000000a4'''
\set maya  '''00000000-0000-0000-0000-0000000000a5'''
\set ahmad '''00000000-0000-0000-0000-000000001001'''

insert into public.schools (id, name, email_domain, google_only, admin_mfa_required)
values ('eeeeeeee-0000-0000-0000-00000000b001', 'Other School', 'other.example', false, false);
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated',
        'sam@other.example', '{"provider":"email"}', '{"full_name":"Sam Other"}', now(), now());
update public.profiles set onboarded_at = now(), grade = 10, section = 'A' where id = 'eeeeeeee-0000-0000-0000-0000000000b1';
delete from public.points_ledger where profile_id in (:layla, :yousef, :maya, :ahmad);

-- Omar is only a moderator here (not on the Council). Layla is on the Student Council.
delete from public.leadership_roles where profile_id = :omar and kind = 'council_member';
select tests.login(:rania);
select public.assign_leadership_role(:layla, 'council_member', 'Secretary', null);
reset role;

-- ==== Creating and the publishing review =============================================
select tests.login(:yousef);
select tests.refused($$insert into public.challenges (school_id, title, created_by, starts_at, ends_at) values (public.my_school_id(), 'Sneaky', auth.uid(), now(), now() + interval '1 day')$$,
  'permission denied', 'nobody can insert a challenge directly');
select public.save_challenge(null, tests.base(), false) as c1 \gset
select tests.ok((select status from public.challenges where id = :'c1') = 'draft', 'a new challenge starts as a draft');
select tests.refused($$update public.challenges set status = 'approved' where id = '$$ || :'c1' || $$'$$, 'permission denied', 'a creator cannot approve their own challenge');
select tests.refused($$select public.save_challenge(null, tests.base('{"safety_confirmed": false}'), true)$$, 'safe', 'the safety confirmation is required to send a challenge');
select tests.refused($$select public.save_challenge(null, tests.base('{"title": "You fuck"}'), false)$$, 'inappropriate', 'bad words are refused in a challenge');
select tests.refused($$select public.save_challenge(null, tests.base('{"proof_kinds": ["answers"]}'), true)$$, 'question', 'a quiz challenge needs questions');
select tests.refused($$select public.save_challenge(null, tests.base('{"points": 3}'), true)$$, 'at least 5', 'a fixed reward has a minimum');
select tests.refused($$select public.save_challenge(null, tests.base('{"ends_at": "2020-01-01T00:00:00Z", "starts_at": "2019-12-01T00:00:00Z"}'), true)$$, 'future', 'the deadline must be in the future');
select tests.refused($$select public.save_challenge(null, tests.base('{"audience": "grade"}'), true)$$, 'grade', 'a grade challenge needs a grade');
select tests.refused($$select public.save_challenge(null, tests.base('{"cover_path": "x/y/z.jpg"}'), false)$$, 'not yours', 'a cover photo must be your own upload');
select public.save_challenge(:'c1', tests.base('{"title": "Photo hunt v2"}'), true);
select tests.ok((select status from public.challenges where id = :'c1') = 'pending', 'sending a challenge puts it in review');
select tests.refused($$select public.save_challenge('$$ || :'c1' || $$', tests.base(), false)$$, 'only edit a draft', 'a challenge in review cannot be edited');
select tests.ok((select count(*) from public.challenges where id = :'c1') = 1, 'the creator sees their pending challenge');
reset role;

select tests.login(:maya);
select tests.ok((select count(*) from public.challenges where id = :'c1') = 0, 'other students cannot see a pending challenge');
select tests.refused($$select public.join_challenge('$$ || :'c1' || $$')$$, 'not available', 'nobody can join a challenge before it is approved');
select tests.refused($$select public.review_challenge_idea('$$ || :'c1' || $$', true, '', true)$$, 'Student Council or an admin', 'a student cannot approve a challenge idea');
reset role;
select tests.login(:omar);
select tests.refused($$select public.review_challenge_idea('$$ || :'c1' || $$', true, '', true)$$, 'Student Council or an admin', 'a moderator cannot approve a challenge idea');
select tests.ok((select count(*) from public.challenges where id = :'c1') = 1, 'moderators can see challenges that are waiting');
reset role;

select tests.login(:layla);
select tests.refused($$select public.review_challenge_idea('$$ || :'c1' || $$', true, '', false)$$, 'safe', 'the safety check must be confirmed to approve');
select tests.refused($$select public.review_challenge_idea('$$ || :'c1' || $$', false, '', true)$$, 'what to change', 'a rejection needs feedback');
select public.review_challenge_idea(:'c1', false, 'Please add a safety rule about staying off the roof.', true);
select tests.ok((select status from public.challenges where id = :'c1') = 'rejected', 'the Council can reject an idea');
reset role;
select tests.login(:yousef);
select tests.ok((select review_note from public.challenges where id = :'c1') like '%roof%', 'the creator sees the feedback');
select public.save_challenge(:'c1', tests.base('{"rules": "Stay on the ground floor."}'), true);
select tests.ok((select status from public.challenges where id = :'c1') = 'pending', 'a rejected challenge can be improved and sent again');
reset role;
select tests.login(:layla);
select public.review_challenge_idea(:'c1', true, 'Looks fun', true);
select tests.ok((select status from public.challenges where id = :'c1') = 'approved', 'the Council can approve an idea');
select tests.ok((select count(*) from public.challenge_reviews where challenge_id = :'c1' and subject = 'idea') = 4, 'every step is in the history (submit, reject, submit, approve)');
reset role;

-- a council member cannot approve their own idea, an admin can
select tests.login(:layla);
select public.save_challenge(null, tests.base('{"title": "Council quiz"}'), true) as c_own \gset
select tests.refused($$select public.review_challenge_idea('$$ || :'c_own' || $$', true, '', true)$$, 'Another reviewer', 'a council member cannot approve their own idea');
reset role;
select tests.login(:rania);
select public.review_challenge_idea(:'c_own', true, '', true);
select tests.ok((select status from public.challenges where id = :'c_own') = 'approved', 'an admin can approve');
select public.save_challenge(null, tests.base('{"title": "Big prize", "reward_mode": "ranked", "points": 0, "prizes": [{"points": 250}, {"points": 100}]}'), true) as c_big \gset
reset role;
select tests.login(:layla);
select tests.refused($$select public.review_challenge_idea('$$ || :'c_big' || $$', true, '', true)$$, 'above 100', 'only an admin approves prizes above 100 points');
reset role;

-- ==== Audience and joining ================================================================
select tests.login(:yousef);
select public.save_challenge(null, tests.base('{"title": "Grade 10 only", "audience": "grade", "audience_grade": 10}'), true) as c_g10 \gset
select public.save_challenge(null, tests.base('{"title": "Tiny", "max_participants": 1}'), true) as c_cap \gset
reset role;
select tests.login(:layla);
select public.review_challenge_idea(:'c_g10', true, '', true);
select public.review_challenge_idea(:'c_cap', true, '', true);
reset role;
select tests.login(:maya);
select tests.ok((select count(*) from public.challenges where id = :'c_g10') = 0, 'a grade challenge is hidden from other grades');
select tests.refused($$select public.join_challenge('$$ || :'c_g10' || $$')$$, 'not available', 'other grades cannot join a grade challenge');
reset role;
select tests.login(:ahmad);
select tests.ok((select count(*) from public.challenges where id = :'c_g10') = 1, 'the right grade sees it');
select public.join_challenge(:'c_g10');
reset role;
select tests.login(:yousef);
select tests.refused($$select public.join_challenge('$$ || :'c1' || $$')$$, 'your own', 'you cannot join your own challenge');
reset role;
select tests.login(:maya);
select public.join_challenge(:'c_cap');
select public.join_challenge(:'c_cap');
select tests.ok((select count(*) from public.challenge_participants where challenge_id = :'c_cap' and profile_id = :maya) = 1, 'joining twice does nothing');
reset role;
select tests.login(:ahmad);
select tests.refused($$select public.join_challenge('$$ || :'c_cap' || $$')$$, 'full', 'the participant limit is enforced');
reset role;

-- ==== Sending proof ========================================================================
select tests.login(:maya);
select tests.refused($$select public.submit_challenge('$$ || :'c1' || $$', 'I did it', null, null, null)$$, 'Join the challenge', 'you must join before sending proof');
select public.join_challenge(:'c1');
select tests.refused($$select public.submit_challenge('$$ || :'c1' || $$', 'I did it', null, null, null)$$, 'photo', 'a photo is required when the challenge asks for one');
select tests.refused($$select public.submit_challenge('$$ || :'c1' || $$', 'I did it', 'aaaa/bbbb/cccc/x.jpg', null, null)$$, 'photo', 'a photo from someone else''s folder is refused');
select tests.refused($$select public.submit_challenge('$$ || :'c1' || $$', 'ok', public.my_school_id()::text || '/' || '$$ || :'c1' || $$' || '/' || auth.uid()::text || '/a.jpg', null, null)$$, 'short description', 'a text answer is required when the challenge asks for it');
select public.submit_challenge(:'c1', 'Found the old tree and the library door',
  public.my_school_id()::text || '/' || :'c1' || '/' || :maya || '/a.jpg', null, null) as s1 \gset
select tests.ok((select status from public.challenge_submissions where id = :'s1') = 'submitted', 'a new entry is "submitted"');
select tests.refused($$select public.submit_challenge('$$ || :'c1' || $$', 'Again please',
  public.my_school_id()::text || '/' || '$$ || :'c1' || $$' || '/' || auth.uid()::text || '/b.jpg', null, null)$$, 'still being checked', 'you cannot send a second entry while one is waiting');
select tests.refused($$insert into public.challenge_submissions (school_id, challenge_id, profile_id, note) values (public.my_school_id(), '$$ || :'c1' || $$', auth.uid(), 'direct')$$, 'permission denied', 'entries cannot be inserted directly');
select tests.refused($$update public.challenge_submissions set status = 'approved' where id = '$$ || :'s1' || $$'$$, 'permission denied', 'a student cannot approve their own entry');
select tests.refused($$insert into public.points_ledger (school_id, profile_id, points, reason, source_id) values (public.my_school_id(), auth.uid(), 99, 'challenge', gen_random_uuid())$$, 'permission denied', 'a student cannot give themselves points');
reset role;

-- privacy of proof
select tests.login(:ahmad);
select tests.ok((select count(*) from public.challenge_submissions where id = :'s1') = 0, 'other students cannot see someone''s proof');
select tests.ok((select count(*) from public.challenge_participants where challenge_id = :'c1') = 0, 'other students cannot list participants');
select tests.ok(not public.challenge_proof_viewer(public.my_school_id()::text || '/' || :'c1' || '/' || :maya || '/a.jpg'), 'other students cannot open proof files');
reset role;
select tests.login(:maya);
select tests.ok(public.challenge_proof_viewer(public.my_school_id()::text || '/' || :'c1' || '/' || :maya || '/a.jpg'), 'the student can open their own proof file');
select tests.ok(public.challenge_proof_uploader(public.my_school_id()::text || '/' || :'c1' || '/' || :maya || '/c.jpg'), 'a participant can upload into their folder');
select tests.ok(not public.challenge_proof_uploader(public.my_school_id()::text || '/' || :'c1' || '/' || :ahmad || '/c.jpg'), 'nobody can upload into someone else''s folder');
select tests.ok(public.challenge_proof_uploader(public.my_school_id()::text || '/' || :'c_cap' || '/' || :maya || '/c.jpg'), 'a participant can upload for a challenge they joined');
select tests.ok(not public.challenge_proof_uploader('not-a-path'), 'a malformed path is refused without an error');
reset role;
select tests.login(:yousef);
select tests.ok((select count(*) from public.challenge_submissions where id = :'s1') = 1, 'the creator sees the entries');
select tests.ok((select count(*) from public.challenge_participants where challenge_id = :'c1') = 1, 'the creator sees the participants');
select tests.ok(public.challenge_proof_viewer(public.my_school_id()::text || '/' || :'c1' || '/' || :maya || '/a.jpg'), 'the creator can open proof files');
reset role;
select tests.login('eeeeeeee-0000-0000-0000-0000000000b1');
select tests.ok((select count(*) from public.challenges) = 0, 'another school sees no challenges');
reset role;

-- ==== Checking proof and points ====================================================================
select tests.login(:maya);
select tests.refused($$select public.review_challenge_submission('$$ || :'s1' || $$', true, '')$$, 'cannot check', 'a student cannot check entries');
reset role;
select tests.login(:yousef);
select public.claim_challenge_submission(:'s1');
select tests.ok((select status from public.challenge_submissions where id = :'s1') = 'pending', 'starting a check marks the entry "pending verification"');
select tests.refused($$select public.review_challenge_submission('$$ || :'s1' || $$', false, '')$$, 'why', 'a rejection needs a reason');
select public.review_challenge_submission(:'s1', false, 'The photo is blurry, please try again.');
select tests.ok((select status from public.challenge_submissions where id = :'s1') = 'rejected', 'the creator can reject an entry');
reset role;
select tests.ok(tests.pts(:maya, 'challenge') = 0, 'a rejected entry earns nothing');
select tests.login(:maya);
select tests.ok((select review_note from public.challenge_submissions where id = :'s1') like '%blurry%', 'the student sees why it was rejected');
select public.submit_challenge(:'c1', 'Here is a clear photo this time',
  public.my_school_id()::text || '/' || :'c1' || '/' || :maya || '/b.jpg', null, null) as s2 \gset
select tests.ok((select attempt from public.challenge_submissions where id = :'s2') = 2, 'a rejected student can try again');
reset role;
select tests.login(:yousef);
select public.review_challenge_submission(:'s2', true, 'Great!');
select tests.refused($$select public.review_challenge_submission('$$ || :'s2' || $$', true, '')$$, 'already the decision', 'approving twice is refused');
reset role;
select tests.ok(tests.pts(:maya, 'challenge') = 50, 'an approved entry gives the fixed reward once');
select tests.login(:maya);
select tests.ok((select points_awarded from public.challenge_submissions where id = :'s2') = 50, 'the student sees the points on the entry');
select tests.ok((select count(*) from public.challenge_point_log where profile_id = :maya and kind = 'award') = 1, 'the award is in the point history');
select tests.refused($$select public.submit_challenge('$$ || :'c1' || $$', 'More points please',
  public.my_school_id()::text || '/' || '$$ || :'c1' || $$' || '/' || auth.uid()::text || '/c.jpg', null, null)$$, 'used all your attempts', 'a one-time challenge cannot be repeated');
reset role;

-- the creator cannot change a decision; the Council can
select tests.login(:yousef);
select tests.refused($$select public.review_challenge_submission('$$ || :'s2' || $$', false, 'changed my mind')$$, 'Student Council or an admin', 'a creator cannot change a decision');
reset role;
select tests.login(:layla);
select tests.refused($$select public.review_challenge_submission('$$ || :'s2' || $$', false, '')$$, 'Explain', 'changing a decision needs a reason');
select public.review_challenge_submission(:'s2', false, 'Photo was taken from the internet.');
reset role;
select tests.ok(tests.pts(:maya, 'challenge') = 0, 'overriding to rejected takes the points back');
select tests.ok((select count(*) from public.challenge_point_log where profile_id = :maya and kind = 'revoke') = 1, 'the reversal is in the point history');
select tests.login(:layla);
select public.review_challenge_submission(:'s2', true, 'Checked again, it is original.');
select public.review_challenge_submission(:'s2', false, 'Final decision.');
select public.review_challenge_submission(:'s2', true, 'Sorry, it was fine.');
reset role;
select tests.ok(tests.pts(:maya, 'challenge') = 50, 'points are never paid twice, even after reversals');
select tests.ok((select count(*) from public.points_ledger where profile_id = :maya and reason = 'challenge') = 1, 'the points ledger has one row for the entry');
select tests.ok((select count(*) from public.challenge_reviews where submission_id = :'s2' and action like 'override%') = 4, 'every override is recorded');
select tests.ok((select overridden from public.challenge_submissions where id = :'s2'), 'an overridden entry is flagged');
select tests.login(:maya);
select tests.refused($$delete from public.challenge_reviews$$, 'permission denied', 'the history cannot be deleted');
select tests.refused($$update public.challenge_point_log set points = 1000$$, 'permission denied', 'the point history cannot be edited');
reset role;

-- ==== Repeat participation ===========================================================================
select tests.login(:yousef);
select public.save_challenge(null, tests.base('{"title": "Daily reading", "proof_kinds": ["text"], "attempts_per_student": 3, "rewards_per_student": 2, "points": 10}'), true) as c_rep \gset
reset role;
select tests.login(:layla);
select public.review_challenge_idea(:'c_rep', true, '', true);
reset role;
select tests.login(:ahmad);
select public.join_challenge(:'c_rep');
select public.submit_challenge(:'c_rep', 'Read chapter one', null, null, null) as r1 \gset
reset role;
select tests.login(:yousef);
select public.review_challenge_submission(:'r1', true, '');
reset role;
select tests.login(:ahmad);
select public.submit_challenge(:'c_rep', 'Read chapter two', null, null, null) as r2 \gset
reset role;
select tests.login(:yousef);
select public.review_challenge_submission(:'r2', true, '');
reset role;
select tests.login(:ahmad);
select public.submit_challenge(:'c_rep', 'Read chapter three', null, null, null) as r3 \gset
reset role;
select tests.login(:yousef);
select public.review_challenge_submission(:'r3', true, '');
reset role;
select tests.ok(tests.pts(:ahmad, 'challenge') = 20, 'only the allowed number of attempts are rewarded (2 x 10)');
select tests.login(:ahmad);
select tests.refused($$select public.submit_challenge('$$ || :'c_rep' || $$', 'Chapter four', null, null, null)$$, 'used all your attempts', 'attempts are limited');
reset role;

-- ==== Quiz answers ====================================================================================
select tests.login(:yousef);
select public.save_challenge(null, tests.base('{"title": "School quiz", "kind": "digital", "proof_kinds": ["answers"], "questions": ["What year was the school founded?", "Who is the head teacher?"], "points": 15}'), true) as c_q \gset
reset role;
select tests.login(:layla);
select public.review_challenge_idea(:'c_q', true, '', true);
reset role;
select tests.login(:maya);
select public.join_challenge(:'c_q');
select tests.refused($$select public.submit_challenge('$$ || :'c_q' || $$', '', null, null, array['1990'])$$, 'Answer every question', 'every question needs an answer');
select public.submit_challenge(:'c_q', '', null, null, array['1990', 'Mr Ali']) as q1 \gset
select tests.ok((select answers from public.challenge_submissions where id = :'q1') = array['1990', 'Mr Ali'], 'quiz answers are saved');
reset role;

-- ==== Ranked rewards =====================================================================================
select tests.login(:rania);
select public.save_challenge(null, tests.base('{"title": "Sprint race", "kind": "real_life", "proof_kinds": ["text"], "reward_mode": "ranked", "points": 5, "prizes": [{"points": 100}, {"points": 75}, {"points": 50}]}'), true) as c_rank \gset
select public.review_challenge_idea(:'c_rank', true, '', true);
select tests.ok((select count(*) from public.challenge_prizes where challenge_id = :'c_rank') = 3, 'a ranked challenge stores its prizes');
reset role;
select tests.login(:layla);
select public.join_challenge(:'c_rank');
select public.submit_challenge(:'c_rank', 'Finished in 12.1 seconds', null, null, null) as k1 \gset
reset role;
select tests.login(:maya);
select public.join_challenge(:'c_rank');
select public.submit_challenge(:'c_rank', 'Finished in 12.8 seconds', null, null, null) as k2 \gset
reset role;
select tests.login(:yousef);
select public.join_challenge(:'c_rank');
select public.submit_challenge(:'c_rank', 'Finished in 13.5 seconds', null, null, null) as k3 \gset
reset role;
select tests.login(:rania);
select public.review_challenge_submission(:'k1', true, '');
select public.review_challenge_submission(:'k2', true, '');
select tests.refused($$select public.rank_challenge('$$ || :'c_rank' || $$', array['$$ || :'k1' || $$']::uuid[])$$, 'after the deadline', 'winners cannot be set before the deadline');
reset role;
update public.challenges set starts_at = now() - interval '3 days', ends_at = now() - interval '1 hour' where id = :'c_rank';
select tests.login(:rania);
select tests.refused($$select public.rank_challenge('$$ || :'c_rank' || $$', array['$$ || :'k3' || $$']::uuid[])$$, 'approved entries', 'only approved entries can win');
select tests.refused($$select public.rank_challenge('$$ || :'c_rank' || $$', array['$$ || :'k1' || $$', '$$ || :'k1' || $$']::uuid[])$$, 'one place', 'a student cannot take two places');
select public.rank_challenge(:'c_rank', array[:'k2', :'k1']::uuid[]);
reset role;
select tests.ok(tests.pts(:maya, 'challenge_rank') = 100 and tests.pts(:layla, 'challenge_rank') = 75, 'places get their prize points');
select tests.ok(tests.pts(:maya, 'challenge') = 55, 'a ranked challenge can also pay a small participation reward');
select tests.login(:rania);
select tests.refused($$select public.rank_challenge('$$ || :'c_rank' || $$', array['$$ || :'k2' || $$']::uuid[])$$, 'already', 'winners can only be chosen once');
select public.review_challenge_submission(:'k2', false, 'Disqualified: false start.');
reset role;
select tests.ok(tests.pts(:maya, 'challenge_rank') = 0 and tests.pts(:maya, 'challenge') = 50, 'disqualifying a winner takes back their prize and participation points');

-- ==== Cancelling, reporting, warning signs ==================================================================
select tests.login(:maya);
select tests.refused($$select public.cancel_challenge('$$ || :'c_cap' || $$', 'nope')$$, 'creator', 'a student cannot cancel someone else''s challenge');
insert into public.reports (reporter_id, target_type, target_id, reason, school_id) values (auth.uid(), 'challenge', :'c_cap', 'inappropriate', public.my_school_id());
reset role;
select tests.ok((select count(*) from public.reports where target_type = 'challenge' and status = 'open') = 1, 'a challenge can be reported');
select tests.login(:omar);
select public.moderate_report((select id from public.reports where target_type = 'challenge'), 'remove', 'Not allowed');
reset role;
select tests.ok((select status from public.challenges where id = :'c_cap') = 'cancelled', 'removing a reported challenge cancels it');
select tests.login(:yousef);
select public.cancel_challenge(:'c_rep', 'Finished early');
select tests.ok((select status from public.challenges where id = :'c_rep') = 'cancelled', 'a creator can cancel their challenge');
select tests.ok((select count(*) from public.challenge_counts(array[:'c_g10']::uuid[])) = 1, 'counts are available for approved challenges');
select tests.refused($$select * from public.challenge_flags()$$, 'reviewers', 'students cannot see warning signs');
reset role;
select tests.login(:layla);
select tests.ok((select count(*) from public.challenge_flags()) >= 0, 'the Council can see warning signs');
select tests.ok((public.challenge_stats(:'c_rank')::jsonb ->> 'participants')::int = 3, 'reviewers see challenge numbers');
reset role;
select tests.login(:ahmad);
select tests.refused($$select public.challenge_stats('$$ || :'c_rank' || $$')$$, 'cannot see', 'students cannot see another challenge''s numbers');
select tests.refused($$select public.rank_challenge('$$ || :'c_rank' || $$', array[]::uuid[])$$, 'cannot rank', 'students cannot rank a challenge');
reset role;
select tests.login(:yousef);
select tests.ok((select count(*) from public.challenge_reviews where challenge_id = :'c1') >= 6, 'the creator can read the history of their challenge');
reset role;
select tests.login(:ahmad);
select tests.ok((select count(*) from public.challenge_reviews) = 0, 'other students cannot read review history');
reset role;

-- the weekly challenges from before still work
select tests.login(:ahmad);
select tests.ok((select count(*) from public.challenges where title = 'Read for 20 minutes a day') = 1, 'the older weekly challenges are still visible');
reset role;

rollback;
