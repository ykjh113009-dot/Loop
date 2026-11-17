-- First-time setup tests. Runs inside one transaction that is rolled back. Run with:  npm run db:test
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
update public.profiles set onboarded_at = null, section = null, avatar = 'a01', avatar_icon = 'a01', photo_path = null, bio = '' where id = :maya;
select set_config('t.school', (select school_id::text from public.profiles where id = :maya), true);
select set_config('t.grade', (select grade::text from public.profiles where id = :maya), true);

select tests.login(:maya);
select tests.refused($$select public.complete_onboarding(9, 'b05', 'hi', '{}', null, null)$$, 'class letter', 'a student must choose a class letter');
select tests.refused($$select public.complete_onboarding(9, 'b05', 'hi', '{}', 'Z', null)$$, 'class letter', 'only real class letters are accepted');
select tests.refused($$select public.complete_onboarding(9, 'hello', 'hi', '{}', 'B', null)$$, 'avatar', 'a made-up avatar is refused');
select tests.refused(format($$select public.complete_onboarding(9, 'b05', 'hi', '{}', 'B', '%s/00000000-0000-0000-0000-0000000000a4/x.jpg')$$, current_setting('t.school')), 'photo', 'someone else''s photo is refused');
select tests.ok((select onboarded_at is null from public.profiles where id = :maya), 'nothing was saved by the refused attempts');
select public.complete_onboarding(9, 'b05', 'Hello, I like robots.', '{}', 'B', null);
select tests.ok((select section || '/' || avatar || '/' || bio from public.profiles where id = :maya) = 'B/b05/Hello, I like robots.', 'setup saves the class letter, avatar and bio');
select tests.ok((select onboarded_at is not null from public.profiles where id = :maya), 'setup is marked done');
select public.complete_onboarding(9, 'b02', '', '{}', 'C', null);
select tests.ok((select section from public.profiles where id = :maya) = 'B', 'running setup again cannot change the class letter');
rollback;
\echo done
