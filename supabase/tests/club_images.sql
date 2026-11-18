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
\set layla '''00000000-0000-0000-0000-0000000000a3'''
\set maya '''00000000-0000-0000-0000-0000000000a5'''
\set rania '''00000000-0000-0000-0000-0000000000a1'''
\set club '''00000000-0000-0000-0000-00000000c001'''
select set_config('t.school', (select school_id::text from public.clubs where id = :club), true);
select set_config('t.path', current_setting('t.school') || '/00000000-0000-0000-0000-00000000c001/pic.jpg', true);

select tests.login(:maya);
select tests.refused('select public.set_club_image(' || quote_literal(:club) || '::uuid, current_setting(''t.path''))', 'leaders and admins', 'A plain member cannot set the club picture');

select tests.login(:layla);
select public.set_club_image(:club::uuid, current_setting('t.path'));
select tests.ok((select image_path from public.clubs where id = :club) = current_setting('t.path'), 'The club leader sets the picture');
select tests.refused('select public.set_club_image(' || quote_literal(:club) || '::uuid, ''someone/else/pic.jpg'')', 'not valid', 'A picture path outside the club folder is refused');
select tests.refused('update public.clubs set image_path = ''x'' where id = ' || quote_literal(:club), '', 'Leaders cannot write the column directly');
select tests.ok((select image_path from public.clubs where id = :club) = current_setting('t.path'), 'The picture is unchanged after the refused write');

select tests.login(:rania);
select public.set_club_image(:club::uuid, null);
select tests.ok((select image_path from public.clubs where id = :club) is null, 'An admin can remove the club picture');

-- the requester of a waiting club may set its picture; others may not
\set req '00000000-0000-0000-0000-0000000000a5'
reset role;
insert into public.clubs (id, school_id, name, description, emoji, status, requested_by)
  values ('00000000-0000-0000-0000-00000000c0ff', current_setting('t.school')::uuid, 'Picture Test Club', 'A test club for pictures.', '⭐', 'pending', :maya);
update public.clubs set requested_by = :maya, status = 'pending' where id = '00000000-0000-0000-0000-00000000c0ff';
select set_config('t.path2', current_setting('t.school') || '/00000000-0000-0000-0000-00000000c0ff/pic.jpg', true);
select tests.login(:maya);
select public.set_club_image('00000000-0000-0000-0000-00000000c0ff'::uuid, current_setting('t.path2'));
select tests.ok((select image_path from public.clubs where id = '00000000-0000-0000-0000-00000000c0ff') = current_setting('t.path2'), 'The requester can set the picture of a waiting club');
select tests.login(:layla);
select tests.refused('select public.set_club_image(''00000000-0000-0000-0000-00000000c0ff''::uuid, ' || quote_literal(current_setting('t.path2')) || ')', 'leaders and admins', 'Someone else cannot set a waiting club''s picture');

rollback;
