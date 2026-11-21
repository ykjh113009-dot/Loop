-- Item details for the student marketplace: several pictures per listing, a place to meet, saved items and offers.
alter table public.listings add column location text not null default '' check (char_length(location) <= 80);

-- ---- Pictures (the first one is also kept in listings.image_path so older code keeps working) ----
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  path text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.listing_images (listing_id, sort);
alter table public.listing_images enable row level security;
create policy "see listing images" on public.listing_images for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader() and exists (select 1 from public.listings l where l.id = listing_id));
revoke insert, update, delete on public.listing_images from authenticated;

create function public.set_listing_images(p_listing uuid, p_paths text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  v_paths text[] := coalesce(p_paths, '{}');
  p text;
  i int := 0;
begin
  select * into l from public.listings where id = p_listing and seller_id = auth.uid();
  if l.id is null then raise exception 'That is not your listing.'; end if;
  if array_length(v_paths, 1) > 4 then raise exception 'You can add up to 4 pictures.'; end if;
  foreach p in array v_paths loop
    if p is null or p not like l.school_id::text || '/' || auth.uid()::text || '/%' then raise exception 'That picture is not yours.'; end if;
  end loop;
  delete from public.listing_images where listing_id = l.id;
  foreach p in array v_paths loop
    insert into public.listing_images (listing_id, school_id, path, sort) values (l.id, l.school_id, p, i);
    i := i + 1;
  end loop;
  update public.listings set image_path = v_paths[1] where id = l.id;
end;
$$;

-- ---- Saved items ----
create table public.listing_saves (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  created_at timestamptz not null default now(),
  primary key (profile_id, listing_id)
);
create index on public.listing_saves (profile_id, created_at desc);
alter table public.listing_saves enable row level security;
create policy "own listing saves" on public.listing_saves for select to authenticated using (profile_id = (select auth.uid()));
create policy "save a listing" on public.listing_saves for insert to authenticated
  with check (profile_id = (select auth.uid()) and school_id = public.my_school_id() and public.is_active() and public.is_current_student(auth.uid())
              and exists (select 1 from public.listings l where l.id = listing_id));
create policy "unsave a listing" on public.listing_saves for delete to authenticated using (profile_id = (select auth.uid()));
revoke update on public.listing_saves from authenticated;

-- ---- Offers ----
create table public.listing_offers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(8, 2) not null check (amount > 0 and amount <= 100000),
  message text not null default '' check (char_length(message) <= 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create unique index on public.listing_offers (listing_id, buyer_id) where status = 'pending';
create index on public.listing_offers (listing_id, created_at desc);
alter table public.listing_offers enable row level security;
create policy "see my offers or offers on my items" on public.listing_offers for select to authenticated
  using (buyer_id = (select auth.uid()) or exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())));
revoke insert, update, delete on public.listing_offers from authenticated;

create function public.make_listing_offer(p_listing uuid, p_amount numeric, p_message text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  v_id uuid;
  v_name text;
  v_msg text := left(btrim(coalesce(p_message, '')), 300);
begin
  if not public.is_active() or not public.is_current_student(auth.uid()) then raise exception 'Only current students can make offers.'; end if;
  select * into l from public.listings where id = p_listing and school_id = public.my_school_id();
  if l.id is null or l.status <> 'active' then raise exception 'This item is not available.'; end if;
  if l.seller_id = auth.uid() then raise exception 'You cannot make an offer on your own item.'; end if;
  if l.kind <> 'sell' or l.price is null then raise exception 'This item does not take offers.'; end if;
  if public.is_blocked_between(auth.uid(), l.seller_id) then raise exception 'You cannot make an offer to this student.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount.'; end if;
  if p_amount > l.price then raise exception 'An offer cannot be higher than the asking price.'; end if;
  perform public.check_rate('listing_offer', 10, 3600);
  perform public.reject_blocked(l.school_id, v_msg);
  update public.listing_offers set amount = round(p_amount, 2), message = v_msg, created_at = now()
    where listing_id = l.id and buyer_id = auth.uid() and status = 'pending' returning id into v_id;
  if v_id is null then
    insert into public.listing_offers (school_id, listing_id, buyer_id, amount, message)
    values (l.school_id, l.id, auth.uid(), round(p_amount, 2), v_msg) returning id into v_id;
  end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  perform public.notify(l.seller_id, 'listing_offer', 'New offer on ' || l.title, v_name || ' offered ₪' || trim(to_char(round(p_amount, 2), 'FM999990.99')), '/market/' || l.id);
  return v_id;
end;
$$;

create function public.withdraw_listing_offer(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.listing_offers set status = 'withdrawn', responded_at = now() where id = p_id and buyer_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Offer not found.'; end if;
end;
$$;

create function public.respond_listing_offer(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.listing_offers;
  l public.listings;
begin
  select * into o from public.listing_offers where id = p_id and status = 'pending' for update;
  if o.id is null then raise exception 'Offer not found.'; end if;
  select * into l from public.listings where id = o.listing_id and seller_id = auth.uid();
  if l.id is null then raise exception 'Only the seller can answer an offer.'; end if;
  update public.listing_offers set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = o.id;
  if p_accept then
    update public.listings set status = 'reserved' where id = l.id;
    update public.listing_offers set status = 'declined', responded_at = now() where listing_id = l.id and status = 'pending';
  end if;
  perform public.notify(o.buyer_id, 'listing_offer', case when p_accept then 'Your offer was accepted: ' else 'Your offer was declined: ' end || l.title,
    case when p_accept then 'Message the seller to plan where to meet.' else '' end, '/market/' || l.id);
end;
$$;

do $$ declare f text; begin
  foreach f in array array['set_listing_images(uuid, text[])', 'make_listing_offer(uuid, numeric, text)', 'withdraw_listing_offer(uuid)', 'respond_listing_offer(uuid, boolean)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
