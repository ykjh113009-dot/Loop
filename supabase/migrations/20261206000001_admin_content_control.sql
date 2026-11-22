-- Full admin control over content, with safe steps and a record of everything:
--   1. Hide (kept, fully restorable)  2. Restore  3. Edit  4. Close a poll  5. Delete for good (Super Admin only, only after hiding)
-- Moderators may hide and restore posts, comments, listings and group-chat messages; admins may do that for everything and edit;
-- only Super Admins may delete for good or open a reported private conversation. Every step is written to the activity log.

create table public.admin_hidden (
  kind text not null,
  id uuid not null,
  school_id uuid not null references public.schools (id),
  prev_status text,
  hidden_by uuid references public.profiles (id) on delete set null,
  hidden_at timestamptz not null default now(),
  reason text not null,
  primary key (kind, id)
);
alter table public.admin_hidden enable row level security;
create policy "staff see hidden items" on public.admin_hidden for select to authenticated
  using (school_id = public.my_school_id() and public.is_staff());
revoke insert, update, delete on public.admin_hidden from authenticated;
revoke all on public.admin_hidden from anon;
create index admin_hidden_school_idx on public.admin_hidden (school_id, hidden_at desc);

-- Who may do what to which kind.
create function public.content_can_hide(p_kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p_kind in ('post', 'comment', 'listing', 'message') then public.is_staff()
              when p_kind in ('club', 'group', 'event', 'resource') then public.is_admin()
              else false end
$$;
revoke all on function public.content_can_hide(text) from public, anon;
grant execute on function public.content_can_hide(text) to authenticated;

-- The list. p_view is 'active' (everything not hidden) or 'removed' (hidden by staff, with who and why).
create function public.admin_content_list(p_kind text default 'all', p_view text default 'active', p_limit int default 60)
returns table (kind text, id uuid, title text, detail text, author_id uuid, author text, created_at timestamptz, status text,
               hidden_at timestamptz, hidden_by text, hidden_reason text, can_hide boolean, can_edit boolean, can_purge boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_limit int := least(greatest(coalesce(p_limit, 60), 1), 200);
begin
  if not public.is_staff() then
    raise exception 'Only staff can see this.';
  end if;
  if p_kind not in ('all', 'post', 'comment', 'message', 'club', 'group', 'listing', 'event', 'poll', 'resource') then
    raise exception 'Unknown kind.';
  end if;
  if p_view not in ('active', 'removed') then
    raise exception 'Unknown view.';
  end if;
  return query
  select f.kind, f.id, f.title, f.detail, f.author_id, f.author, f.created_at, f.status,
         h.hidden_at, hp.full_name, h.reason,
         public.content_can_hide(f.kind), public.is_admin() and f.kind <> 'message', public.is_super_admin()
  from (
    select 'post'::text as kind, x.id, left(x.body, 80) as title, left(x.body, 400) as detail, x.author_id, p.full_name as author, x.created_at, x.status::text as status
      from public.posts x left join public.profiles p on p.id = x.author_id where x.school_id = v_school and p_kind in ('all', 'post')
    union all
    select 'comment', x.id, left(x.body, 80), left(x.body, 400), x.author_id, p.full_name, x.created_at, x.status::text
      from public.post_comments x left join public.profiles p on p.id = x.author_id where x.school_id = v_school and p_kind in ('all', 'comment')
    union all
    -- Group and club chats only. Private one-to-one messages are never listed here.
    select 'message', x.id, left(x.body, 80), left(x.body, 400), x.sender_id, p.full_name, x.created_at, x.status::text
      from public.messages x
      join public.conversations c on c.id = x.conversation_id and c.kind <> 'direct'
      left join public.profiles p on p.id = x.sender_id
      where x.school_id = v_school and p_kind in ('all', 'message')
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
    select 'poll', x.id, left(x.question, 80), left(x.question, 400), x.created_by, p.full_name, x.created_at,
           case when x.closes_at > now() then 'open' else 'closed' end
      from public.polls x left join public.profiles p on p.id = x.created_by where x.school_id = v_school and p_kind in ('all', 'poll')
    union all
    select 'resource', x.id, x.title, left(coalesce(x.description, ''), 400), x.submitter_id, p.full_name, x.created_at, x.visibility::text
      from public.library_resources x left join public.profiles p on p.id = x.submitter_id where x.school_id = v_school and p_kind in ('all', 'resource')
  ) f
  left join public.admin_hidden h on h.kind = f.kind and h.id = f.id
  left join public.profiles hp on hp.id = h.hidden_by
  where (p_view = 'removed') = (h.id is not null)
  order by coalesce(h.hidden_at, f.created_at) desc
  limit v_limit;
end;
$$;
revoke all on function public.admin_content_list(text, text, int) from public, anon;
grant execute on function public.admin_content_list(text, text, int) to authenticated;

-- Hide: the item stays in the database, disappears for students, and can be restored.
create function public.admin_hide_content(p_kind text, p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
  v_owner uuid; v_title text; v_prev text; v_found boolean := false;
begin
  if not public.content_can_hide(p_kind) then
    raise exception 'You do not have permission to hide this kind of content.';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Write a short reason (the person who made it is told).';
  end if;
  if exists (select 1 from public.admin_hidden where kind = p_kind and id = p_id) then
    raise exception 'It is already hidden.';
  end if;

  if p_kind = 'post' then
    select author_id, left(body, 60), status into v_owner, v_title, v_prev from public.posts where id = p_id and school_id = v_school;
    v_found := found; update public.posts set status = 'removed' where id = p_id and school_id = v_school;
  elsif p_kind = 'comment' then
    select author_id, left(body, 60), status into v_owner, v_title, v_prev from public.post_comments where id = p_id and school_id = v_school;
    v_found := found; update public.post_comments set status = 'removed' where id = p_id and school_id = v_school;
  elsif p_kind = 'listing' then
    select seller_id, title, status into v_owner, v_title, v_prev from public.listings where id = p_id and school_id = v_school;
    v_found := found; update public.listings set status = 'removed' where id = p_id and school_id = v_school;
  elsif p_kind = 'message' then
    select m.sender_id, left(m.body, 60), m.status into v_owner, v_title, v_prev
      from public.messages m join public.conversations c on c.id = m.conversation_id and c.kind <> 'direct'
      where m.id = p_id and m.school_id = v_school;
    v_found := found; update public.messages set status = 'removed' where id = p_id and school_id = v_school;
  elsif p_kind = 'group' then
    select created_by, name, status into v_owner, v_title, v_prev from public.groups where id = p_id and school_id = v_school;
    v_found := found; update public.groups set status = 'archived' where id = p_id and school_id = v_school;
  elsif p_kind = 'club' then
    select requested_by, name, status into v_owner, v_title, v_prev from public.clubs where id = p_id and school_id = v_school;
    v_found := found; update public.clubs set status = 'archived' where id = p_id and school_id = v_school;
  elsif p_kind = 'event' then
    select created_by, title, status into v_owner, v_title, v_prev from public.events where id = p_id and school_id = v_school;
    v_found := found; update public.events set status = 'cancelled' where id = p_id and school_id = v_school;
  elsif p_kind = 'resource' then
    select submitter_id, title, visibility into v_owner, v_title, v_prev from public.library_resources where id = p_id and school_id = v_school and deleted_at is null;
    v_found := found; update public.library_resources set visibility = 'removed', deleted_at = now() where id = p_id and school_id = v_school;
  else
    raise exception 'This kind cannot be hidden.';
  end if;
  if not v_found then raise exception 'That item no longer exists.'; end if;

  insert into public.admin_hidden (kind, id, school_id, prev_status, hidden_by, reason) values (p_kind, p_id, v_school, v_prev, auth.uid(), v_reason);
  insert into public.moderation_log (school_id, actor_id, action, target_type, target_id, details)
  values (v_school, auth.uid(), 'hide_' || p_kind, p_kind, p_id, left('"' || coalesce(v_title, '') || '" hidden (was ' || coalesce(v_prev, '?') || ') — ' || v_reason, 500));
  if v_owner is not null and v_owner <> auth.uid() then
    perform public.notify(v_owner, 'removed', 'Something you made was removed', coalesce(v_title, '') || ' — ' || v_reason, null);
  end if;
end;
$$;
revoke all on function public.admin_hide_content(text, uuid, text) from public, anon;
grant execute on function public.admin_hide_content(text, uuid, text) to authenticated;

-- The old name keeps working, and now only hides (nothing is erased by accident).
drop function if exists public.admin_remove_content(text, uuid, text);
create function public.admin_remove_content(p_kind text, p_id uuid, p_reason text) returns void
language sql security definer set search_path = '' as $$
  select public.admin_hide_content(p_kind, p_id, p_reason)
$$;
revoke all on function public.admin_remove_content(text, uuid, text) from public, anon;
grant execute on function public.admin_remove_content(text, uuid, text) to authenticated;

create function public.admin_restore_content(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  h public.admin_hidden;
begin
  if not public.content_can_hide(p_kind) then
    raise exception 'You do not have permission to restore this kind of content.';
  end if;
  select * into h from public.admin_hidden where kind = p_kind and id = p_id and school_id = v_school;
  if h.id is null then raise exception 'It is not hidden.'; end if;

  if p_kind = 'post' then update public.posts set status = coalesce(h.prev_status, 'visible') where id = p_id and school_id = v_school;
  elsif p_kind = 'comment' then update public.post_comments set status = coalesce(h.prev_status, 'visible') where id = p_id and school_id = v_school;
  elsif p_kind = 'listing' then update public.listings set status = coalesce(h.prev_status, 'active') where id = p_id and school_id = v_school;
  elsif p_kind = 'message' then update public.messages set status = coalesce(h.prev_status, 'visible') where id = p_id and school_id = v_school;
  elsif p_kind = 'group' then update public.groups set status = coalesce(h.prev_status, 'active') where id = p_id and school_id = v_school;
  elsif p_kind = 'club' then update public.clubs set status = coalesce(h.prev_status, 'approved') where id = p_id and school_id = v_school;
  elsif p_kind = 'event' then update public.events set status = coalesce(h.prev_status, 'approved') where id = p_id and school_id = v_school;
  elsif p_kind = 'resource' then update public.library_resources set visibility = coalesce(h.prev_status, 'visible'), deleted_at = null where id = p_id and school_id = v_school;
  else raise exception 'This kind cannot be restored.';
  end if;
  delete from public.admin_hidden where kind = p_kind and id = p_id;
  insert into public.moderation_log (school_id, actor_id, action, target_type, target_id, details)
  values (v_school, auth.uid(), 'restore_' || p_kind, p_kind, p_id, 'Restored to ' || coalesce(h.prev_status, 'its previous state'));
end;
$$;
revoke all on function public.admin_restore_content(text, uuid) from public, anon;
grant execute on function public.admin_restore_content(text, uuid) to authenticated;

-- Edit the words of something. The old and new text go to the activity log.
create function public.admin_edit_content(p_kind text, p_id uuid, p_title text, p_detail text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_old text; v_title text := btrim(coalesce(p_title, '')); v_detail text := btrim(coalesce(p_detail, ''));
begin
  if not public.is_admin() then
    raise exception 'Only admins can edit content.';
  end if;
  if p_kind = 'post' then
    select left(body, 200) into v_old from public.posts where id = p_id and school_id = v_school;
    if not found then raise exception 'That item no longer exists.'; end if;
    if char_length(v_detail) < 1 then raise exception 'The text cannot be empty.'; end if;
    update public.posts set body = left(v_detail, 5000) where id = p_id and school_id = v_school;
  elsif p_kind = 'comment' then
    select left(body, 200) into v_old from public.post_comments where id = p_id and school_id = v_school;
    if not found then raise exception 'That item no longer exists.'; end if;
    if char_length(v_detail) < 1 then raise exception 'The text cannot be empty.'; end if;
    update public.post_comments set body = left(v_detail, 2000) where id = p_id and school_id = v_school;
  elsif p_kind = 'listing' then
    select title into v_old from public.listings where id = p_id and school_id = v_school;
    if not found then raise exception 'That item no longer exists.'; end if;
    if char_length(v_title) < 3 then raise exception 'The title needs at least 3 letters.'; end if;
    update public.listings set title = left(v_title, 80), description = left(v_detail, 800) where id = p_id and school_id = v_school;
  elsif p_kind = 'group' then
    select name into v_old from public.groups where id = p_id and school_id = v_school;
    if not found then raise exception 'That item no longer exists.'; end if;
    if char_length(v_title) < 2 then raise exception 'The name needs at least 2 letters.'; end if;
    update public.groups set name = left(v_title, 80), description = left(v_detail, 500) where id = p_id and school_id = v_school;
  elsif p_kind = 'club' then
    select name into v_old from public.clubs where id = p_id and school_id = v_school;
    if not found then raise exception 'That item no longer exists.'; end if;
    if char_length(v_title) < 2 then raise exception 'The name needs at least 2 letters.'; end if;
    update public.clubs set name = left(v_title, 80), description = left(v_detail, 1000) where id = p_id and school_id = v_school;
  elsif p_kind = 'event' then
    select title into v_old from public.events where id = p_id and school_id = v_school;
    if not found then raise exception 'That item no longer exists.'; end if;
    if char_length(v_title) < 3 then raise exception 'The title needs at least 3 letters.'; end if;
    update public.events set title = left(v_title, 120), description = left(v_detail, 2000) where id = p_id and school_id = v_school;
  elsif p_kind = 'poll' then
    select question into v_old from public.polls where id = p_id and school_id = v_school;
    if not found then raise exception 'That item no longer exists.'; end if;
    if char_length(v_title) < 3 then raise exception 'Write the question.'; end if;
    update public.polls set question = left(v_title, 200) where id = p_id and school_id = v_school;
  else
    raise exception 'This kind cannot be edited.';
  end if;
  insert into public.moderation_log (school_id, actor_id, action, target_type, target_id, details)
  values (v_school, auth.uid(), 'edit_' || p_kind, p_kind, p_id, left('Was: "' || coalesce(v_old, '') || '"', 500));
end;
$$;
revoke all on function public.admin_edit_content(text, uuid, text, text) from public, anon;
grant execute on function public.admin_edit_content(text, uuid, text, text) to authenticated;

create function public.admin_close_poll(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_school uuid := public.my_school_id();
begin
  if not public.is_admin() then raise exception 'Only admins can close polls.'; end if;
  update public.polls set closes_at = now() where id = p_id and school_id = v_school and closes_at > now();
  if not found then raise exception 'That poll is not open.'; end if;
  insert into public.moderation_log (school_id, actor_id, action, target_type, target_id, details)
  values (v_school, auth.uid(), 'close_poll', 'poll', p_id, 'Closed early');
end;
$$;
revoke all on function public.admin_close_poll(uuid) from public, anon;
grant execute on function public.admin_close_poll(uuid) to authenticated;

-- Delete for good: Super Admin only, and only after the item was hidden first (polls can be deleted directly). A copy of the
-- record's text goes to the activity log.
create function public.admin_purge_content(p_kind text, p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
  v_copy text;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can delete for good.';
  end if;
  if char_length(v_reason) < 3 then raise exception 'Write a short reason.'; end if;
  if p_kind <> 'poll' and not exists (select 1 from public.admin_hidden where kind = p_kind and id = p_id and school_id = v_school) then
    raise exception 'Hide it first. Only hidden items can be deleted for good.';
  end if;

  if p_kind = 'post' then select to_jsonb(x)::text into v_copy from public.posts x where id = p_id and school_id = v_school; delete from public.posts where id = p_id and school_id = v_school;
  elsif p_kind = 'comment' then select to_jsonb(x)::text into v_copy from public.post_comments x where id = p_id and school_id = v_school; delete from public.post_comments where id = p_id and school_id = v_school;
  elsif p_kind = 'listing' then select to_jsonb(x)::text into v_copy from public.listings x where id = p_id and school_id = v_school; delete from public.listings where id = p_id and school_id = v_school;
  elsif p_kind = 'message' then
    select to_jsonb(x)::text into v_copy from public.messages x join public.conversations c on c.id = x.conversation_id and c.kind <> 'direct' where x.id = p_id and x.school_id = v_school;
    delete from public.messages where id = p_id and school_id = v_school and conversation_id in (select id from public.conversations where kind <> 'direct');
  elsif p_kind = 'group' then select to_jsonb(x)::text into v_copy from public.groups x where id = p_id and school_id = v_school; delete from public.groups where id = p_id and school_id = v_school;
  elsif p_kind = 'club' then select to_jsonb(x)::text into v_copy from public.clubs x where id = p_id and school_id = v_school; delete from public.clubs where id = p_id and school_id = v_school;
  elsif p_kind = 'event' then select to_jsonb(x)::text into v_copy from public.events x where id = p_id and school_id = v_school; delete from public.events where id = p_id and school_id = v_school;
  elsif p_kind = 'poll' then select to_jsonb(x)::text into v_copy from public.polls x where id = p_id and school_id = v_school; delete from public.polls where id = p_id and school_id = v_school;
  elsif p_kind = 'resource' then select to_jsonb(x)::text into v_copy from public.library_resources x where id = p_id and school_id = v_school; delete from public.library_resources where id = p_id and school_id = v_school;
  else raise exception 'Unknown kind.';
  end if;
  if v_copy is null then raise exception 'That item no longer exists.'; end if;

  delete from public.admin_hidden where kind = p_kind and id = p_id;
  insert into public.moderation_log (school_id, actor_id, action, target_type, target_id, details)
  values (v_school, auth.uid(), 'purge_' || p_kind, p_kind, p_id, left(v_reason || ' — copy: ' || v_copy, 2000));
end;
$$;
revoke all on function public.admin_purge_content(text, uuid, text) from public, anon;
grant execute on function public.admin_purge_content(text, uuid, text) to authenticated;

-- Private conversations are never browsable. A Super Admin can open the messages around ONE reported message, only with a
-- reason, and every opening is written to the activity log.
create function public.admin_review_reported_conversation(p_report uuid, p_reason text)
returns table (id uuid, sender text, body text, created_at timestamptz, reported boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
  r public.reports;
  m public.messages;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can open a reported conversation.';
  end if;
  if char_length(v_reason) < 10 then
    raise exception 'Explain why you need to read it (at least 10 characters). This is recorded.';
  end if;
  select * into r from public.reports where reports.id = p_report and school_id = v_school and target_type = 'message';
  if r.id is null then raise exception 'That report is not about a message.'; end if;
  select * into m from public.messages where messages.id = r.target_id and school_id = v_school;
  if m.id is null then raise exception 'The reported message no longer exists.'; end if;

  insert into public.moderation_log (school_id, actor_id, action, target_type, target_id, details)
  values (v_school, auth.uid(), 'open_reported_conversation', 'report', p_report, left('Reason: ' || v_reason, 500));

  return query
  select x.id, p.full_name, x.body, x.created_at, (x.id = m.id)
  from (
    select mm.id, mm.sender_id, mm.body, mm.created_at from public.messages mm
    where mm.conversation_id = m.conversation_id and mm.school_id = v_school and mm.status = 'visible' and mm.created_at <= m.created_at
    order by mm.created_at desc limit 8
  ) x
  left join public.profiles p on p.id = x.sender_id
  union all
  select x.id, p.full_name, x.body, x.created_at, false
  from (
    select mm.id, mm.sender_id, mm.body, mm.created_at from public.messages mm
    where mm.conversation_id = m.conversation_id and mm.school_id = v_school and mm.status = 'visible' and mm.created_at > m.created_at
    order by mm.created_at asc limit 4
  ) x
  left join public.profiles p on p.id = x.sender_id
  order by 4;
end;
$$;
revoke all on function public.admin_review_reported_conversation(uuid, text) from public, anon;
grant execute on function public.admin_review_reported_conversation(uuid, text) to authenticated;
