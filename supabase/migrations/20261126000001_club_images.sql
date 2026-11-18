-- A picture for each club, set by the club's leaders or an admin. Stored privately; people at the same school see it.
alter table public.clubs add column image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-images', 'club-images', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Files live at "<school id>/<club id>/<file>".
create function public.club_image_manager(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
    and split_part(p_name, '/', 1) = public.my_school_id()::text
    and public.can_manage_club(split_part(p_name, '/', 2)::uuid)
$$;

create policy "upload club images" on storage.objects for insert to authenticated
  with check (bucket_id = 'club-images' and public.is_active() and public.club_image_manager(name));
create policy "see club images" on storage.objects for select to authenticated
  using (bucket_id = 'club-images' and public.is_reader() and split_part(name, '/', 1) = public.my_school_id()::text);
create policy "delete club images" on storage.objects for delete to authenticated
  using (bucket_id = 'club-images' and public.club_image_manager(name));

-- Sets (or clears, with null) a club's picture. Only the club's leaders and admins may.
create function public.set_club_image(p_club uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
begin
  if not public.can_manage_club(p_club) then
    raise exception 'Only the club''s leaders and admins can change the picture.';
  end if;
  if p_path is not null and p_path !~ ('^' || v_school::text || '/' || p_club::text || '/[^/]+$') then
    raise exception 'That picture is not valid.';
  end if;
  update public.clubs set image_path = p_path where id = p_club and school_id = v_school;
end;
$$;
revoke all on function public.set_club_image(uuid, text) from public, anon;
grant execute on function public.set_club_image(uuid, text) to authenticated;
