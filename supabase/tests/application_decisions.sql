-- Application decision tests: seen flag, mandatory rejection reason, privacy. Runs inside one transaction that is rolled back. Run with:  npm run db:test
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
\set omar  '''00000000-0000-0000-0000-0000000000a2'''
\set yousef '''00000000-0000-0000-0000-0000000000a4'''
\set maya  '''00000000-0000-0000-0000-0000000000a5'''
delete from public.rate_events;
delete from public.admin_applications; delete from public.leadership_requests;

-- Maya applies for class rep; Yousef applies to be a moderator
select tests.login(:maya);
select public.request_leadership_role('class_rep', '9A', null, 'I would like to represent my class.');
select tests.login(:yousef);
select public.submit_admin_application('moderator', 'Student', 'I want to help keep Loop friendly and safe for everyone.', 'I will review reports quickly and kindly.', '');

select tests.login(:rania);
select tests.refused($$select public.review_leadership_request((select id from public.leadership_requests limit 1), false, '')$$, 'explain why', 'rejecting a leadership request needs a reason');
select tests.refused($$select public.review_leadership_request((select id from public.leadership_requests limit 1), false, '  ')$$, 'explain why', 'a blank reason does not count');
select tests.ok((select status from public.leadership_requests limit 1) = 'pending', 'a refused rejection changes nothing');
select public.review_leadership_request((select id from public.leadership_requests limit 1), false, 'Please check with your class teacher first.');
select tests.ok((select decision_seen_at is null from public.leadership_requests limit 1), 'a new decision is unseen');
reset role;
select tests.ok((select link from public.notifications where recipient_id = :maya and kind = 'leadership' order by created_at desc limit 1) like '/application-update?kind=leadership&id=%', 'the notification links to the decision page');

-- approving needs no reason; admin application: asked moderator, given admin
select tests.login(:rania);
select public.review_admin_application((select id from public.admin_applications limit 1), true, 'admin', '');
reset role;
select tests.ok((select assigned_role from public.admin_applications limit 1) = 'admin', 'the granted role can differ from the requested one');
select tests.login(:rania);
select tests.refused($$select public.review_admin_application((select id from public.admin_applications limit 1), false, '', 'No')$$, 'already reviewed', 'a decided application cannot be decided again');

-- Seen flag
select tests.login(:maya);
select tests.ok((select status || '/' || (decision_seen_at is null) from public.leadership_requests limit 1) = 'rejected/true', 'the applicant sees their own rejection as unseen');
select tests.refused($$update public.leadership_requests set status = 'approved'$$, 'permission', 'applicants cannot change their own status');
select tests.refused($$update public.leadership_requests set decision_seen_at = now()$$, 'permission', 'applicants cannot write the table directly');
select public.ack_application_decision('leadership', (select id from public.leadership_requests limit 1));
select tests.ok((select decision_seen_at is not null from public.leadership_requests limit 1), 'acknowledging marks the decision seen');
select tests.login(:yousef);
select public.ack_application_decision('leadership', (select id from public.leadership_requests where profile_id = :maya));
reset role;
select tests.ok((select decision_seen_at is not null from public.leadership_requests where profile_id = :maya limit 1), 'still seen (nothing changes for others)');
select tests.ok((select count(*) from public.admin_applications where decision_seen_at is null and status <> 'pending') = 1, 'someone else cannot mark my decision seen');
select tests.login(:maya);
select tests.ok((select count(*) from public.admin_applications) = 0, 'other people''s applications are invisible');

-- Resubmitting after a rejection is allowed; duplicates while pending are not
select public.request_leadership_role('class_rep', '9A', null, 'I added what you asked for and applied again.');
select tests.refused($$select public.request_leadership_role('class_rep', '9A', null, 'Second try at the same time.')$$, 'already asked', 'no duplicate active applications');

rollback;
\echo done
