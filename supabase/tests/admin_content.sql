-- Admin content feed and removal. Runs inside one transaction that is rolled back. Run with:  npm run db:test
\set ON_ERROR_STOP on
begin;

create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.login(p_user uuid, p_aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true),
         set_config('role', 'authenticated', true);
$$;
create function tests.ok(p_pass boolean, p_name text) returns void language plpgsql as $$
begin
  if p_pass is not true then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
create function tests.refused(p_sql text, p_like text, p_name text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_like || '%' then raise notice 'ok - %', p_name; return; end if;
    raise exception 'FAILED: % (wrong error: %)', p_name, sqlerrm;
  end;
  raise exception 'FAILED: % (it was allowed)', p_name;
end $$;
grant execute on all functions in schema tests to authenticated, anon;
\set rania '''00000000-0000-0000-0000-0000000000a1'''
\set layla '''00000000-0000-0000-0000-0000000000a3'''
\set maya '''00000000-0000-0000-0000-0000000000a5'''

-- A student cannot see the feed or remove anything.
select tests.login(:maya);
select tests.refused($$select * from public.admin_content_feed('all', 10)$$, 'Only admins', 'a student cannot open the admin content feed');
select tests.refused($$select public.admin_remove_content('post', (select id from public.posts limit 1), 'because')$$, 'Only admins', 'a student cannot remove content');
reset role;
insert into public.groups (school_id, name, created_by) values ((select school_id from public.profiles where id = :layla), 'Test group', :layla);
select tests.ok((select count(*) from public.posts) > 0, 'there are posts to work with');

-- An admin sees every kind and can remove each one, with a reason.
select tests.login(:rania);
select tests.ok((select count(*) from public.admin_content_feed('all', 5)) = 5, 'the everything feed returns the newest items');
select tests.ok((select count(*) from public.admin_content_feed('club', 5)) > 0 and (select count(*) from public.admin_content_feed('group', 5)) > 0
  and (select count(*) from public.admin_content_feed('listing', 5)) > 0 and (select count(*) from public.admin_content_feed('event', 5)) > 0
  and (select count(*) from public.admin_content_feed('poll', 5)) > 0 and (select count(*) from public.admin_content_feed('post', 5)) > 0, 'each kind has its own list');
select tests.refused($$select public.admin_remove_content('post', (select id from public.posts limit 1), '')$$, 'short reason', 'a reason is required');
select tests.refused($$select public.admin_remove_content('nonsense', gen_random_uuid(), 'because')$$, 'Unknown kind', 'unknown kinds are refused');
select tests.refused($$select public.admin_remove_content('post', gen_random_uuid(), 'because')$$, 'no longer exists', 'a missing item is reported');

create temporary table t_ids as select
  (select id from public.listings order by created_at limit 1) as listing,
  (select id from public.groups order by created_at limit 1) as grp,
  (select id from public.polls order by created_at limit 1) as poll,
  (select id from public.posts order by created_at limit 1) as post;
grant select on t_ids to authenticated;

select public.admin_remove_content('listing', (select listing from t_ids), 'Not allowed on Loop');
select public.admin_remove_content('group', (select grp from t_ids), 'Not allowed on Loop');
select public.admin_remove_content('poll', (select poll from t_ids), 'Not allowed on Loop');
select public.admin_remove_content('post', (select post from t_ids), 'Not allowed on Loop');
reset role;
select tests.ok(not exists (select 1 from public.listings where id = (select listing from t_ids)), 'the listing is gone');
select tests.ok(not exists (select 1 from public.groups where id = (select grp from t_ids)), 'the group is gone');
select tests.ok(not exists (select 1 from public.posts where id = (select post from t_ids)), 'the post is gone');
select tests.ok((select count(*) from public.moderation_log where action in ('remove_listing', 'remove_group', 'remove_poll', 'remove_post')) = 4, 'each removal is written to the activity log');

rollback;
