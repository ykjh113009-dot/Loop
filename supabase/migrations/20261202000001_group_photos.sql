-- A picture for each group chat. Stored privately; the people in the group see it. The person who made the group (or an admin) sets it.
alter table public.conversations add column image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-images', 'group-images', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Files live at "<school id>/<conversation id>/<file>".
create function public.group_image_manager(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
    and split_part(p_name, '/', 1) = public.my_school_id()::text
    and exists (
      select 1 from public.conversations c
      where c.id = split_part(p_name, '/', 2)::uuid and c.kind = 'group' and c.school_id = public.my_school_id()
        and (c.created_by = auth.uid() or public.is_admin())
    )
$$;

create function public.group_image_reader(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
    and split_part(p_name, '/', 1) = public.my_school_id()::text
    and public.is_conversation_member(split_part(p_name, '/', 2)::uuid)
$$;

create policy "upload group images" on storage.objects for insert to authenticated
  with check (bucket_id = 'group-images' and public.is_active() and public.group_image_manager(name));
create policy "see group images" on storage.objects for select to authenticated
  using (bucket_id = 'group-images' and public.is_reader() and public.group_image_reader(name));
create policy "delete group images" on storage.objects for delete to authenticated
  using (bucket_id = 'group-images' and public.group_image_manager(name));

create function public.set_group_image(p_conversation uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
begin
  if not public.is_active() then
    raise exception 'You can''t change this right now.';
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation and c.kind = 'group' and c.school_id = v_school and (c.created_by = auth.uid() or public.is_admin())
  ) then
    raise exception 'Only the person who made the group can change its picture.';
  end if;
  if p_path is not null and p_path !~ ('^' || v_school::text || '/' || p_conversation::text || '/[^/]+$') then
    raise exception 'That picture is not valid.';
  end if;
  update public.conversations set image_path = p_path where id = p_conversation;
end;
$$;
revoke all on function public.set_group_image(uuid, text) from public, anon;
grant execute on function public.set_group_image(uuid, text) to authenticated;
