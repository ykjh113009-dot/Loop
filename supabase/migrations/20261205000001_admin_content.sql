-- One place where an admin can see everything people have posted on Loop and remove it. Admin only, same school only,
-- every removal is written to the activity log, and the person who made it is told why.

create function public.admin_content_feed(p_kind text default 'all', p_limit int default 60)
returns table (kind text, id uuid, title text, detail text, author_id uuid, author text, created_at timestamptz, status text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_limit int := least(greatest(coalesce(p_limit, 60), 1), 200);
begin
  if not public.is_admin() then
    raise exception 'Only admins can see this.';
  end if;
  if p_kind not in ('all', 'post', 'comment', 'club', 'group', 'listing', 'event', 'poll', 'resource') then
    raise exception 'Unknown kind.';
  end if;
  return query
  select * from (
    select 'post'::text, x.id, left(x.body, 80), left(x.body, 400), x.author_id, p.full_name, x.created_at, x.status::text
      from public.posts x left join public.profiles p on p.id = x.author_id where x.school_id = v_school and p_kind in ('all', 'post')
    union all
    select 'comment', x.id, left(x.body, 80), left(x.body, 400), x.author_id, p.full_name, x.created_at, x.status::text
      from public.post_comments x left join public.profiles p on p.id = x.author_id where x.school_id = v_school and p_kind in ('all', 'comment')
    union all
    select 'club', x.id, x.name, left(coalesce(x.description, ''), 400), x.requested_by, p.full_name, x.created_at, x.status::text
      from public.clubs x left join public.profiles p on p.id = x.requested_by where x.school_id = v_school and p_kind in ('all', 'club')
    union all
    select 'group', x.id, x.name, left(coalesce(x.description, ''), 400), x.created_by, p.full_name, x.created_at, x.status::text
      from public.groups x left join public.profiles p on p.id = x.created_by where x.school_id = v_school and p_kind in ('all', 'group')
    union all
    select 'listing', x.id, x.title, left(coalesce(x.description, ''), 400), x.seller_id, p.full_name, x.created_at, x.status::text
      from public.listings x left join public.profiles p on p.id = x.seller_id where x.school_id = v_school and p_kind in ('all', 'listing')
    union all
    select 'event', x.id, x.title, left(coalesce(x.description, ''), 400), x.created_by, p.full_name, x.created_at, x.status::text
      from public.events x left join public.profiles p on p.id = x.created_by where x.school_id = v_school and p_kind in ('all', 'event')
    union all
    select 'poll', x.id, left(x.question, 80), left(x.question, 400), x.created_by, p.full_name, x.created_at, null::text
      from public.polls x left join public.profiles p on p.id = x.created_by where x.school_id = v_school and p_kind in ('all', 'poll')
    union all
    select 'resource', x.id, x.title, left(coalesce(x.description, ''), 400), x.submitter_id, p.full_name, x.created_at, x.visibility::text
      from public.library_resources x left join public.profiles p on p.id = x.submitter_id where x.school_id = v_school and x.deleted_at is null and p_kind in ('all', 'resource')
  ) f
  order by 7 desc
  limit v_limit;
end;
$$;
revoke all on function public.admin_content_feed(text, int) from public, anon;
grant execute on function public.admin_content_feed(text, int) to authenticated;

create function public.admin_remove_content(p_kind text, p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
  v_owner uuid;
  v_title text;
  v_found boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove content.';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Write a short reason (the person who made it is told).';
  end if;

  if p_kind = 'post' then
    select author_id, left(body, 60) into v_owner, v_title from public.posts where id = p_id and school_id = v_school;
    v_found := found; delete from public.posts where id = p_id and school_id = v_school;
  elsif p_kind = 'comment' then
    select author_id, left(body, 60) into v_owner, v_title from public.post_comments where id = p_id and school_id = v_school;
    v_found := found; delete from public.post_comments where id = p_id and school_id = v_school;
  elsif p_kind = 'club' then
    select requested_by, name into v_owner, v_title from public.clubs where id = p_id and school_id = v_school;
    v_found := found; delete from public.clubs where id = p_id and school_id = v_school;
  elsif p_kind = 'group' then
    select created_by, name into v_owner, v_title from public.groups where id = p_id and school_id = v_school;
    v_found := found; delete from public.groups where id = p_id and school_id = v_school;
  elsif p_kind = 'listing' then
    select seller_id, title into v_owner, v_title from public.listings where id = p_id and school_id = v_school;
    v_found := found; delete from public.listings where id = p_id and school_id = v_school;
  elsif p_kind = 'event' then
    select created_by, title into v_owner, v_title from public.events where id = p_id and school_id = v_school;
    v_found := found; delete from public.events where id = p_id and school_id = v_school;
  elsif p_kind = 'poll' then
    select created_by, left(question, 60) into v_owner, v_title from public.polls where id = p_id and school_id = v_school;
    v_found := found; delete from public.polls where id = p_id and school_id = v_school;
  elsif p_kind = 'resource' then
    -- Library items are hidden, not erased, so they can be restored from the library review page.
    select submitter_id, title into v_owner, v_title from public.library_resources where id = p_id and school_id = v_school and deleted_at is null;
    v_found := found; update public.library_resources set visibility = 'removed', deleted_at = now() where id = p_id and school_id = v_school;
  else
    raise exception 'Unknown kind.';
  end if;

  if not v_found then
    raise exception 'That item no longer exists.';
  end if;

  insert into public.moderation_log (school_id, actor_id, action, target_type, target_id, details)
  values (v_school, auth.uid(), 'remove_' || p_kind, p_kind, p_id, left('"' || coalesce(v_title, '') || '" — ' || v_reason, 500));

  if v_owner is not null and v_owner <> auth.uid() then
    perform public.notify(v_owner, 'removed', 'Something you made was removed', coalesce(v_title, '') || ' — ' || v_reason, null);
  end if;
end;
$$;
revoke all on function public.admin_remove_content(text, uuid, text) from public, anon;
grant execute on function public.admin_remove_content(text, uuid, text) to authenticated;
