-- Marketplace item details: pictures, saved items and offers. Runs inside one transaction that is rolled back. Run with:  npm run db:test
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


\set layla '''00000000-0000-0000-0000-0000000000a3'''
\set maya '''00000000-0000-0000-0000-0000000000a5'''
\set rania '''00000000-0000-0000-0000-0000000000a1'''
select set_config('t.school', (select school_id::text from public.profiles where id = :maya), true);

-- a priced listing by Maya and a free one
reset role;
insert into public.listings (id, school_id, seller_id, title, description, category, kind, condition, price)
  values ('00000000-0000-0000-0000-0000000000d1', current_setting('t.school')::uuid, :maya, 'Test book', 'A book', 'books', 'sell', 'good', 100),
         ('00000000-0000-0000-0000-0000000000d2', current_setting('t.school')::uuid, :maya, 'Free chair', 'A chair', 'other', 'free', 'good', null);
select set_config('t.p1', current_setting('t.school') || '/' || :maya || '/a.webp', true);

-- pictures
select tests.login(:layla);
select tests.refused('select public.set_listing_images(''00000000-0000-0000-0000-0000000000d1'', array[''x/y/z.webp''])', 'not your', 'Another student cannot change a listing''s pictures');
select tests.login(:maya);
select tests.refused('select public.set_listing_images(''00000000-0000-0000-0000-0000000000d1'', array[''x/y/z.webp''])', 'not yours', 'A picture outside my own folder is refused');
select tests.refused('select public.set_listing_images(''00000000-0000-0000-0000-0000000000d1'', array[''a'',''b'',''c'',''d'',''e''])', 'up to 4', 'At most four pictures');
select public.set_listing_images('00000000-0000-0000-0000-0000000000d1', array[current_setting('t.p1')]);
select tests.ok((select image_path from public.listings where id = '00000000-0000-0000-0000-0000000000d1') = current_setting('t.p1') and (select count(*) from public.listing_images where listing_id = '00000000-0000-0000-0000-0000000000d1') = 1, 'The seller sets pictures and the cover follows');
select tests.refused('insert into public.listing_images (listing_id, school_id, path) values (''00000000-0000-0000-0000-0000000000d1'', current_setting(''t.school'')::uuid, ''x'')', 'permission denied', 'Pictures cannot be inserted directly');

-- saved items
select tests.login(:layla);
insert into public.listing_saves (profile_id, listing_id, school_id) values (:layla, '00000000-0000-0000-0000-0000000000d1', current_setting('t.school')::uuid);
select tests.ok((select count(*) from public.listing_saves) = 1, 'A student can save an item');
select tests.refused('insert into public.listing_saves (profile_id, listing_id, school_id) values (' || quote_literal(:maya) || ', ''00000000-0000-0000-0000-0000000000d1'', current_setting(''t.school'')::uuid)', 'row-level security', 'Nobody can save an item for someone else');
select tests.login(:maya);
select tests.ok((select count(*) from public.listing_saves) = 0, 'Saved items are private');

-- offers
select tests.login(:layla);
select tests.refused('select public.make_listing_offer(''00000000-0000-0000-0000-0000000000d1'', 150, '''')', 'higher than', 'An offer cannot be above the asking price');
select tests.refused('select public.make_listing_offer(''00000000-0000-0000-0000-0000000000d2'', 5, '''')', 'does not take offers', 'A free item takes no offers');
select tests.refused('select public.make_listing_offer(''00000000-0000-0000-0000-0000000000d1'', 0, '''')', 'amount', 'An offer needs an amount');
select public.make_listing_offer('00000000-0000-0000-0000-0000000000d1', 80, 'Can you do 80?');
select tests.ok((select count(*) from public.listing_offers where status = 'pending' and amount = 80) = 1 and tests.notes(:maya, 'listing_offer') = 1, 'An offer is stored and the seller is told');
select public.make_listing_offer('00000000-0000-0000-0000-0000000000d1', 90, '');
select tests.ok((select count(*) from public.listing_offers where status = 'pending') = 1 and (select amount from public.listing_offers where status = 'pending') = 90, 'A new offer replaces the open one');
select tests.refused('insert into public.listing_offers (school_id, listing_id, buyer_id, amount) values (current_setting(''t.school'')::uuid, ''00000000-0000-0000-0000-0000000000d1'', ' || quote_literal(:layla) || ', 1)', 'permission denied', 'Offers cannot be written directly');
select tests.login(:maya);
select tests.refused('select public.make_listing_offer(''00000000-0000-0000-0000-0000000000d1'', 50, '''')', 'your own', 'You cannot make an offer on your own item');
select tests.ok((select count(*) from public.listing_offers) = 1, 'The seller sees the offers on their item');
select tests.login('00000000-0000-0000-0000-0000000000a4');
select tests.ok((select count(*) from public.listing_offers) = 0, 'Other students cannot see the offers');
select tests.refused('select public.respond_listing_offer((select id from public.listing_offers limit 1), true)', 'not found', 'Only the seller can answer (others do not even see it)');
select tests.login(:maya);
select public.respond_listing_offer((select id from public.listing_offers where status = 'pending'), true);
select tests.ok((select status from public.listings where id = '00000000-0000-0000-0000-0000000000d1') = 'reserved' and (select status from public.listing_offers) = 'accepted' and tests.notes(:layla, 'listing_offer') = 1, 'Accepting reserves the item and tells the buyer');
select tests.login(:layla);
select tests.refused('select public.make_listing_offer(''00000000-0000-0000-0000-0000000000d1'', 70, '''')', 'not available', 'No offers on a reserved item');

rollback;
