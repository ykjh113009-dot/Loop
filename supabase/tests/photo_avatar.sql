-- Profile photo as avatar tests. Runs inside one transaction that is rolled back. Run with:  npm run db:test
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
\set maya  '''00000000-0000-0000-0000-0000000000a5'''
\set yousef '''00000000-0000-0000-0000-0000000000a4'''
select set_config('t.school', (select school_id::text from public.profiles where id = :maya), true);

select tests.login(:maya);
select tests.ok((select avatar from public.profiles where id = :maya) ~ '^a[0-9]{2}$', 'starts with an illustrated avatar');
select tests.refused(format($$update public.profiles set photo_path = '%s/00000000-0000-0000-0000-0000000000a4/x.jpg' where id = '00000000-0000-0000-0000-0000000000a5'$$, current_setting('t.school')), 'photo', 'a photo from someone else''s folder is refused');
update public.profiles set photo_path = current_setting('t.school') || '/' || :maya || '/me.jpg' where id = :maya;
select tests.ok((select avatar from public.profiles where id = :maya) ~ ('^u:' || :maya || ':[0-9]+$'), 'uploading a photo makes it the avatar');
update public.profiles set avatar = 'u:' || :yousef || ':1' where id = :maya;
select tests.ok((select avatar from public.profiles where id = :maya) ~ ('^u:' || :maya || ':'), 'nobody can point their avatar at someone else''s photo');
update public.profiles set avatar = 'a03' where id = :maya;
select tests.ok((select avatar || '/' || avatar_icon from public.profiles where id = :maya) ~ ('^u:' || :maya || ':[0-9]+/a03$'), 'picking an illustration while a photo is set keeps the photo and remembers the illustration');
update public.profiles set photo_path = null where id = :maya;
select tests.ok((select avatar from public.profiles where id = :maya) = 'a03', 'removing the photo brings the illustration back');
update public.profiles set avatar = 'hello' where id = '00000000-0000-0000-0000-0000000000a5';
select tests.ok((select avatar from public.profiles where id = '00000000-0000-0000-0000-0000000000a5') = 'a03', 'junk avatar values change nothing');
rollback;
\echo done
