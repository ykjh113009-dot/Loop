-- =============================================================================
-- Pbs Go: database logic (bad-word filter, triggers, and actions)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Bad-word filter
-- ---------------------------------------------------------------------------

-- Makes text easier to compare: lowercase, removes Arabic vowel marks,
-- unifies letter shapes (أ إ آ -> ا, ة -> ه, ى -> ي), turns common tricks like
-- "$" and "0" back into letters, and squashes "fuuuuck" into "fuck".
create function public.normalize_text(t text) returns text
language sql immutable set search_path = '' as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(
            lower(coalesce(t, '')),
            'أإآٱةىؤئ@$01ـًٌٍَُِّْٰ',
            'ااااهيويasoi'
          ),
          '(.)\1\1+', '\1', 'g'
        ),
        '[^a-z0-9ء-ي]+', ' ', 'g'
      ),
      ' +', ' ', 'g'
    )
  )
$$;

alter table public.blocked_words
  add column normalized text generated always as (public.normalize_text(word)) stored;

-- True if the text contains a blocked word. Short words must match a whole
-- word; words of 4+ letters also catch endings ("fucking", "شرموطه").
create function public.contains_blocked_word(p_school uuid, p_text text) returns boolean
language sql stable security definer set search_path = '' as $$
  with t as (select ' ' || public.normalize_text(p_text) || ' ' as padded)
  select exists (
    select 1 from public.blocked_words w, t
    where (w.school_id is null or w.school_id = p_school)
      and w.normalized <> ''
      and t.padded ~ (
        ' (ال|وال|و|يا)?' || w.normalized ||
        case when char_length(w.normalized) >= 4 then '' else ' ' end
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- New sign-ins: only school email addresses are allowed in.
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(new.email);
  v_school public.schools;
  v_roster public.roster;
  v_name text;
begin
  select * into v_school from public.schools
  where email_domain = split_part(v_email, '@', 2);

  if v_school.id is null then
    raise exception 'NOT_SCHOOL_EMAIL: Please sign in with your school email address.';
  end if;

  select * into v_roster from public.roster
  where school_id = v_school.id and email = v_email;

  if v_school.roster_required and v_roster.email is null then
    raise exception 'NOT_ON_ROSTER: Your school has not added this email yet. Ask your school admin.';
  end if;

  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(v_email, '@', 1)
  );

  insert into public.profiles (id, school_id, full_name, grade)
  values (new.id, v_school.id, left(v_name, 80), v_roster.grade);

  insert into public.private_profiles (id, email) values (new.id, v_email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Triggers that fill in fields and run the filter
-- ---------------------------------------------------------------------------

create function public.profiles_check_bio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.contains_blocked_word(new.school_id, new.bio) then
    raise exception 'BLOCKED_WORD: Please remove inappropriate words from your bio.';
  end if;
  return new;
end;
$$;

create trigger profiles_check_bio
  before insert or update of bio on public.profiles
  for each row execute function public.profiles_check_bio();

create function public.clubs_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Seed scripts run without a signed-in user and set these themselves.
  if auth.uid() is not null then
    new.school_id := public.my_school_id();
    new.requested_by := auth.uid();
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  if public.contains_blocked_word(new.school_id, new.name || ' ' || new.description) then
    raise exception 'BLOCKED_WORD: Please remove inappropriate words from the club name or description.';
  end if;
  return new;
end;
$$;

create trigger clubs_before_insert
  before insert on public.clubs
  for each row execute function public.clubs_before_insert();

-- Keep each club's group chat members the same as the club members.
create function public.sync_club_chat() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_conversation uuid;
begin
  if tg_op = 'INSERT' then
    select id into v_conversation from public.conversations where club_id = new.club_id;
    if v_conversation is not null then
      insert into public.conversation_members (conversation_id, profile_id)
      values (v_conversation, new.profile_id)
      on conflict do nothing;
    end if;
    return new;
  else
    delete from public.conversation_members cm
    using public.conversations c
    where c.id = cm.conversation_id and c.club_id = old.club_id and cm.profile_id = old.profile_id;
    return old;
  end if;
end;
$$;

create trigger club_members_sync_chat
  after insert or delete on public.club_members
  for each row execute function public.sync_club_chat();

create function public.posts_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select school_id into new.school_id from public.clubs where id = new.club_id;
  new.status := case
    when public.contains_blocked_word(new.school_id, new.body) then 'held'
    else 'visible'
  end;
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger posts_before_insert
  before insert on public.posts
  for each row execute function public.posts_before_insert();

create function public.posts_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'held' then
    insert into public.reports (school_id, target_type, target_id, target_author_id, reason, snapshot)
    values (new.school_id, 'post', new.id, new.author_id, 'filter', new.body);
  end if;
  return new;
end;
$$;

create trigger posts_after_insert
  after insert on public.posts
  for each row execute function public.posts_after_insert();

create function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select school_id into new.school_id from public.conversations where id = new.conversation_id;
  new.status := case
    when public.contains_blocked_word(new.school_id, new.body) then 'held'
    else 'visible'
  end;
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.messages_before_insert();

create function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kind text;
begin
  select kind into v_kind from public.conversations where id = new.conversation_id;
  if new.status = 'held' then
    insert into public.reports (
      school_id, target_type, target_id, target_author_id, reason, snapshot, admin_only
    ) values (
      new.school_id, 'message', new.id, new.sender_id, 'filter', new.body, v_kind = 'direct'
    );
  else
    update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  end if;
  -- Sending a message means you have read the chat up to now.
  update public.conversation_members set last_read_at = new.created_at
  where conversation_id = new.conversation_id and profile_id = new.sender_id;
  return new;
end;
$$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.messages_after_insert();

create function public.events_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.school_id := public.my_school_id();
    if public.is_staff() then
      new.status := 'approved';
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    else
      new.status := 'pending';
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;
  end if;
  if public.contains_blocked_word(new.school_id, new.title || ' ' || new.description || ' ' || new.location) then
    raise exception 'BLOCKED_WORD: Please remove inappropriate words from the event.';
  end if;
  return new;
end;
$$;

create trigger events_before_insert
  before insert on public.events
  for each row execute function public.events_before_insert();

-- Tells club members about a newly approved club event.
create function public.notify_club_about_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  v_club text;
begin
  select * into e from public.events where id = p_event;
  if e.club_id is null or e.status <> 'approved' then
    return;
  end if;
  select name into v_club from public.clubs where id = e.club_id;
  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select e.school_id, cm.profile_id, 'event_new', 'New event: ' || e.title,
         v_club || ' · ' || public.local_time(e.starts_at), '/events/' || e.id
  from public.club_members cm
  where cm.club_id = e.club_id and cm.profile_id is distinct from e.created_by;
end;
$$;

create function public.events_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' then
    perform public.notify_club_about_event(new.id);
  end if;
  return new;
end;
$$;

create trigger events_after_insert
  after insert on public.events
  for each row execute function public.events_after_insert();

create function public.rsvps_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select school_id into new.school_id from public.events where id = new.event_id;
  return new;
end;
$$;

create trigger rsvps_before_insert
  before insert on public.event_rsvps
  for each row execute function public.rsvps_before_insert();

create function public.announcements_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select new.school_id, p.id, 'announcement', '📢 ' || new.title, left(new.body, 140), '/home'
  from public.profiles p
  where p.school_id = new.school_id and p.onboarded_at is not null
    and p.deactivated_at is null and p.id is distinct from new.author_id;
  return new;
end;
$$;

create trigger announcements_after_insert
  after insert on public.announcements
  for each row execute function public.announcements_after_insert();

-- Fills in a user's report with a copy of the content, and checks they are
-- allowed to see what they are reporting.
create function public.reports_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid;
  v_kind text;
  v_conversation uuid;
begin
  if new.reporter_id is null then
    return new; -- created by the filter
  end if;

  if new.reason = 'filter' then
    raise exception 'Invalid reason';
  end if;

  new.school_id := public.my_school_id();
  new.status := 'open';
  new.admin_only := false;

  if new.target_type = 'post' then
    select school_id, author_id,
           body || case when image_path is not null then ' [photo attached]' else '' end
      into v_school, new.target_author_id, new.snapshot
    from public.posts where id = new.target_id;
  elsif new.target_type = 'message' then
    select m.school_id, m.sender_id, m.body, c.kind, c.id
      into v_school, new.target_author_id, new.snapshot, v_kind, v_conversation
    from public.messages m join public.conversations c on c.id = m.conversation_id
    where m.id = new.target_id;
    if not public.is_conversation_member(v_conversation) then
      raise exception 'You can only report messages in your own chats.';
    end if;
    new.admin_only := v_kind = 'direct';
  elsif new.target_type = 'profile' then
    select school_id, id, full_name || ': ' || bio
      into v_school, new.target_author_id, new.snapshot
    from public.profiles where id = new.target_id;
  elsif new.target_type = 'club' then
    select school_id, requested_by, name || ': ' || description
      into v_school, new.target_author_id, new.snapshot
    from public.clubs where id = new.target_id;
  elsif new.target_type = 'event' then
    select school_id, created_by, title || ': ' || description
      into v_school, new.target_author_id, new.snapshot
    from public.events where id = new.target_id;
  end if;

  if v_school is null or v_school <> new.school_id then
    raise exception 'Could not find what you are reporting.';
  end if;
  if new.target_author_id = auth.uid() then
    raise exception 'You cannot report yourself.';
  end if;
  return new;
end;
$$;

create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

-- Hides content after 3 different people report it, and alerts admins
-- straight away about anything that sounds like self-harm.
create function public.reports_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  if new.reporter_id is null then
    return new;
  end if;

  select count(distinct reporter_id) into v_count from public.reports
  where target_type = new.target_type and target_id = new.target_id and status = 'open';

  if v_count >= 3 then
    if new.target_type = 'post' then
      update public.posts set status = 'held' where id = new.target_id and status = 'visible';
    elsif new.target_type = 'message' then
      update public.messages set status = 'held' where id = new.target_id and status = 'visible';
    end if;
  end if;

  if new.reason = 'self_harm' then
    insert into public.notifications (school_id, recipient_id, kind, title, body, link)
    select new.school_id, p.id, 'urgent_report', '⚠️ Urgent report: a student may need help',
           'Please review this report as soon as possible.', '/moderation'
    from public.profiles p
    where p.school_id = new.school_id and p.role = 'admin' and p.deactivated_at is null;
  end if;
  return new;
end;
$$;

create trigger reports_after_insert
  after insert on public.reports
  for each row execute function public.reports_after_insert();

-- ---------------------------------------------------------------------------
-- Actions the app calls (like small API endpoints inside the database).
-- Each one checks who is calling before doing anything.
-- ---------------------------------------------------------------------------

create function public.complete_onboarding(
  p_grade int, p_avatar text, p_bio text, p_interests bigint[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  v_grades int[];
begin
  select * into me from public.profiles where id = auth.uid() and deactivated_at is null;
  if me.id is null then
    raise exception 'Not signed in';
  end if;
  select grades into v_grades from public.schools where id = me.school_id;
  -- A grade set by the admin's roster wins over the one picked here.
  if me.grade is null and not (p_grade = any (v_grades)) then
    raise exception 'Please choose your grade.';
  end if;
  if coalesce(array_length(p_interests, 1), 0) > 10 then
    raise exception 'Choose up to 10 interests.';
  end if;

  update public.profiles
  set grade = coalesce(me.grade, p_grade),
      avatar = p_avatar,
      bio = coalesce(p_bio, ''),
      onboarded_at = coalesce(onboarded_at, now())
  where id = me.id;

  delete from public.profile_interests where profile_id = me.id;
  insert into public.profile_interests (profile_id, interest_id)
  select me.id, unnest(coalesce(p_interests, '{}'));
end;
$$;

create function public.set_my_interests(p_interests bigint[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_reader() then
    raise exception 'Not allowed';
  end if;
  if coalesce(array_length(p_interests, 1), 0) > 10 then
    raise exception 'Choose up to 10 interests.';
  end if;
  delete from public.profile_interests where profile_id = auth.uid();
  insert into public.profile_interests (profile_id, interest_id)
  select auth.uid(), unnest(coalesce(p_interests, '{}'));
end;
$$;

-- Opens (or creates) a private chat with another student of the same school.
create function public.start_direct_conversation(p_other uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_conversation uuid;
begin
  if not public.is_active() then
    raise exception 'Your account cannot send messages right now.';
  end if;
  if p_other = auth.uid() then
    raise exception 'You cannot message yourself.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_other and school_id = v_school and deactivated_at is null and onboarded_at is not null
  ) then
    raise exception 'You can only message students at your school.';
  end if;
  if public.is_blocked_between(auth.uid(), p_other) then
    raise exception 'You cannot message this student.';
  end if;

  select c.id into v_conversation
  from public.conversations c
  join public.conversation_members a on a.conversation_id = c.id and a.profile_id = auth.uid()
  join public.conversation_members b on b.conversation_id = c.id and b.profile_id = p_other
  where c.kind = 'direct'
  limit 1;

  if v_conversation is null then
    insert into public.conversations (school_id, kind) values (v_school, 'direct')
    returning id into v_conversation;
    insert into public.conversation_members (conversation_id, profile_id)
    values (v_conversation, auth.uid()), (v_conversation, p_other);
  end if;
  return v_conversation;
end;
$$;

-- Counts for the little red badges in the menu.
create function public.my_badges() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'notifications', (
      select count(*) from public.notifications
      where recipient_id = auth.uid() and read_at is null
    ),
    'messages', (
      select count(*) from public.conversation_members cm
      join public.conversations c on c.id = cm.conversation_id
      where cm.profile_id = auth.uid() and c.last_message_at > cm.last_read_at
    ),
    'moderation', case when public.is_staff() then (
      (select count(*) from public.reports
        where school_id = public.my_school_id() and status = 'open'
          and (not admin_only or public.is_admin()))
      + (select count(*) from public.clubs where school_id = public.my_school_id() and status = 'pending')
      + (select count(*) from public.events where school_id = public.my_school_id() and status = 'pending')
    ) else 0 end
  )
$$;

create function public.review_club(p_club uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.clubs;
  v_conversation uuid;
begin
  if not public.is_staff() then
    raise exception 'Only moderators can review clubs.';
  end if;
  select * into c from public.clubs
  where id = p_club and school_id = public.my_school_id() and status = 'pending';
  if c.id is null then
    raise exception 'Club request not found.';
  end if;

  update public.clubs
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(btrim(p_note), '')
  where id = c.id;

  if p_approve then
    insert into public.conversations (school_id, kind, club_id)
    values (c.school_id, 'club', c.id) returning id into v_conversation;
    if c.requested_by is not null then
      insert into public.club_members (club_id, profile_id, role)
      values (c.id, c.requested_by, 'leader') on conflict do nothing;
    end if;
    perform public.notify(c.requested_by, 'club_approved', '🎉 Your club "' || c.name || '" was approved',
      'You are the club leader. Invite your friends!', '/clubs/' || c.id);
  else
    perform public.notify(c.requested_by, 'club_rejected', 'Your club "' || c.name || '" was not approved',
      coalesce(nullif(btrim(p_note), ''), 'Talk to a moderator to find out more.'), '/clubs');
  end if;
  perform public.log_action(c.school_id, case when p_approve then 'approve_club' else 'reject_club' end,
    'club', c.id, c.name || coalesce(' — ' || nullif(btrim(p_note), ''), ''));
end;
$$;

create function public.archive_club(p_club uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.clubs;
begin
  if not public.is_staff() then
    raise exception 'Only moderators can close clubs.';
  end if;
  select * into c from public.clubs
  where id = p_club and school_id = public.my_school_id() and status = 'approved';
  if c.id is null then
    raise exception 'Club not found.';
  end if;
  update public.clubs set status = 'archived' where id = c.id;
  perform public.log_action(c.school_id, 'archive_club', 'club', c.id, c.name || coalesce(' — ' || p_reason, ''));
end;
$$;

create function public.review_event(p_event uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  if not public.is_staff() then
    raise exception 'Only moderators can review events.';
  end if;
  select * into e from public.events
  where id = p_event and school_id = public.my_school_id() and status = 'pending';
  if e.id is null then
    raise exception 'Event request not found.';
  end if;

  update public.events
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = e.id;

  if p_approve then
    perform public.notify(e.created_by, 'event_approved', '✅ Your event "' || e.title || '" was approved',
      public.local_time(e.starts_at), '/events/' || e.id);
    perform public.notify_club_about_event(e.id);
  else
    perform public.notify(e.created_by, 'event_rejected', 'Your event "' || e.title || '" was not approved',
      coalesce(nullif(btrim(p_note), ''), 'Talk to a moderator to find out more.'), '/events');
  end if;
  perform public.log_action(e.school_id, case when p_approve then 'approve_event' else 'reject_event' end,
    'event', e.id, e.title || coalesce(' — ' || nullif(btrim(p_note), ''), ''));
end;
$$;

-- Moderators, the person who created the event, or the club's leaders can
-- cancel or move an event.
create function public.can_manage_event(e public.events) returns boolean
language sql stable security definer set search_path = '' as $$
  select e.school_id = public.my_school_id() and public.is_active() and (
    public.is_staff()
    or e.created_by = auth.uid()
    or (e.club_id is not null and public.is_club_leader(e.club_id))
  )
$$;

create function public.cancel_event(p_event uuid, p_reason text) returns void
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

  update public.events set status = 'cancelled', cancel_reason = nullif(btrim(p_reason), '')
  where id = e.id;

  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select e.school_id, r.profile_id, 'event_cancelled', '❌ Cancelled: ' || e.title,
         coalesce(nullif(btrim(p_reason), ''), 'This event will not happen.'), '/events/' || e.id
  from public.event_rsvps r where r.event_id = e.id and r.profile_id <> auth.uid();

  perform public.log_action(e.school_id, 'cancel_event', 'event', e.id, e.title);
end;
$$;

create function public.reschedule_event(p_event uuid, p_starts timestamptz, p_ends timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  select * into e from public.events where id = p_event;
  if e.id is null or not public.can_manage_event(e) then
    raise exception 'You cannot change this event.';
  end if;
  if e.status not in ('approved', 'pending') then
    raise exception 'This event is closed.';
  end if;
  if p_starts <= now() then
    raise exception 'The new time must be in the future.';
  end if;
  if p_ends is not null and p_ends <= p_starts then
    raise exception 'The end time must be after the start time.';
  end if;

  update public.events set starts_at = p_starts, ends_at = p_ends where id = e.id;
  update public.event_rsvps set reminded_day = false, reminded_hour = false where event_id = e.id;

  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select e.school_id, r.profile_id, 'event_rescheduled', '🕒 New time: ' || e.title,
         'Now on ' || public.local_time(p_starts) || ' (was ' || public.local_time(e.starts_at) || ')',
         '/events/' || e.id
  from public.event_rsvps r where r.event_id = e.id and r.profile_id <> auth.uid();

  perform public.log_action(e.school_id, 'reschedule_event', 'event', e.id,
    e.title || ': ' || public.local_time(e.starts_at) || ' → ' || public.local_time(p_starts));
end;
$$;

create function public.moderate_report(p_report uuid, p_action text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.reports;
  v_note text := nullif(btrim(p_note), '');
begin
  if not public.is_staff() then
    raise exception 'Only moderators can review reports.';
  end if;
  if p_action not in ('dismiss', 'remove') then
    raise exception 'Unknown action';
  end if;
  select * into r from public.reports
  where id = p_report and school_id = public.my_school_id() and status = 'open';
  if r.id is null then
    raise exception 'Report not found or already handled.';
  end if;
  if r.admin_only and not public.is_admin() then
    raise exception 'Only admins can review reports about private messages.';
  end if;

  if p_action = 'remove' then
    if r.target_type = 'post' then
      update public.posts set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'message' then
      update public.messages set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'club' then
      update public.clubs set status = 'archived' where id = r.target_id;
    elsif r.target_type = 'event' then
      update public.events set status = 'cancelled' where id = r.target_id and status in ('pending', 'approved');
    end if;
    if r.target_type in ('post', 'message', 'club', 'event') then
      perform public.notify(r.target_author_id, 'content_removed',
        'Something you shared was removed',
        'It broke the school''s community rules.' || coalesce(' Note: ' || v_note, ''), null);
    end if;
  else
    -- Nothing wrong: put back content the filter or other reports had hidden.
    if r.target_type = 'post' then
      update public.posts set status = 'visible' where id = r.target_id and status = 'held';
    elsif r.target_type = 'message' then
      update public.messages set status = 'visible' where id = r.target_id and status = 'held';
    end if;
  end if;

  -- Close every open report about the same thing.
  update public.reports
  set status = case when p_action = 'remove' then 'resolved' else 'dismissed' end,
      resolution = coalesce(v_note, case when p_action = 'remove' then 'Content removed' else 'No action needed' end),
      resolved_by = auth.uid(), resolved_at = now()
  where target_type = r.target_type and target_id = r.target_id and status = 'open';

  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select distinct r.school_id, x.reporter_id, 'report_reviewed', 'Thanks for your report',
         'A moderator reviewed it and took care of it.', null
  from public.reports x
  where x.target_type = r.target_type and x.target_id = r.target_id
    and x.reporter_id is not null and x.resolved_at = now();

  perform public.log_action(r.school_id,
    case when p_action = 'remove' then 'remove_content' else 'dismiss_report' end,
    r.target_type, r.target_id, coalesce(v_note, ''));
end;
$$;

-- Moderators can suspend students for 1, 7 or 30 days. Admins can also
-- suspend permanently (p_days = null) and suspend moderators.
create function public.suspend_user(p_user uuid, p_days int, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  if not public.is_staff() then
    raise exception 'Only moderators can suspend accounts.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  if t.id = auth.uid() then
    raise exception 'You cannot suspend yourself.';
  end if;
  if not public.is_admin() and (t.role <> 'student' or p_days is null) then
    raise exception 'Only admins can do that.';
  end if;
  if p_days is not null and p_days not in (1, 7, 30) then
    raise exception 'Choose 1, 7 or 30 days.';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Please write a reason.';
  end if;

  update public.profiles
  set suspended_until = case when p_days is null then 'infinity'::timestamptz else now() + make_interval(days => p_days) end,
      suspension_reason = btrim(p_reason)
  where id = t.id;

  perform public.notify(t.id, 'suspended', 'Your account has been suspended',
    case when p_days is null then 'Until further notice. ' else 'For ' || p_days || ' day(s). ' end
    || 'Reason: ' || btrim(p_reason), null);
  perform public.log_action(t.school_id, 'suspend', 'profile', t.id,
    t.full_name || ' · ' || coalesce(p_days || ' day(s)', 'permanent') || ' · ' || btrim(p_reason));
end;
$$;

create function public.unsuspend_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can lift suspensions.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  update public.profiles set suspended_until = null, suspension_reason = null where id = t.id;
  perform public.notify(t.id, 'unsuspended', 'Your account is active again', 'Welcome back!', '/home');
  perform public.log_action(t.school_id, 'unsuspend', 'profile', t.id, t.full_name);
end;
$$;

create function public.admin_update_member(p_user uuid, p_grade int, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
  v_grades int[];
begin
  if not public.is_admin() then
    raise exception 'Only admins can change accounts.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  select grades into v_grades from public.schools where id = t.school_id;
  if p_grade is not null and not (p_grade = any (v_grades)) then
    raise exception 'That grade does not exist at your school.';
  end if;
  if p_role not in ('student', 'moderator', 'admin') then
    raise exception 'Unknown role';
  end if;
  if t.id = auth.uid() and p_role <> t.role then
    raise exception 'You cannot change your own role.';
  end if;

  update public.profiles set grade = coalesce(p_grade, grade), role = p_role where id = t.id;

  if p_grade is distinct from t.grade and p_grade is not null then
    perform public.log_action(t.school_id, 'change_grade', 'profile', t.id,
      t.full_name || ': grade ' || coalesce(t.grade::text, '-') || ' → ' || p_grade);
  end if;
  if p_role <> t.role then
    perform public.log_action(t.school_id, 'change_role', 'profile', t.id,
      t.full_name || ': ' || t.role || ' → ' || p_role);
  end if;
end;
$$;

create function public.admin_set_deactivated(p_user uuid, p_deactivated boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove accounts.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  if t.id = auth.uid() then
    raise exception 'You cannot remove yourself.';
  end if;
  update public.profiles
  set deactivated_at = case when p_deactivated then now() else null end
  where id = t.id;
  perform public.log_action(t.school_id, case when p_deactivated then 'remove_account' else 'restore_account' end,
    'profile', t.id, t.full_name);
end;
$$;

-- Numbers for the admin dashboard. Clubs and grades are compared; individual
-- students are never ranked.
create function public.school_stats() returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_result json;
begin
  if not public.is_admin() then
    raise exception 'Only admins can see school stats.';
  end if;

  with students as (
    select p.id, p.grade,
      exists (
        select 1 from public.club_members cm join public.clubs c on c.id = cm.club_id
        where cm.profile_id = p.id and c.status = 'approved'
      ) as in_club
    from public.profiles p
    where p.school_id = v_school and p.onboarded_at is not null and p.deactivated_at is null
  )
  select json_build_object(
    'students', (select count(*) from students),
    'students_in_club', (select count(*) from students where in_club),
    'by_grade', coalesce((
      select json_agg(g order by g.grade) from (
        select grade, count(*) as total, count(*) filter (where in_club) as in_club
        from students group by grade
      ) g
    ), '[]'::json),
    'clubs_approved', (select count(*) from public.clubs where school_id = v_school and status = 'approved'),
    'clubs_pending', (select count(*) from public.clubs where school_id = v_school and status = 'pending'),
    'events_upcoming', (select count(*) from public.events
      where school_id = v_school and status = 'approved' and starts_at > now()),
    'rsvps_upcoming', (select count(*) from public.event_rsvps r join public.events e on e.id = r.event_id
      where e.school_id = v_school and e.status = 'approved' and e.starts_at > now()),
    'posts_7d', (select count(*) from public.posts
      where school_id = v_school and status = 'visible' and created_at > now() - interval '7 days'),
    'messages_7d', (select count(*) from public.messages
      where school_id = v_school and created_at > now() - interval '7 days'),
    'active_7d', (select count(distinct author) from (
        select author_id as author from public.posts where school_id = v_school and created_at > now() - interval '7 days'
        union all
        select sender_id from public.messages where school_id = v_school and created_at > now() - interval '7 days'
        union all
        select r.profile_id from public.event_rsvps r where r.school_id = v_school and r.created_at > now() - interval '7 days'
      ) a),
    'reports_open', (select count(*) from public.reports where school_id = v_school and status = 'open'),
    'reports_30d', (select count(*) from public.reports
      where school_id = v_school and reporter_id is not null and created_at > now() - interval '30 days'),
    'suspended_now', (select count(*) from public.profiles
      where school_id = v_school and suspended_until > now()),
    'top_clubs', coalesce((
      select json_agg(c) from (
        select cl.name, cl.emoji, count(cm.profile_id) as members
        from public.clubs cl left join public.club_members cm on cm.club_id = cl.id
        where cl.school_id = v_school and cl.status = 'approved'
        group by cl.id order by members desc, cl.name limit 5
      ) c
    ), '[]'::json)
  ) into v_result;
  return v_result;
end;
$$;

-- Runs every 10 minutes: reminds students a day and an hour before events
-- they said they are going to.
create function public.send_event_reminders() returns void
language plpgsql security definer set search_path = '' as $$
begin
  with due as (
    update public.event_rsvps r
    set reminded_hour = true, reminded_day = true
    from public.events e
    where e.id = r.event_id and e.status = 'approved' and not r.reminded_hour
      and e.starts_at > now() and e.starts_at <= now() + interval '1 hour'
    returning r.profile_id, e.*
  )
  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select school_id, profile_id, 'event_reminder', '⏰ Starting soon: ' || title,
         public.local_time(starts_at) || coalesce(' · ' || nullif(location, ''), ''), '/events/' || id
  from due;

  with due as (
    update public.event_rsvps r
    set reminded_day = true
    from public.events e
    where e.id = r.event_id and e.status = 'approved' and not r.reminded_day
      and e.starts_at > now() and e.starts_at <= now() + interval '24 hours'
    returning r.profile_id, e.*
  )
  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select school_id, profile_id, 'event_reminder', '📅 Coming up: ' || title,
         public.local_time(starts_at) || coalesce(' · ' || nullif(location, ''), ''), '/events/' || id
  from due;
end;
$$;

-- Used by the server to send phone notifications. Marks a batch as sent and
-- returns it, so two servers never send the same notification twice.
create function public.claim_push_batch(p_limit int default 200)
returns table (id uuid, recipient_id uuid, title text, body text, link text)
language sql security definer set search_path = '' as $$
  update public.notifications n
  set pushed_at = now()
  where n.id in (
    select x.id from public.notifications x
    where x.pushed_at is null and x.created_at > now() - interval '1 hour'
    order by x.created_at
    limit p_limit
    for update skip locked
  )
  returning n.id, n.recipient_id, n.title, n.body, n.link
$$;
