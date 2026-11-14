-- Phase 4: school activities. Events and calendar, the volunteering hub and the Student Council hub.
-- Like the earlier phases: tables are read-only for signed-in users, every change is a function
-- that checks who is calling.

-- ---------------------------------------------------------------------------
-- A. Events
-- ---------------------------------------------------------------------------
alter table public.events
  add column category text not null default 'other'
    check (category in ('academic', 'arts', 'sports', 'social', 'community', 'club', 'other')),
  add column cover_path text,
  add column capacity int check (capacity between 1 and 5000),
  add column updated_at timestamptz not null default now();
create index on public.events (school_id, status, category, starts_at);

-- Going or on the waiting list. Everyone already going stays "going".
alter table public.event_rsvps
  add column status text not null default 'going' check (status in ('going', 'waitlist'));
create index on public.event_rsvps (event_id, status, created_at);

drop policy "create events" on public.events;
drop policy "rsvp" on public.event_rsvps;
drop policy "cancel rsvp" on public.event_rsvps;
revoke insert, update, delete on public.events from authenticated;
revoke insert, update, delete on public.event_rsvps from authenticated;

-- The people who run an event with its creator (the organizing team).
create table public.event_organizers (
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
create index on public.event_organizers (profile_id);
alter table public.event_organizers enable row level security;
create policy "see organizers" on public.event_organizers for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.event_organizers from authenticated;

drop policy "see events" on public.events;
create policy "see events" on public.events for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (status in ('approved', 'cancelled') or created_by = (select auth.uid()) or public.is_staff()
         or (club_id is not null and public.is_club_leader(club_id))
         or exists (select 1 from public.event_organizers o where o.event_id = events.id and o.profile_id = (select auth.uid())))
  );

-- Announcements from the organizers and a record of important changes.
create table public.event_updates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  author_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('announcement', 'change')),
  title text not null check (char_length(title) between 1 and 100),
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);
create index on public.event_updates (event_id, created_at desc);
alter table public.event_updates enable row level security;
create policy "see updates of visible events" on public.event_updates for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader()
         and exists (select 1 from public.events e where e.id = event_updates.event_id));
revoke insert, update, delete on public.event_updates from authenticated;

-- Photos and documents for an event (a poster, a map, a permission slip).
create table public.event_attachments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  path text not null,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('image', 'pdf')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.event_attachments (event_id);
alter table public.event_attachments enable row level security;
create policy "see attachments of visible events" on public.event_attachments for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader()
         and exists (select 1 from public.events e where e.id = event_attachments.event_id));
revoke insert, update, delete on public.event_attachments from authenticated;

-- Every event gets a group chat.
alter table public.conversations drop constraint conversations_kind_check;
alter table public.conversations add constraint conversations_kind_check
  check (kind in ('club', 'direct', 'group', 'groupchat', 'eventchat'));
alter table public.conversations add column event_id uuid unique references public.events (id) on delete cascade;
alter table public.conversations add constraint conversations_eventchat_check check ((kind = 'eventchat') = (event_id is not null));

-- The old rule decided "approved or pending" by role. Now only create_event inserts events (the table is
-- closed to direct inserts), and it decides who publishes directly, so the trigger no longer touches the status.
create or replace function public.events_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.school_id := public.my_school_id();
  end if;
  if public.contains_blocked_word(new.school_id, new.title || ' ' || new.description || ' ' || new.location) then
    raise exception 'BLOCKED_WORD: Please remove inappropriate words from the event.';
  end if;
  return new;
end;
$$;

-- Organizers: the creator, the team, a club's leaders, moderators and admins.
create or replace function public.can_manage_event(e public.events) returns boolean
language sql stable security definer set search_path = '' as $$
  select e.school_id = public.my_school_id() and public.is_active() and (
    public.is_staff()
    or e.created_by = (select auth.uid())
    or exists (select 1 from public.event_organizers o where o.event_id = e.id and o.profile_id = (select auth.uid()))
    or (e.club_id is not null and public.is_club_leader(e.club_id))
  )
$$;

create function public.can_manage_event_id(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event and public.can_manage_event(e))
$$;

-- Keeps the event chat's members in step with the people involved in the event.
create function public.event_chat_sync(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_chat uuid;
  v_want uuid[];
  e public.events;
begin
  select * into e from public.events where id = p_event;
  select id into v_chat from public.conversations where event_id = p_event;
  if e.id is null or v_chat is null then
    return;
  end if;
  select coalesce(array_agg(distinct w), '{}') into v_want from (
    select e.created_by as w where e.created_by is not null
    union select profile_id from public.event_organizers where event_id = p_event
    union select profile_id from public.event_rsvps where event_id = p_event and status = 'going'
    union select a.profile_id from public.volunteer_applications a
      join public.volunteer_opportunities o on o.id = a.opportunity_id
      where o.event_id = p_event and a.status in ('accepted', 'completed')
  ) t;
  delete from public.conversation_members m where m.conversation_id = v_chat and not (m.profile_id = any (v_want));
  insert into public.conversation_members (conversation_id, profile_id)
  select v_chat, p.id from public.profiles p where p.id = any (v_want) and p.deactivated_at is null
  on conflict do nothing;
end;
$$;

create function public.ensure_event_chat(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  select * into e from public.events where id = p_event;
  if e.id is null or e.status <> 'approved' then
    return;
  end if;
  insert into public.conversations (school_id, kind, event_id, title, created_by)
  values (e.school_id, 'eventchat', e.id, left(e.title, 60), e.created_by)
  on conflict (event_id) do nothing;
  perform public.event_chat_sync(p_event);
end;
$$;

create function public.event_people_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.event_chat_sync(coalesce(new.event_id, old.event_id));
  return coalesce(new, old);
end;
$$;
create trigger chat_sync after insert or update or delete on public.event_rsvps
  for each row execute function public.event_people_changed();
create trigger chat_sync after insert or update or delete on public.event_organizers
  for each row execute function public.event_people_changed();

-- Moves people off the waiting list while there is room.
create function public.promote_waitlist(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  r record;
begin
  select * into e from public.events where id = p_event;
  if e.id is null or e.capacity is null then
    return;
  end if;
  while (select count(*) from public.event_rsvps where event_id = p_event and status = 'going') < e.capacity loop
    select * into r from public.event_rsvps where event_id = p_event and status = 'waitlist' order by created_at limit 1;
    exit when r.event_id is null;
    update public.event_rsvps set status = 'going' where event_id = p_event and profile_id = r.profile_id;
    perform public.notify(r.profile_id, 'event_waitlist', '🎉 A spot opened: ' || e.title,
      'You are now going. ' || public.local_time(e.starts_at), '/events/' || e.id);
  end loop;
end;
$$;

-- Who hears about an event: people going, on the list, and accepted volunteers.
create function public.event_audience(p_event uuid) returns table (profile_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
    select r.profile_id from public.event_rsvps r where r.event_id = p_event
    union select a.profile_id from public.volunteer_applications a
      join public.volunteer_opportunities o on o.id = a.opportunity_id
      where o.event_id = p_event and a.status in ('accepted', 'completed');
end;
$$;

-- ---- Create (publish or propose) ----------------------------------------------
create function public.create_event(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_school uuid := public.my_school_id();
  v_title text := left(btrim(coalesce(p ->> 'title', '')), 100);
  v_desc text := left(btrim(coalesce(p ->> 'description', '')), 1500);
  v_loc text := left(btrim(coalesce(p ->> 'location', '')), 100);
  v_cat text := coalesce(nullif(p ->> 'category', ''), 'other');
  v_club uuid := nullif(p ->> 'club_id', '')::uuid;
  v_cap int := nullif(p ->> 'capacity', '')::int;
  v_starts timestamptz := (p ->> 'starts_at')::timestamptz;
  v_ends timestamptz := nullif(p ->> 'ends_at', '')::timestamptz;
  v_cover text := nullif(btrim(coalesce(p ->> 'cover_path', '')), '');
  v_team uuid[] := '{}';
  v_direct boolean;
  v_id uuid;
  v_x uuid;
begin
  if not public.is_active() then
    raise exception 'Your account cannot create events right now.';
  end if;
  if public.is_restricted('publishing') then
    raise exception 'You cannot publish events right now.';
  end if;
  if char_length(v_title) < 3 then
    raise exception 'Give the event a title.';
  end if;
  if v_starts is null or v_starts <= now() then
    raise exception 'The start time must be in the future.';
  end if;
  if v_ends is not null and v_ends <= v_starts then
    raise exception 'The end time must be after the start time.';
  end if;
  if v_cat not in ('academic', 'arts', 'sports', 'social', 'community', 'club', 'other') then
    raise exception 'Choose a category.';
  end if;
  if v_cap is not null and v_cap not between 1 and 5000 then
    raise exception 'The limit must be between 1 and 5000 people.';
  end if;
  if v_club is not null and not exists (select 1 from public.clubs where id = v_club and school_id = v_school and status = 'approved') then
    raise exception 'Club not found.';
  end if;
  if v_cover is not null and v_cover not like v_school::text || '/' || me::text || '/%' then
    raise exception 'That cover photo is not yours.';
  end if;
  perform public.reject_blocked(v_school, v_title || ' ' || v_desc || ' ' || v_loc);

  -- Admins and the Student Council publish directly, and so do a club's leaders for their club.
  v_direct := public.is_admin() or public.has_leadership('council_member')
              or (v_club is not null and public.is_club_leader(v_club));
  if not v_direct then
    if not public.is_current_student(me) then
      raise exception 'Only students can propose events.';
    end if;
    perform public.check_rate('event_propose', 5, 86400);
  else
    perform public.check_rate('event_create', 20, 86400);
  end if;

  insert into public.events (school_id, club_id, title, description, location, starts_at, ends_at, status, created_by,
                             category, cover_path, capacity, reviewed_by, reviewed_at)
  values (v_school, v_club, v_title, v_desc, v_loc, v_starts, v_ends, case when v_direct then 'approved' else 'pending' end, me,
          v_cat, v_cover, v_cap, case when v_direct then me end, case when v_direct then now() end)
  returning id into v_id;

  select coalesce(array_agg(distinct t.val::uuid), '{}') into v_team
  from jsonb_array_elements_text(coalesce(p -> 'organizers', '[]')) as t(val);
  foreach v_x in array v_team loop
    if v_x <> me and exists (select 1 from public.profiles where id = v_x and school_id = v_school and deactivated_at is null) then
      insert into public.event_organizers (event_id, profile_id, school_id, added_by) values (v_id, v_x, v_school, me)
      on conflict do nothing;
    end if;
  end loop;

  if v_direct then
    perform public.ensure_event_chat(v_id);
    perform public.log_action(v_school, 'publish_event', 'event', v_id, v_title);
  else
    insert into public.notifications (school_id, recipient_id, kind, title, body, link)
    select v_school, pr.id, 'event_proposal', 'An event is waiting for approval', v_title, '/moderation'
    from public.profiles pr
    where pr.school_id = v_school and pr.deactivated_at is null and pr.role in ('admin', 'super_admin');
  end if;
  return v_id;
end;
$$;

-- Admins approve or reject what students propose.
create or replace function public.review_event(p_event uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve event proposals.';
  end if;
  select * into e from public.events
  where id = p_event and school_id = public.my_school_id() and status = 'pending';
  if e.id is null then
    raise exception 'Event request not found.';
  end if;
  if not p_approve and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Tell the student why it was not approved.';
  end if;

  update public.events
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = e.id;

  if p_approve then
    perform public.notify(e.created_by, 'event_approved', '✅ Your event "' || e.title || '" was approved',
      public.local_time(e.starts_at), '/events/' || e.id);
    perform public.notify_club_about_event(e.id);
    perform public.ensure_event_chat(e.id);
  else
    perform public.notify(e.created_by, 'event_rejected', 'Your event "' || e.title || '" was not approved',
      coalesce(nullif(btrim(p_note), ''), 'Talk to an admin to find out more.'), '/events');
  end if;
  perform public.log_action(e.school_id, case when p_approve then 'approve_event' else 'reject_event' end,
    'event', e.id, e.title || coalesce(' — ' || nullif(btrim(p_note), ''), ''));
end;
$$;

-- ---- Edit a published event ----------------------------------------------------
create function public.update_event(p_event uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  e public.events;
  v_title text := left(btrim(coalesce(p ->> 'title', '')), 100);
  v_desc text := left(btrim(coalesce(p ->> 'description', '')), 1500);
  v_loc text := left(btrim(coalesce(p ->> 'location', '')), 100);
  v_cat text := coalesce(nullif(p ->> 'category', ''), 'other');
  v_cap int := nullif(p ->> 'capacity', '')::int;
  v_starts timestamptz := (p ->> 'starts_at')::timestamptz;
  v_ends timestamptz := nullif(p ->> 'ends_at', '')::timestamptz;
  v_cover text := nullif(btrim(coalesce(p ->> 'cover_path', '')), '');
  v_changes text[] := '{}';
begin
  select * into e from public.events where id = p_event for update;
  if e.id is null or not public.can_manage_event(e) then
    raise exception 'You cannot change this event.';
  end if;
  if e.status not in ('approved', 'pending') then
    raise exception 'This event is closed.';
  end if;
  if char_length(v_title) < 3 then
    raise exception 'Give the event a title.';
  end if;
  if v_starts is null then
    raise exception 'Choose when the event starts.';
  end if;
  if v_starts is distinct from e.starts_at and v_starts <= now() then
    raise exception 'The new start time must be in the future.';
  end if;
  if v_ends is not null and v_ends <= v_starts then
    raise exception 'The end time must be after the start time.';
  end if;
  if v_cat not in ('academic', 'arts', 'sports', 'social', 'community', 'club', 'other') then
    raise exception 'Choose a category.';
  end if;
  if v_cap is not null and v_cap not between 1 and 5000 then
    raise exception 'The limit must be between 1 and 5000 people.';
  end if;
  if v_cover is not null and v_cover is distinct from e.cover_path
     and v_cover not like e.school_id::text || '/' || me::text || '/%' then
    raise exception 'That cover photo is not yours.';
  end if;
  perform public.reject_blocked(e.school_id, v_title || ' ' || v_desc || ' ' || v_loc);

  if v_title <> e.title then v_changes := v_changes || ('New name: ' || v_title); end if;
  if v_starts is distinct from e.starts_at or v_ends is distinct from e.ends_at then
    v_changes := v_changes || ('New time: ' || public.local_time(v_starts)); end if;
  if v_loc <> e.location then v_changes := v_changes || ('New place: ' || coalesce(nullif(v_loc, ''), 'to be announced')); end if;

  update public.events set title = v_title, description = v_desc, location = v_loc, category = v_cat,
    capacity = v_cap, starts_at = v_starts, ends_at = v_ends, cover_path = v_cover, updated_at = now()
  where id = e.id;
  update public.conversations set title = left(v_title, 60) where event_id = e.id;
  perform public.promote_waitlist(e.id);

  if e.status = 'approved' and cardinality(v_changes) > 0 then
    insert into public.event_updates (event_id, school_id, author_id, kind, title, body)
    values (e.id, e.school_id, me, 'change', 'Event details changed', array_to_string(v_changes, E'\n'));
    insert into public.notifications (school_id, recipient_id, kind, title, body, link)
    select e.school_id, a.profile_id, 'event_changed', '✏️ Changed: ' || v_title, array_to_string(v_changes, ' · '), '/events/' || e.id
    from public.event_audience(e.id) a where a.profile_id <> me;
  end if;
  perform public.log_action(e.school_id, 'edit_event', 'event', e.id, v_title);
end;
$$;

create function public.post_event_update(p_event uuid, p_title text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  v_title text := left(btrim(coalesce(p_title, '')), 100);
  v_body text := left(btrim(coalesce(p_body, '')), 1000);
begin
  select * into e from public.events where id = p_event;
  if e.id is null or not public.can_manage_event(e) then
    raise exception 'Only the organizers can post updates.';
  end if;
  if e.status <> 'approved' then
    raise exception 'The event is not published.';
  end if;
  if char_length(v_title) < 1 then
    raise exception 'Write a short title.';
  end if;
  perform public.reject_blocked(e.school_id, v_title || ' ' || v_body);
  perform public.check_rate('event_update', 10, 3600);
  insert into public.event_updates (event_id, school_id, author_id, kind, title, body)
  values (e.id, e.school_id, auth.uid(), 'announcement', v_title, v_body);
  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select e.school_id, a.profile_id, 'event_update', '📣 ' || e.title || ': ' || v_title, left(v_body, 140), '/events/' || e.id
  from public.event_audience(e.id) a where a.profile_id <> auth.uid();
end;
$$;

create function public.set_event_organizers(p_event uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  x uuid;
begin
  select * into e from public.events where id = p_event;
  if e.id is null or not (e.created_by = auth.uid() or public.is_admin()
                          or (e.club_id is not null and public.is_club_leader(e.club_id))) then
    raise exception 'Only the creator, the club leaders or an admin can choose the organizing team.';
  end if;
  p_ids := coalesce(p_ids, '{}');
  if cardinality(p_ids) > 8 then
    raise exception 'The team can have at most 8 people.';
  end if;
  delete from public.event_organizers where event_id = e.id and not (profile_id = any (p_ids));
  foreach x in array p_ids loop
    if x <> e.created_by and exists (select 1 from public.profiles where id = x and school_id = e.school_id and deactivated_at is null) then
      insert into public.event_organizers (event_id, profile_id, school_id, added_by) values (e.id, x, e.school_id, auth.uid())
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

create function public.add_event_attachment(p_event uuid, p_path text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  v_id uuid;
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  v_kind text;
begin
  select * into e from public.events where id = p_event;
  if e.id is null or not public.can_manage_event(e) then
    raise exception 'Only the organizers can add files.';
  end if;
  if p_path is null or p_path not like e.school_id::text || '/' || e.id::text || '/%' then
    raise exception 'That file does not belong to this event.';
  end if;
  if (select count(*) from public.event_attachments where event_id = e.id) >= 6 then
    raise exception 'An event can have at most 6 files.';
  end if;
  v_kind := case when lower(p_path) like '%.pdf' then 'pdf' else 'image' end;
  if char_length(v_name) < 1 then v_name := 'File'; end if;
  insert into public.event_attachments (event_id, school_id, path, name, kind, created_by)
  values (e.id, e.school_id, p_path, v_name, v_kind, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create function public.remove_event_attachment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.event_attachments;
begin
  select * into a from public.event_attachments where id = p_id;
  if a.id is null or not public.can_manage_event_id(a.event_id) then
    raise exception 'You cannot remove this file.';
  end if;
  delete from public.event_attachments where id = a.id;
end;
$$;

-- Event files: private to the school; only the organizers can add them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-files', 'event-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create function public.event_file_uploader(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' then
      split_part(p_name, '/', 1) = public.my_school_id()::text
      and public.can_manage_event_id(split_part(p_name, '/', 2)::uuid)
    else false end
$$;
create policy "upload event files" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-files' and public.is_active() and public.event_file_uploader(name));
create policy "see event files" on storage.objects for select to authenticated
  using (bucket_id = 'event-files' and public.is_reader() and split_part(name, '/', 1) = public.my_school_id()::text);
create policy "delete event files" on storage.objects for delete to authenticated
  using (bucket_id = 'event-files' and public.event_file_uploader(name));

-- ---- Going, the waiting list, and attendance management --------------------------
create function public.join_event(p_event uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  e public.events;
  v_status text;
  v_existing text;
begin
  if not public.is_active() then
    raise exception 'Your account cannot do that right now.';
  end if;
  select * into e from public.events
  where id = p_event and school_id = public.my_school_id() and status = 'approved' for update;
  if e.id is null then
    raise exception 'This event is not available.';
  end if;
  if coalesce(e.ends_at, e.starts_at + interval '3 hours') <= now() then
    raise exception 'This event is over.';
  end if;
  select status into v_existing from public.event_rsvps where event_id = e.id and profile_id = me;
  if v_existing is not null then
    return v_existing;
  end if;
  perform public.check_rate('event_join', 60, 3600);
  if e.capacity is null or (select count(*) from public.event_rsvps where event_id = e.id and status = 'going') < e.capacity then
    v_status := 'going';
  else
    v_status := 'waitlist';
  end if;
  insert into public.event_rsvps (event_id, profile_id, school_id, status) values (e.id, me, e.school_id, v_status);
  return v_status;
end;
$$;

create function public.leave_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  select * into e from public.events where id = p_event for update;
  if e.id is null then
    return;
  end if;
  delete from public.event_rsvps where event_id = p_event and profile_id = auth.uid();
  perform public.promote_waitlist(p_event);
end;
$$;

-- Organizers move people between going, the list and out.
create function public.manage_attendee(p_event uuid, p_profile uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  select * into e from public.events where id = p_event for update;
  if e.id is null or not public.can_manage_event(e) then
    raise exception 'Only the organizers can manage who is going.';
  end if;
  if p_action = 'promote' then
    update public.event_rsvps set status = 'going' where event_id = p_event and profile_id = p_profile and status = 'waitlist';
    perform public.notify(p_profile, 'event_waitlist', '🎉 You are going: ' || e.title, public.local_time(e.starts_at), '/events/' || e.id);
  elsif p_action = 'waitlist' then
    update public.event_rsvps set status = 'waitlist' where event_id = p_event and profile_id = p_profile and status = 'going';
  elsif p_action = 'remove' then
    delete from public.event_rsvps where event_id = p_event and profile_id = p_profile;
    perform public.notify(p_profile, 'event_removed', 'You were removed from ' || e.title, 'Ask the organizers if this is a mistake.', '/events/' || e.id);
  else
    raise exception 'Unknown action.';
  end if;
  perform public.promote_waitlist(p_event);
end;
$$;

-- Reminders only go to people who are going, not to the waiting list.
do $$
declare
  f record;
  d text;
begin
  for f in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
    and p.proname = 'send_event_reminders' loop
    d := replace(pg_get_functiondef(f.oid), 'where e.id = r.event_id and e.status = ''approved''',
                 'where e.id = r.event_id and r.status = ''going'' and e.status = ''approved''');
    execute d;
  end loop;
end $$;

-- Cancelling tells everyone involved, not only the people going.
create or replace function public.cancel_event(p_event uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  select * into e from public.events where id = p_event;
  if e.id is null or not public.can_manage_event(e) then
    raise exception 'You cannot cancel this event.';
  end if;
  if e.status not in ('approved', 'pending') then
    raise exception 'This event is already closed.';
  end if;

  update public.events set status = 'cancelled', cancel_reason = nullif(btrim(p_reason), ''), updated_at = now()
  where id = e.id;

  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select e.school_id, a.profile_id, 'event_cancelled', '❌ Cancelled: ' || e.title,
         coalesce(nullif(btrim(p_reason), ''), 'This event will not happen.'), '/events/' || e.id
  from public.event_audience(e.id) a where a.profile_id <> auth.uid();

  perform public.log_action(e.school_id, 'cancel_event', 'event', e.id, e.title);
end;
$$;

-- ---------------------------------------------------------------------------
-- B. Volunteering hub
-- ---------------------------------------------------------------------------
create table public.volunteer_opportunities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 1500),
  requirements text not null default '' check (char_length(requirements) <= 500),
  location text not null default '' check (char_length(location) <= 100),
  starts_at timestamptz,
  ends_at timestamptz,
  spots int check (spots between 1 and 500),
  event_id uuid references public.events (id) on delete cascade,
  club_id uuid references public.clubs (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index on public.volunteer_opportunities (school_id, status, starts_at);
create index on public.volunteer_opportunities (event_id);
create index on public.volunteer_opportunities (created_by);
alter table public.volunteer_opportunities enable row level security;

create function public.can_manage_opportunity(p_opp uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active() and exists (
    select 1 from public.volunteer_opportunities o
    where o.id = p_opp and o.school_id = public.my_school_id()
      and (o.created_by = (select auth.uid()) or public.is_admin()
           or (o.event_id is not null and public.can_manage_event_id(o.event_id)))
  )
$$;

create policy "see opportunities" on public.volunteer_opportunities for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader()
         and (status <> 'cancelled' or public.can_manage_opportunity(id)));
revoke insert, update, delete on public.volunteer_opportunities from authenticated;

create table public.volunteer_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.volunteer_opportunities (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  message text not null default '' check (char_length(message) <= 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'completed')),
  responsibility text not null default '' check (char_length(responsibility) <= 200),
  review_note text,
  hours numeric(3, 1),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (opportunity_id, profile_id)
);
create index on public.volunteer_applications (profile_id, created_at desc);
create index on public.volunteer_applications (opportunity_id, status);
alter table public.volunteer_applications enable row level security;
create policy "see own or managed applications" on public.volunteer_applications for select to authenticated
  using (profile_id = (select auth.uid()) or public.can_manage_opportunity(opportunity_id));
revoke insert, update, delete on public.volunteer_applications from authenticated;

alter table public.volunteer_entries add column application_id uuid unique references public.volunteer_applications (id) on delete set null;

create function public.can_publish_volunteering() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_leadership('council_member') or public.has_leadership('school_staff')
    or exists (select 1 from public.club_members where profile_id = (select auth.uid()) and role = 'leader')
$$;

create function public.publish_opportunity(p jsonb, p_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_school uuid := public.my_school_id();
  v_title text := left(btrim(coalesce(p ->> 'title', '')), 100);
  v_desc text := left(btrim(coalesce(p ->> 'description', '')), 1500);
  v_req text := left(btrim(coalesce(p ->> 'requirements', '')), 500);
  v_loc text := left(btrim(coalesce(p ->> 'location', '')), 100);
  v_starts timestamptz := nullif(p ->> 'starts_at', '')::timestamptz;
  v_ends timestamptz := nullif(p ->> 'ends_at', '')::timestamptz;
  v_spots int := nullif(p ->> 'spots', '')::int;
  v_event uuid := nullif(p ->> 'event_id', '')::uuid;
  v_club uuid;
  v_id uuid;
begin
  if not public.is_active() then
    raise exception 'Your account cannot do that right now.';
  end if;
  if char_length(v_title) < 3 then
    raise exception 'Give the opportunity a title.';
  end if;
  if v_spots is not null and v_spots not between 1 and 500 then
    raise exception 'Spots must be between 1 and 500.';
  end if;
  if v_ends is not null and v_starts is not null and v_ends <= v_starts then
    raise exception 'The end time must be after the start time.';
  end if;
  perform public.reject_blocked(v_school, v_title || ' ' || v_desc || ' ' || v_req || ' ' || v_loc);

  if v_event is not null then
    if not public.can_manage_event_id(v_event) then
      raise exception 'Only the organizers of that event can add volunteer roles to it.';
    end if;
    select club_id into v_club from public.events where id = v_event;
    if v_starts is null then
      select starts_at into v_starts from public.events where id = v_event;
    end if;
  elsif not public.can_publish_volunteering() then
    raise exception 'Only admins, the Student Council, school staff and club leaders can publish opportunities.';
  end if;

  if p_id is null then
    perform public.check_rate('volunteer_publish', 10, 86400);
    insert into public.volunteer_opportunities (school_id, title, description, requirements, location, starts_at, ends_at,
                                                spots, event_id, club_id, created_by)
    values (v_school, v_title, v_desc, v_req, v_loc, v_starts, v_ends, v_spots, v_event, v_club, me)
    returning id into v_id;
  else
    if not public.can_manage_opportunity(p_id) then
      raise exception 'You cannot change this opportunity.';
    end if;
    update public.volunteer_opportunities set title = v_title, description = v_desc, requirements = v_req, location = v_loc,
      starts_at = v_starts, ends_at = v_ends, spots = v_spots, updated_at = now()
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function public.set_opportunity_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.volunteer_opportunities;
begin
  if p_status not in ('open', 'closed', 'cancelled') then
    raise exception 'Unknown status.';
  end if;
  select * into o from public.volunteer_opportunities where id = p_id;
  if o.id is null or not public.can_manage_opportunity(p_id) then
    raise exception 'You cannot change this opportunity.';
  end if;
  update public.volunteer_opportunities set status = p_status, updated_at = now() where id = p_id;
  if p_status = 'cancelled' then
    insert into public.notifications (school_id, recipient_id, kind, title, body, link)
    select o.school_id, a.profile_id, 'volunteer_cancelled', 'Volunteering cancelled: ' || o.title, '', '/volunteering'
    from public.volunteer_applications a
    where a.opportunity_id = o.id and a.status in ('pending', 'accepted') and a.profile_id <> auth.uid();
  end if;
end;
$$;

create function public.apply_volunteer(p_opp uuid, p_message text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  o public.volunteer_opportunities;
  v_id uuid;
  v_msg text := left(btrim(coalesce(p_message, '')), 300);
begin
  if not public.is_active() or not public.is_current_student(me) then
    raise exception 'Only current students can volunteer.';
  end if;
  select * into o from public.volunteer_opportunities
  where id = p_opp and school_id = public.my_school_id() and status = 'open';
  if o.id is null then
    raise exception 'This opportunity is not open.';
  end if;
  if o.created_by = me then
    raise exception 'You organize this one.';
  end if;
  if o.event_id is not null and not exists (select 1 from public.events where id = o.event_id and status = 'approved') then
    raise exception 'The event is not published.';
  end if;
  perform public.reject_blocked(o.school_id, v_msg);
  perform public.check_rate('volunteer_apply', 20, 86400);
  insert into public.volunteer_applications (opportunity_id, profile_id, school_id, message)
  values (o.id, me, o.school_id, v_msg)
  on conflict (opportunity_id, profile_id) do update set status = 'pending', message = excluded.message, created_at = now()
    where public.volunteer_applications.status = 'withdrawn'
  returning id into v_id;
  if v_id is null then
    raise exception 'You already applied.';
  end if;
  if o.created_by is not null then
    perform public.notify(o.created_by, 'volunteer_application', 'New volunteer: ' || o.title,
      (select full_name from public.profiles where id = me), '/volunteering/manage/' || o.id);
  end if;
  return v_id;
end;
$$;

create function public.withdraw_application(p_app uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.volunteer_applications set status = 'withdrawn'
  where id = p_app and profile_id = auth.uid() and status in ('pending', 'accepted');
  if not found then
    raise exception 'Nothing to withdraw.';
  end if;
  perform public.event_chat_sync(o.event_id)
  from public.volunteer_applications a join public.volunteer_opportunities o on o.id = a.opportunity_id
  where a.id = p_app and o.event_id is not null;
end;
$$;

create function public.review_volunteer_application(p_app uuid, p_accept boolean, p_responsibility text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.volunteer_applications;
  o public.volunteer_opportunities;
  v_resp text := left(btrim(coalesce(p_responsibility, '')), 200);
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
begin
  select * into a from public.volunteer_applications where id = p_app and school_id = public.my_school_id() for update;
  if a.id is null then
    raise exception 'Application not found.';
  end if;
  select * into o from public.volunteer_opportunities where id = a.opportunity_id for update;
  if not public.can_manage_opportunity(o.id) then
    raise exception 'Only the organizers can review applications.';
  end if;
  if a.status not in ('pending', 'rejected', 'accepted') then
    raise exception 'This application cannot be changed.';
  end if;
  if a.profile_id = auth.uid() then
    raise exception 'You cannot review your own application.';
  end if;
  if p_accept then
    if o.spots is not null and a.status <> 'accepted'
       and (select count(*) from public.volunteer_applications where opportunity_id = o.id and status in ('accepted', 'completed')) >= o.spots then
      raise exception 'All the spots are taken.';
    end if;
    perform public.reject_blocked(o.school_id, v_resp);
    update public.volunteer_applications set status = 'accepted', responsibility = v_resp, review_note = v_note,
      reviewed_by = auth.uid(), reviewed_at = now() where id = a.id;
    perform public.notify(a.profile_id, 'volunteer_accepted', '💚 You are in: ' || o.title,
      coalesce(nullif(v_resp, ''), 'Open the volunteering page to see the details.'), '/volunteering');
  else
    if v_note is null then
      raise exception 'Tell the student why.';
    end if;
    update public.volunteer_applications set status = 'rejected', review_note = v_note,
      reviewed_by = auth.uid(), reviewed_at = now() where id = a.id;
    perform public.notify(a.profile_id, 'volunteer_rejected', 'Volunteering: not this time', o.title || ' — ' || v_note, '/volunteering');
  end if;
  if o.event_id is not null then
    perform public.event_chat_sync(o.event_id);
  end if;
end;
$$;

create function public.set_responsibility(p_app uuid, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.volunteer_applications;
  v_text text := left(btrim(coalesce(p_text, '')), 200);
begin
  select * into a from public.volunteer_applications where id = p_app and status in ('accepted', 'completed');
  if a.id is null or not public.can_manage_opportunity(a.opportunity_id) then
    raise exception 'You cannot change this assignment.';
  end if;
  perform public.reject_blocked(a.school_id, v_text);
  update public.volunteer_applications set responsibility = v_text where id = a.id;
  perform public.notify(a.profile_id, 'volunteer_assignment', 'Your volunteer role changed',
    coalesce(nullif(v_text, ''), 'Open the volunteering page.'), '/volunteering');
end;
$$;

-- When the volunteering is done the organizer records the hours: they join the student's
-- verified hours (and certificate) and earn points once.
create function public.complete_volunteering(p_app uuid, p_hours numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.volunteer_applications;
  o public.volunteer_opportunities;
  v_entry uuid;
  v_org text;
begin
  select * into a from public.volunteer_applications where id = p_app and school_id = public.my_school_id() for update;
  if a.id is null then
    raise exception 'Application not found.';
  end if;
  select * into o from public.volunteer_opportunities where id = a.opportunity_id;
  if not public.can_manage_opportunity(o.id) then
    raise exception 'Only the organizers can record hours.';
  end if;
  if a.profile_id = auth.uid() then
    raise exception 'You cannot record your own hours.';
  end if;
  if a.status <> 'accepted' then
    raise exception 'Only accepted volunteers can be marked as done.';
  end if;
  if p_hours is null or p_hours < 0.5 or p_hours > 12 then
    raise exception 'Hours must be between 0.5 and 12.';
  end if;
  select full_name into v_org from public.profiles where id = auth.uid();
  insert into public.volunteer_entries (school_id, profile_id, organization, description, activity_date, hours, supervisor_name,
                                        status, application_id)
  values (a.school_id, a.profile_id, o.title, a.responsibility, (now() at time zone 'Asia/Hebron')::date, round(p_hours, 1),
          coalesce(left(v_org, 80), ''), 'pending', a.id)
  returning id into v_entry;
  update public.volunteer_entries set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
    review_note = 'Recorded by the organizer' where id = v_entry;
  update public.volunteer_applications set status = 'completed', hours = round(p_hours, 1), completed_at = now() where id = a.id;
  perform public.award_points(a.profile_id, greatest(1, round(p_hours * 10)::int), 'volunteer', v_entry);
  perform public.notify(a.profile_id, 'volunteer_approved', '💚 ' || round(p_hours, 1) || ' volunteering hours recorded', o.title, '/volunteering');
  perform public.log_action(a.school_id, 'record_hours', 'volunteer', v_entry, round(p_hours, 1) || 'h · ' || o.title);
end;
$$;

-- A student's verified volunteering, for their profile (and later the Passport).
create function public.volunteer_history(p_profile uuid) returns table (organization text, hours numeric, activity_date date)
language sql stable security definer set search_path = '' as $$
  select e.organization, e.hours, e.activity_date from public.volunteer_entries e
  join public.profiles p on p.id = e.profile_id
  where e.profile_id = p_profile and e.status = 'approved'
    and p.school_id = public.my_school_id() and public.is_reader()
  order by e.activity_date desc
  limit 100
$$;

-- ---------------------------------------------------------------------------
-- C. Student Council hub
-- ---------------------------------------------------------------------------
create function public.can_post_council() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_leadership('council_member')
$$;

create table public.council_posts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  kind text not null check (kind in ('announcement', 'update', 'initiative', 'activity')),
  title text not null check (char_length(title) between 3 and 100),
  body text not null default '' check (char_length(body) <= 2000),
  status text check (status in ('planned', 'in_progress', 'done')),
  pinned boolean not null default false,
  event_id uuid references public.events (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'initiative') = (status is not null))
);
create index on public.council_posts (school_id, kind, created_at desc);
alter table public.council_posts enable row level security;
create policy "see council posts" on public.council_posts for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.council_posts from authenticated;

create table public.council_info (
  school_id uuid primary key references public.schools (id),
  about text not null default '' check (char_length(about) <= 1000),
  contact_email text not null default '' check (char_length(contact_email) <= 120),
  office text not null default '' check (char_length(office) <= 120),
  meeting_info text not null default '' check (char_length(meeting_info) <= 300),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.council_info enable row level security;
create policy "see council info" on public.council_info for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.council_info from authenticated;

-- Private messages from students to the council.
create table public.council_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 100),
  body text not null check (char_length(body) between 3 and 1500),
  status text not null default 'new' check (status in ('new', 'answered', 'closed')),
  reply text check (char_length(reply) <= 1500),
  replied_by uuid references public.profiles (id) on delete set null,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.council_messages (school_id, status, created_at desc);
create index on public.council_messages (sender_id, created_at desc);
alter table public.council_messages enable row level security;
create policy "see own or council messages" on public.council_messages for select to authenticated
  using (sender_id = (select auth.uid()) or (school_id = public.my_school_id() and public.can_post_council()));
revoke insert, update, delete on public.council_messages from authenticated;

create function public.post_council(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_kind text := coalesce(p ->> 'kind', '');
  v_title text := left(btrim(coalesce(p ->> 'title', '')), 100);
  v_body text := left(btrim(coalesce(p ->> 'body', '')), 2000);
  v_status text := nullif(p ->> 'status', '');
  v_pinned boolean := coalesce((p ->> 'pinned')::boolean, false);
  v_event uuid := nullif(p ->> 'event_id', '')::uuid;
  v_id uuid;
begin
  if not public.can_post_council() then
    raise exception 'Only the Student Council and admins can post here.';
  end if;
  if v_kind not in ('announcement', 'update', 'initiative', 'activity') then
    raise exception 'Choose what you are posting.';
  end if;
  if char_length(v_title) < 3 then
    raise exception 'Give it a title.';
  end if;
  if v_kind = 'initiative' then
    v_status := coalesce(v_status, 'planned');
    if v_status not in ('planned', 'in_progress', 'done') then
      raise exception 'Unknown status.';
    end if;
  else
    v_status := null;
  end if;
  if v_event is not null and not exists (select 1 from public.events where id = v_event and school_id = v_school) then
    v_event := null;
  end if;
  perform public.reject_blocked(v_school, v_title || ' ' || v_body);
  perform public.check_rate('council_post', 20, 86400);
  if p_id is null then
    insert into public.council_posts (school_id, kind, title, body, status, pinned, event_id, created_by)
    values (v_school, v_kind, v_title, v_body, v_status, v_pinned, v_event, auth.uid())
    returning id into v_id;
    if v_kind = 'announcement' then
      insert into public.notifications (school_id, recipient_id, kind, title, body, link)
      select v_school, pr.id, 'council_announcement', '🗳️ Student Council: ' || v_title, left(v_body, 140), '/council'
      from public.profiles pr
      where pr.school_id = v_school and pr.onboarded_at is not null and pr.deactivated_at is null and pr.id <> auth.uid();
    end if;
  else
    update public.council_posts set kind = v_kind, title = v_title, body = v_body, status = v_status, pinned = v_pinned,
      event_id = v_event, updated_at = now()
    where id = p_id and school_id = v_school returning id into v_id;
    if v_id is null then
      raise exception 'Post not found.';
    end if;
  end if;
  return v_id;
end;
$$;

create function public.delete_council_post(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_post_council() then
    raise exception 'Only the Student Council and admins can do that.';
  end if;
  delete from public.council_posts where id = p_id and school_id = public.my_school_id();
end;
$$;

create function public.set_council_info(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_email text := left(btrim(coalesce(p ->> 'contact_email', '')), 120);
begin
  if not public.can_post_council() then
    raise exception 'Only the Student Council and admins can change this.';
  end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email address does not look right.';
  end if;
  insert into public.council_info (school_id, about, contact_email, office, meeting_info, updated_by)
  values (v_school, left(btrim(coalesce(p ->> 'about', '')), 1000), v_email, left(btrim(coalesce(p ->> 'office', '')), 120),
          left(btrim(coalesce(p ->> 'meeting_info', '')), 300), auth.uid())
  on conflict (school_id) do update set about = excluded.about, contact_email = excluded.contact_email, office = excluded.office,
    meeting_info = excluded.meeting_info, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

create function public.contact_council(p_subject text, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_school uuid := public.my_school_id();
  v_subject text := left(btrim(coalesce(p_subject, '')), 100);
  v_body text := left(btrim(coalesce(p_body, '')), 1500);
  v_id uuid;
begin
  if not public.is_active() or not public.is_current_student(me) then
    raise exception 'Only current students can message the council.';
  end if;
  if char_length(v_subject) < 3 or char_length(v_body) < 3 then
    raise exception 'Write a subject and a message.';
  end if;
  perform public.reject_blocked(v_school, v_subject || ' ' || v_body);
  perform public.check_rate('council_contact', 3, 86400);
  insert into public.council_messages (school_id, sender_id, subject, body) values (v_school, me, v_subject, v_body)
  returning id into v_id;
  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select v_school, pr.id, 'council_message', 'A student wrote to the council', v_subject, '/council'
  from public.profiles pr
  where pr.school_id = v_school and pr.deactivated_at is null and pr.id <> me
    and (pr.role in ('admin', 'super_admin') or exists (
      select 1 from public.leadership_roles l where l.profile_id = pr.id and l.kind = 'council_member'));
  return v_id;
end;
$$;

create function public.reply_council_message(p_id uuid, p_reply text, p_close boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.council_messages;
  v_reply text := left(btrim(coalesce(p_reply, '')), 1500);
begin
  if not public.can_post_council() then
    raise exception 'Only the Student Council and admins can reply.';
  end if;
  select * into m from public.council_messages where id = p_id and school_id = public.my_school_id() for update;
  if m.id is null then
    raise exception 'Message not found.';
  end if;
  if m.sender_id = auth.uid() then
    raise exception 'You cannot answer your own message.';
  end if;
  if p_close and v_reply = '' then
    update public.council_messages set status = 'closed' where id = m.id;
    return;
  end if;
  if char_length(v_reply) < 2 then
    raise exception 'Write a reply.';
  end if;
  perform public.reject_blocked(m.school_id, v_reply);
  update public.council_messages set status = 'answered', reply = v_reply, replied_by = auth.uid(), replied_at = now() where id = m.id;
  perform public.notify(m.sender_id, 'council_reply', '🗳️ The council replied: ' || m.subject, left(v_reply, 140), '/council');
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  -- Internal helpers and triggers.
  foreach f in array array['event_chat_sync(uuid)', 'ensure_event_chat(uuid)', 'event_people_changed()',
                           'promote_waitlist(uuid)', 'event_audience(uuid)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array[
    'can_manage_event_id(uuid)', 'event_file_uploader(text)', 'create_event(jsonb)', 'review_event(uuid, boolean, text)',
    'update_event(uuid, jsonb)', 'post_event_update(uuid, text, text)', 'set_event_organizers(uuid, uuid[])',
    'add_event_attachment(uuid, text, text)', 'remove_event_attachment(uuid)', 'join_event(uuid)', 'leave_event(uuid)',
    'manage_attendee(uuid, uuid, text)', 'cancel_event(uuid, text)',
    'can_manage_opportunity(uuid)', 'can_publish_volunteering()', 'publish_opportunity(jsonb, uuid)',
    'set_opportunity_status(uuid, text)', 'apply_volunteer(uuid, text)', 'withdraw_application(uuid)',
    'review_volunteer_application(uuid, boolean, text, text)', 'set_responsibility(uuid, text)',
    'complete_volunteering(uuid, numeric)', 'volunteer_history(uuid)',
    'can_post_council()', 'post_council(uuid, jsonb)', 'delete_council_post(uuid)', 'set_council_info(jsonb)',
    'contact_council(text, text)', 'reply_council_message(uuid, text, boolean)'
  ] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
