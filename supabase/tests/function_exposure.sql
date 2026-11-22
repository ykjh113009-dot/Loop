-- Internal helper functions must not be callable by students, and signed-out visitors must reach nothing. Runs inside one
-- transaction that is rolled back. Run with:  npm run db:test
\set ON_ERROR_STOP on
begin;

create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.ok(p_pass boolean, p_name text) returns void language plpgsql as $$
begin
  if p_pass is not true then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

select tests.ok(not has_function_privilege('authenticated', p.oid, 'execute'), 'students cannot call ' || p.proname)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('grant_leadership', 'award_points', 'notify', 'claim_push_batch', 'send_event_reminders', 'promote_waitlist',
    'ensure_event_chat', 'event_chat_sync', 'notify_club_about_event', 'library_notify_reviewers', 'mark_active', 'refresh_streak',
    'award_badges', 'library_refresh_rating', 'profile_check_complete', 'notify_mentions', 'make_handle');

select tests.ok(count(*) = 0, 'signed-out visitors can run no database function')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute');

select tests.ok(count(*) = 0, 'signed-out visitors have no table access')
from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon';

rollback;
