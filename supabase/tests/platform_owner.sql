-- The platform owner (a Gmail account listed in platform_owners): sign-in rules and powers. Runs inside one transaction that is
-- rolled back. Run with:  npm run db:test
\set ON_ERROR_STOP on
begin;

create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.login(p_user uuid, p_aal text default 'aal2') returns void language sql as $$
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
\set maya '''00000000-0000-0000-0000-0000000000a5'''
\set owner '''00000000-0000-0000-0000-00000000f0f0'''

insert into public.platform_owners (email) values ('owner.test@gmail.com');

-- Sign-in: only the listed Gmail, only through Google, only if verified.
select tests.refused($$insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) values (gen_random_uuid(), 'random.person@gmail.com', '{"provider":"google"}', '{"email_verified":true}', 'authenticated', 'authenticated')$$,
  'NOT_SCHOOL_EMAIL', 'an unlisted Gmail address is still refused');
select tests.refused($$insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) values (gen_random_uuid(), 'owner.test@gmail.com', '{"provider":"email"}', '{}', 'authenticated', 'authenticated')$$,
  'NOT_GOOGLE', 'the owner address cannot be used with a password');
select tests.refused($$insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) values (gen_random_uuid(), 'owner.test@gmail.com', '{"provider":"google"}', '{"email_verified":false}', 'authenticated', 'authenticated')$$,
  'NOT_VERIFIED', 'the owner address must be verified by Google');
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
  values (:owner, 'owner.test@gmail.com', '{"provider":"google"}', '{"email_verified":true,"full_name":"Platform Owner"}', 'authenticated', 'authenticated');
select tests.ok((select role from public.profiles where id = :owner) = 'super_admin', 'the listed Gmail signs in as a Super Admin');
select tests.ok((select school_id from public.profiles where id = :owner) is not null, 'and belongs to the school');
update public.profiles set onboarded_at = now() where id = :owner;

-- Nobody can read or edit the owner list through the API.
select tests.login(:rania);
select tests.refused($$select * from public.platform_owners$$, 'permission denied', 'the owner list cannot be read by signed-in people');
select tests.refused($$insert into public.platform_owners (email) values ('another@gmail.com')$$, 'permission denied', 'the owner list cannot be edited by signed-in people');
select tests.ok(not public.is_platform_owner(), 'the school Owner is not a platform owner');
reset role;

-- Powers of the platform owner.
select tests.login(:owner);
select tests.ok(public.is_platform_owner() and public.is_super_admin() and public.is_owner(), 'the platform owner has every role and the Owner powers');
-- delete for good without hiding first
create temporary table t_ids as select (select id from public.listings order by created_at limit 1) as listing,
  (select id from public.posts order by created_at limit 1) as post;
grant select on t_ids to authenticated;
select public.admin_purge_content('listing', (select listing from t_ids), 'Platform clean-up');
reset role;
select tests.ok(not exists (select 1 from public.listings where id = (select listing from t_ids)), 'the platform owner deletes content for good without hiding it first');
select tests.ok((select count(*) from public.moderation_log where action = 'purge_listing' and details like '%Platform clean-up%') = 1, 'and it is recorded');

-- The school Owner still has to hide first.
select tests.login(:rania);
select tests.refused($$select public.admin_purge_content('post', (select post from t_ids), 'because')$$, 'Hide it first', 'the school Owner must still hide first');
reset role;

-- Removing admins: appoint, demote and suspend any account.
select tests.login(:owner);
select public.admin_update_member(:maya, null, 'admin');
select public.admin_update_member(:maya, null, 'super_admin');
select public.admin_update_member(:maya, null, 'student');
select tests.ok((select role from public.profiles where id = :maya) = 'student', 'the platform owner can appoint and remove admins and Super Admins');
select tests.refused($$select public.admin_update_member('00000000-0000-0000-0000-0000000000a1', null, 'admin')$$, 'owner', 'the school Owner role itself is fixed');
select public.suspend_user(:rania, 1, 'Test');
reset role;
select tests.ok((select suspended_until from public.profiles where id = :rania) is not null, 'the platform owner can suspend even a Super Admin');

-- Nobody can act on the platform owner from inside Loop.
update public.profiles set role = 'super_admin', suspended_until = null where id = :rania;
select tests.login(:rania);
select tests.refused($$select public.suspend_user('00000000-0000-0000-0000-00000000f0f0', 1, 'x')$$, 'cannot', 'the school Owner cannot suspend the platform owner');
select tests.refused($$select public.admin_update_member('00000000-0000-0000-0000-00000000f0f0', null, 'student')$$, 'platform owner', 'the school Owner cannot demote the platform owner');
select tests.refused($$select public.admin_set_deactivated('00000000-0000-0000-0000-00000000f0f0', true)$$, 'cannot', 'the school Owner cannot remove the platform owner');
reset role;
select tests.ok((select role from public.profiles where id = :owner) = 'super_admin', 'the platform owner is unchanged');

-- A student with the same kind of address gets nothing.
select tests.login(:maya);
select tests.ok(not public.is_platform_owner(), 'a student is not a platform owner');
reset role;

rollback;
