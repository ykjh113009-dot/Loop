-- Tutor reviews tests. Runs inside one transaction that is rolled back. Run with:  npm run db:test
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
grant execute on all functions in schema tests to authenticated, anon;

\set layla '''00000000-0000-0000-0000-0000000000a3'''
\set maya '''00000000-0000-0000-0000-0000000000a5'''
\set yousef '''00000000-0000-0000-0000-0000000000a4'''
select set_config('t.school', (select school_id::text from public.profiles where id = :maya), true);
insert into public.tutoring_requests (id, school_id, learner_id, tutor_id, subject, status)
  values ('00000000-0000-0000-0000-00000000d001', current_setting('t.school')::uuid, :maya, :layla, 'AP Calculus', 'completed'),
         ('00000000-0000-0000-0000-00000000d002', current_setting('t.school')::uuid, :maya, :layla, 'AP Calculus', 'accepted');

select tests.login(:yousef);
select tests.refused('select public.submit_tutor_review(''00000000-0000-0000-0000-00000000d001'', 5, ''x'')', 'finished session', 'Someone who did not have the session cannot review it');

select tests.login(:maya);
select tests.refused('select public.submit_tutor_review(''00000000-0000-0000-0000-00000000d002'', 5, ''x'')', 'finished session', 'A session that is not finished cannot be reviewed');
select tests.refused('select public.submit_tutor_review(''00000000-0000-0000-0000-00000000d001'', 9, ''x'')', '1 to 5', 'Ratings must be 1 to 5');
select public.submit_tutor_review('00000000-0000-0000-0000-00000000d001', 5, 'Explained everything clearly.');
select tests.ok((select count(*) from public.tutor_reviews where tutor_id = :layla) = 1, 'The learner can review a finished session');
select tests.refused('select public.submit_tutor_review(''00000000-0000-0000-0000-00000000d001'', 4, ''again'')', 'already reviewed', 'A session can only be reviewed once');
select tests.refused('insert into public.tutor_reviews (school_id, request_id, tutor_id, reviewer_id, rating) values (current_setting(''t.school'')::uuid, ''00000000-0000-0000-0000-00000000d002'', ' || :layla || ', ' || :maya || ', 5)', '', 'Reviews cannot be inserted directly');

select tests.login(:yousef);
select tests.ok((select reviews from public.tutor_stats(array[:layla::uuid])) = 1 and (select rating_avg from public.tutor_stats(array[:layla::uuid])) = 5.0 and (select sessions from public.tutor_stats(array[:layla::uuid])) = 1, 'Everyone at the school sees the rating, review count and sessions');
select tests.ok((select count(*) from public.tutor_reviews where tutor_id = :layla) = 1, 'Other students can read the reviews');

rollback;
