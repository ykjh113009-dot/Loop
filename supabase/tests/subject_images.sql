-- Subject picture tests. Runs inside one transaction that is rolled back. Run with:  npm run db:test
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
\set maya  '''00000000-0000-0000-0000-0000000000a5'''
select set_config('t.school', (select school_id::text from public.profiles where id = :maya), true);
select set_config('t.sat', (select id::text from public.study_categories where slug = 'sat' and school_id = (select school_id from public.profiles where id = :maya)), true);

select tests.login(:maya);
select tests.refused($$select public.set_study_category_image(current_setting('t.sat')::uuid, 'x/y/z.jpg')$$, 'only admins', 'students cannot set a subject picture');
select tests.login(:rania);
select tests.refused($$select public.set_study_category_image(current_setting('t.sat')::uuid, 'someone/else/z.jpg')$$, 'not yours', 'an admin can only use their own uploaded picture');
select public.set_study_category_image(current_setting('t.sat')::uuid, current_setting('t.school') || '/00000000-0000-0000-0000-0000000000a1/p.jpg');
select tests.login(:maya);
select tests.ok((select image_path is not null from public.study_categories where id = current_setting('t.sat')::uuid), 'students see the picture path');
select tests.login(:rania);
select public.set_study_category_image(current_setting('t.sat')::uuid, null);
select tests.ok((select image_path is null from public.study_categories where id = current_setting('t.sat')::uuid), 'the picture can be removed');
rollback;
\echo done
