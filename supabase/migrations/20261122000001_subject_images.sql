-- A picture for each subject in Academic Resources (admins set it; everyone at the school sees it).
alter table public.study_categories add column image_path text;

create function public.set_study_category_image(p_id uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
begin
  if not public.is_admin() then
    raise exception 'Only admins can change a subject picture.';
  end if;
  if p_path is not null and p_path not like v_school::text || '/' || auth.uid()::text || '/%' then
    raise exception 'That picture is not yours.';
  end if;
  update public.study_categories set image_path = nullif(p_path, '') where id = p_id and school_id = v_school;
  if not found then raise exception 'Subject not found.'; end if;
end;
$$;
revoke execute on function public.set_study_category_image(uuid, text) from public, anon;
grant execute on function public.set_study_category_image(uuid, text) to authenticated;
