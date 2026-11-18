-- Whoever asked for a club may add its picture while the request is waiting for approval.
create or replace function public.club_image_manager(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
    and split_part(p_name, '/', 1) = public.my_school_id()::text
    and (
      public.can_manage_club(split_part(p_name, '/', 2)::uuid)
      or exists (select 1 from public.clubs c
                 where c.id = split_part(p_name, '/', 2)::uuid and c.requested_by = auth.uid() and c.status = 'pending'
                   and c.school_id = public.my_school_id())
    )
$$;

create or replace function public.set_club_image(p_club uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
begin
  if not (public.can_manage_club(p_club)
          or exists (select 1 from public.clubs c where c.id = p_club and c.requested_by = auth.uid() and c.status = 'pending' and c.school_id = v_school)) then
    raise exception 'Only the club''s leaders and admins can change the picture.';
  end if;
  if p_path is not null and p_path !~ ('^' || v_school::text || '/' || p_club::text || '/[^/]+$') then
    raise exception 'That picture is not valid.';
  end if;
  update public.clubs set image_path = p_path where id = p_club and school_id = v_school;
end;
$$;
