-- =============================================================================
-- Pbs Go: ONE-STEP DEMO SETUP
--
-- Paste this whole file into a NEW Supabase project (SQL Editor → New query →
-- paste → Run). It creates all the tables and security rules, then fills them
-- with fake demo students, clubs and events.
--
-- Only for a DEMO project. For the real school site, follow DEPLOY.md instead.
-- This file is made from supabase/migrations/*.sql + supabase/seed.sql.
-- =============================================================================


-- >>> supabase/migrations/20261024000001_core.sql
-- =============================================================================
-- Pbs Go: core schema
--
-- Every table that holds school data has a school_id column. Row Level Security
-- (RLS) makes sure a signed-in student can only ever read rows from their own
-- school, so adding a second school later is just adding a row to `schools`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Students sign in with Google; their email domain decides their school.
  email_domain text not null unique check (email_domain = lower(email_domain)),
  grades int[] not null default '{9,10,11,12}',
  -- When true, only emails the admin added to the roster can join.
  roster_required boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  full_name text not null check (char_length(full_name) between 1 and 80),
  grade int,
  avatar text not null default 'a01' check (avatar ~ '^a[0-9]{2}$'),
  bio text not null default '' check (char_length(bio) <= 200),
  role text not null default 'student' check (role in ('student', 'moderator', 'admin')),
  -- Null until the student finishes the welcome screen and agrees to the rules.
  onboarded_at timestamptz,
  suspended_until timestamptz,
  suspension_reason text,
  deactivated_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.profiles (school_id, grade);

-- Emails are kept apart from profiles so only the student and admins can see them.
create table public.private_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  email text not null
);

create table public.roster (
  school_id uuid not null references public.schools (id) on delete cascade,
  email text not null check (email = lower(email)),
  grade int,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (school_id, email)
);

-- Interest tags are shared by all schools.
create table public.interests (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  emoji text not null
);

create table public.profile_interests (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  interest_id bigint not null references public.interests (id) on delete cascade,
  primary key (profile_id, interest_id)
);
create index on public.profile_interests (interest_id);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  name text not null check (char_length(name) between 3 and 60),
  description text not null default '' check (char_length(description) <= 500),
  emoji text not null default '⭐' check (char_length(emoji) <= 8),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'archived')),
  requested_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create unique index clubs_unique_name on public.clubs (school_id, lower(name))
  where status in ('pending', 'approved');

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, profile_id)
);
create index on public.club_members (profile_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  club_id uuid not null references public.clubs (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  image_path text,
  status text not null default 'visible' check (status in ('visible', 'held', 'removed')),
  created_at timestamptz not null default now()
);
create index on public.posts (club_id, created_at desc);
create index on public.posts (school_id, created_at desc);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  author_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index on public.announcements (school_id, created_at desc);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  kind text not null check (kind in ('club', 'direct')),
  club_id uuid unique references public.clubs (id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'club') = (club_id is not null))
);

-- For club chats this mirrors club_members (kept in sync by a trigger).
create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create index on public.conversation_members (profile_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'visible' check (status in ('visible', 'held', 'removed')),
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at desc);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  club_id uuid references public.clubs (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 1500),
  location text not null default '' check (char_length(location) <= 100),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  cancel_reason text,
  created_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index on public.events (school_id, starts_at);

create table public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  reminded_day boolean not null default false,
  reminded_hour boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
create index on public.event_rsvps (profile_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (recipient_id, created_at desc);
create index on public.notifications (created_at) where pushed_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions (profile_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  -- Null when the bad-word filter created the report automatically.
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('post', 'message', 'profile', 'club', 'event')),
  target_id uuid not null,
  target_author_id uuid references public.profiles (id) on delete set null,
  reason text not null check (reason in ('bullying', 'harassment', 'inappropriate', 'spam', 'self_harm', 'other', 'filter')),
  details text not null default '' check (char_length(details) <= 1000),
  -- A copy of the reported content, so moderators can review it even if it is deleted.
  snapshot text not null default '',
  -- Reports about private messages are only shown to admins, not student moderators.
  admin_only boolean not null default false,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.reports (school_id, status, created_at desc);
create unique index reports_one_open_per_reporter on public.reports (reporter_id, target_type, target_id)
  where status = 'open' and reporter_id is not null;

create table public.blocked_words (
  id bigint generated always as identity primary key,
  -- Null means the word applies to every school.
  school_id uuid references public.schools (id) on delete cascade,
  word text not null check (char_length(word) between 2 and 60),
  created_at timestamptz not null default now(),
  unique nulls not distinct (school_id, word)
);

create table public.moderation_log (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details text not null default '',
  created_at timestamptz not null default now()
);
create index on public.moderation_log (school_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions used by the security rules.
-- "security definer" lets them look up the caller's profile without tripping
-- over the rules themselves.
-- ---------------------------------------------------------------------------

create function public.my_school_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select school_id from public.profiles
  where id = auth.uid() and deactivated_at is null
$$;

create function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles
  where id = auth.uid() and deactivated_at is null
$$;

-- Can read the app: finished the welcome screen and not removed.
create function public.is_reader() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and deactivated_at is null and onboarded_at is not null
  )
$$;

-- Can post, chat, RSVP: a reader who is not suspended.
create function public.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and deactivated_at is null and onboarded_at is not null
      and (suspended_until is null or suspended_until <= now())
  )
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active() and public.my_role() in ('moderator', 'admin')
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active() and public.my_role() = 'admin'
$$;

create function public.is_club_member(p_club uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_members where club_id = p_club and profile_id = auth.uid())
$$;

create function public.is_club_leader(p_club uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club and profile_id = auth.uid() and role = 'leader'
  )
$$;

create function public.is_conversation_member(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation and profile_id = auth.uid()
  )
$$;

-- True if either person has blocked the other.
create function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- Adds a notification. Only called from other database functions.
create function public.notify(
  p_recipient uuid, p_kind text, p_title text, p_body text, p_link text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select school_id, id, p_kind, p_title, coalesce(p_body, ''), p_link
  from public.profiles where id = p_recipient and deactivated_at is null
$$;

create function public.log_action(
  p_school uuid, p_action text, p_target_type text, p_target_id uuid, p_details text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.moderation_log (school_id, actor_id, action, target_type, target_id, details)
  values (p_school, auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, ''))
$$;

-- Formats a time the way people in Palestine read it, e.g. "Sun 2 Nov, 14:00".
create function public.local_time(t timestamptz) returns text
language sql immutable set search_path = '' as $$
  select to_char(t at time zone 'Asia/Hebron', 'Dy FMDD Mon, HH24:MI')
$$;

-- >>> supabase/migrations/20261024000002_logic.sql
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

-- >>> supabase/migrations/20261024000003_security.sql
-- =============================================================================
-- Pbs Go: security rules (Row Level Security), file storage, live updates,
-- scheduled jobs, and starter data.
-- =============================================================================

-- Nobody who is signed out can touch any table.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- These run inside the database only, never called directly by the app.
revoke execute on function public.notify(uuid, text, text, text, text) from authenticated;
revoke execute on function public.log_action(uuid, text, text, uuid, text) from authenticated;
revoke execute on function public.notify_club_about_event(uuid) from authenticated;
revoke execute on function public.send_event_reminders() from authenticated;
revoke execute on function public.claim_push_batch(int) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.roster enable row level security;
alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.posts enable row level security;
alter table public.announcements enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reports enable row level security;
alter table public.blocked_words enable row level security;
alter table public.moderation_log enable row level security;

-- schools ---------------------------------------------------------------
create policy "see own school" on public.schools for select to authenticated
  using (id = public.my_school_id());
create policy "admins edit school" on public.schools for update to authenticated
  using (id = public.my_school_id() and public.is_admin())
  with check (id = public.my_school_id());
revoke update on public.schools from authenticated;
grant update (name, grades, roster_required) on public.schools to authenticated;

-- profiles --------------------------------------------------------------
create policy "see classmates" on public.profiles for select to authenticated
  using (id = auth.uid() or (school_id = public.my_school_id() and public.is_reader()));
-- Students may only change their own avatar and bio. Grade, role and
-- suspension are changed through the admin actions.
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_reader()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from authenticated;
grant update (avatar, bio) on public.profiles to authenticated;

create policy "own email or admin" on public.private_profiles for select to authenticated
  using (
    id = auth.uid()
    or (public.is_admin() and exists (
      select 1 from public.profiles p where p.id = private_profiles.id and p.school_id = public.my_school_id()
    ))
  );
revoke insert, update, delete on public.private_profiles from authenticated;

create policy "admins manage roster" on public.roster for all to authenticated
  using (school_id = public.my_school_id() and public.is_admin())
  with check (school_id = public.my_school_id() and public.is_admin());

-- interests -------------------------------------------------------------
create policy "anyone signed in sees interests" on public.interests for select to authenticated
  using (true);
revoke insert, update, delete on public.interests from authenticated;

create policy "see interests of classmates" on public.profile_interests for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = profile_interests.profile_id and p.school_id = public.my_school_id()
  ));
revoke insert, update, delete on public.profile_interests from authenticated;

-- clubs -----------------------------------------------------------------
create policy "see clubs" on public.clubs for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (status = 'approved' or requested_by = auth.uid() or public.is_staff())
  );
create policy "request a club" on public.clubs for insert to authenticated
  with check (
    public.is_active() and school_id = public.my_school_id()
    and requested_by = auth.uid() and status = 'pending'
  );
revoke update, delete on public.clubs from authenticated;

create policy "see club members" on public.club_members for select to authenticated
  using (exists (
    select 1 from public.clubs c where c.id = club_members.club_id and c.school_id = public.my_school_id()
  ) and public.is_reader());
create policy "join a club" on public.club_members for insert to authenticated
  with check (
    profile_id = auth.uid() and role = 'member' and public.is_active()
    and exists (
      select 1 from public.clubs c
      where c.id = club_members.club_id and c.school_id = public.my_school_id() and c.status = 'approved'
    )
  );
create policy "leave a club" on public.club_members for delete to authenticated
  using (profile_id = auth.uid());
revoke update on public.club_members from authenticated;

-- posts -----------------------------------------------------------------
create policy "see posts" on public.posts for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (status = 'visible' or author_id = auth.uid())
    and exists (select 1 from public.clubs c where c.id = posts.club_id and c.status = 'approved')
  );
create policy "club members post" on public.posts for insert to authenticated
  with check (
    author_id = auth.uid() and public.is_active() and school_id = public.my_school_id()
    and public.is_club_member(club_id)
    and (image_path is null or image_path like public.my_school_id()::text || '/' || auth.uid()::text || '/%')
  );
create policy "delete own posts" on public.posts for delete to authenticated
  using (author_id = auth.uid());
revoke update on public.posts from authenticated;

-- announcements ---------------------------------------------------------
create policy "see announcements" on public.announcements for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "admins post announcements" on public.announcements for insert to authenticated
  with check (school_id = public.my_school_id() and public.is_admin() and author_id = auth.uid());
create policy "admins delete announcements" on public.announcements for delete to authenticated
  using (school_id = public.my_school_id() and public.is_admin());
revoke update on public.announcements from authenticated;

-- chats -----------------------------------------------------------------
create policy "see own chats" on public.conversations for select to authenticated
  using (public.is_conversation_member(id) and public.is_reader());
revoke insert, update, delete on public.conversations from authenticated;

create policy "see chat members" on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy "mark chat as read" on public.conversation_members for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
revoke insert, update, delete on public.conversation_members from authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

-- Moderators never read private chats directly. They only see the copy of a
-- message that someone reported (and only admins see reported private messages).
create policy "see messages in own chats" on public.messages for select to authenticated
  using (
    public.is_conversation_member(conversation_id) and public.is_reader()
    and (status = 'visible' or sender_id = auth.uid())
  );
create policy "send messages" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid() and public.is_active() and school_id = public.my_school_id()
    and public.is_conversation_member(conversation_id)
    -- In a private chat, nobody can message someone who blocked them.
    and not exists (
      select 1 from public.conversation_members other
      join public.conversations c on c.id = other.conversation_id
      where other.conversation_id = messages.conversation_id and c.kind = 'direct'
        and other.profile_id <> auth.uid()
        and public.is_blocked_between(auth.uid(), other.profile_id)
    )
  );
revoke update, delete on public.messages from authenticated;

create policy "own blocks" on public.blocks for select to authenticated
  using (blocker_id = auth.uid());
create policy "block someone" on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid() and exists (
    select 1 from public.profiles p where p.id = blocks.blocked_id and p.school_id = public.my_school_id()
  ));
create policy "unblock someone" on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- events ----------------------------------------------------------------
create policy "see events" on public.events for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (status in ('approved', 'cancelled') or created_by = auth.uid() or public.is_staff()
         or (club_id is not null and public.is_club_leader(club_id)))
  );
-- Club leaders suggest events for their club (a moderator approves them).
-- Moderators and admins can also add school-wide events.
create policy "create events" on public.events for insert to authenticated
  with check (
    public.is_active() and school_id = public.my_school_id() and created_by = auth.uid()
    and ((club_id is null and public.is_staff()) or (club_id is not null and public.is_club_leader(club_id)))
  );
revoke update, delete on public.events from authenticated;

create policy "see who is going" on public.event_rsvps for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "rsvp" on public.event_rsvps for insert to authenticated
  with check (
    profile_id = auth.uid() and public.is_active()
    and exists (
      select 1 from public.events e
      where e.id = event_rsvps.event_id and e.school_id = public.my_school_id()
        and e.status = 'approved' and e.starts_at > now()
    )
  );
create policy "cancel rsvp" on public.event_rsvps for delete to authenticated
  using (profile_id = auth.uid());
revoke update on public.event_rsvps from authenticated;

-- notifications ---------------------------------------------------------
create policy "own notifications" on public.notifications for select to authenticated
  using (recipient_id = auth.uid());
create policy "mark notifications read" on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "delete own notifications" on public.notifications for delete to authenticated
  using (recipient_id = auth.uid());
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- reports ---------------------------------------------------------------
create policy "send reports" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_reader());
create policy "see reports" on public.reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or (school_id = public.my_school_id() and public.is_staff() and (not admin_only or public.is_admin()))
  );
revoke update, delete on public.reports from authenticated;

-- blocked words ---------------------------------------------------------
create policy "staff see word list" on public.blocked_words for select to authenticated
  using (public.is_staff() and (school_id is null or school_id = public.my_school_id()));
create policy "admins add words" on public.blocked_words for insert to authenticated
  with check (public.is_admin() and school_id = public.my_school_id());
create policy "admins remove words" on public.blocked_words for delete to authenticated
  using (public.is_admin() and school_id = public.my_school_id());
revoke update on public.blocked_words from authenticated;

create policy "staff see moderation log" on public.moderation_log for select to authenticated
  using (school_id = public.my_school_id() and public.is_staff());
revoke insert, update, delete on public.moderation_log from authenticated;

-- ---------------------------------------------------------------------------
-- File storage for post photos. Files live in "<school id>/<user id>/..."
-- and only students of the same school can open them.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "upload own post photos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-images' and public.is_active()
    and (storage.foldername(name))[1] = public.my_school_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy "see school post photos" on storage.objects for select to authenticated
  using (
    bucket_id = 'post-images' and public.is_reader()
    and (storage.foldername(name))[1] = public.my_school_id()::text
  );
create policy "delete own post photos" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[2] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Live updates (chat messages, RSVP counts, notification badge)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.event_rsvps, public.notifications;

-- ---------------------------------------------------------------------------
-- Scheduled job: event reminders every 10 minutes
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
select cron.schedule('event-reminders', '*/10 * * * *', 'select public.send_event_reminders()');

-- ---------------------------------------------------------------------------
-- Starter data shared by every school
-- ---------------------------------------------------------------------------
insert into public.interests (slug, name, emoji) values
  ('football', 'Football', '⚽'),
  ('basketball', 'Basketball', '🏀'),
  ('volleyball', 'Volleyball', '🏐'),
  ('running', 'Running', '🏃'),
  ('chess', 'Chess', '♟️'),
  ('coding', 'Coding', '💻'),
  ('robotics', 'Robotics', '🤖'),
  ('science', 'Science', '🔬'),
  ('math', 'Math puzzles', '🧮'),
  ('reading', 'Reading', '📚'),
  ('writing', 'Writing & poetry', '✍️'),
  ('debate', 'Debate', '🎤'),
  ('languages', 'Languages', '🗣️'),
  ('drawing', 'Drawing', '🎨'),
  ('photography', 'Photography', '📷'),
  ('film', 'Film & video', '🎬'),
  ('music', 'Music', '🎵'),
  ('singing', 'Singing', '🎙️'),
  ('dabke', 'Dabke & dance', '💃'),
  ('theatre', 'Theatre', '🎭'),
  ('cooking', 'Cooking', '🍳'),
  ('gaming', 'Gaming', '🎮'),
  ('volunteering', 'Volunteering', '🤝'),
  ('environment', 'Environment', '🌱'),
  ('entrepreneurship', 'Business ideas', '💡'),
  ('history', 'History & heritage', '🏛️'),
  ('embroidery', 'Tatreez & crafts', '🧵'),
  ('fitness', 'Fitness', '💪');

-- A starter list of blocked words in English, Arabic and Arabizi (Arabic typed
-- in English letters). Admins can add more from the dashboard.
insert into public.blocked_words (school_id, word) values
  (null, 'fuck'), (null, 'fck'), (null, 'fuk'), (null, 'shit'), (null, 'bitch'),
  (null, 'bastard'), (null, 'asshole'), (null, 'ass'), (null, 'dick'), (null, 'pussy'),
  (null, 'cunt'), (null, 'slut'), (null, 'whore'), (null, 'porn'), (null, 'nude'),
  (null, 'nudes'), (null, 'retard'), (null, 'faggot'), (null, 'nigger'), (null, 'nigga'),
  (null, 'kill yourself'), (null, 'kys'),
  (null, 'شرموط'), (null, 'شرموطة'), (null, 'شرموطه'), (null, 'عرص'), (null, 'منيك'),
  (null, 'منيوك'), (null, 'نيك'), (null, 'كس'), (null, 'كسمك'), (null, 'كس امك'),
  (null, 'زب'), (null, 'قحبة'), (null, 'قحبه'), (null, 'خول'), (null, 'طيز'),
  (null, 'ابن الكلب'), (null, 'يلعن ابوك'), (null, 'متناك'), (null, 'لوطي'),
  (null, 'sharmoot'), (null, 'sharmota'), (null, 'sharmouta'), (null, 'sharmuta'),
  (null, '3ars'), (null, 'manyak'), (null, 'manyok'), (null, 'kos omak'), (null, 'kosomak'),
  (null, 'kusomak'), (null, 'ksomak'), (null, 'zeb'), (null, 'zib'), (null, 'ka7ba'),
  (null, 'a7a'), (null, 'teez'), (null, 'khawal'), (null, 'ibn el kalb'), (null, 'yel3an');

-- >>> supabase/seed.sql
-- =============================================================================
-- Pbs Go: DEMO data (fake students, clubs, events and chats)
--
-- Only use this on a local or demo database, never on the real school one.
-- Every demo account can sign in with the password: pbsgo-demo
-- =============================================================================

insert into public.schools (id, name, email_domain, grades)
values ('00000000-0000-0000-0000-00000000a001', 'Pioneers School', 'pioneers.edu.ps', '{9,10,11,12}');

-- Creates a demo login (email + password). Real students use Google instead.
create function pg_temp.demo_user(p_id uuid, p_email text, p_name text) returns void
language sql as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('pbsgo-demo', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', json_build_object('full_name', p_name)::jsonb,
    now() - interval '30 days', now(), '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_id::text, p_id, json_build_object('sub', p_id::text, 'email', p_email)::jsonb, 'email', now(), now(), now());
$$;

-- The accounts shown on the demo sign-in screen (see lib/demo.ts).
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000a1', 'demo.rania@pioneers.edu.ps', 'Rania Haddad');
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000a2', 'demo.omar@pioneers.edu.ps', 'Omar Khalil');
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000a3', 'demo.layla@pioneers.edu.ps', 'Layla Nasser');
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000a4', 'demo.yousef@pioneers.edu.ps', 'Yousef Saleh');
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000a5', 'demo.maya@pioneers.edu.ps', 'Maya Odeh');

update public.profiles set role = 'admin', grade = 12, avatar = 'a07',
  bio = 'Student council president. Ask me anything about school activities!'
  where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'moderator', grade = 11, avatar = 'a03',
  bio = 'Football, coding, and keeping Pbs Go friendly.'
  where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set grade = 10, avatar = 'a05', bio = 'I love robots and drawing. Building a line-following car this term.'
  where id = '00000000-0000-0000-0000-0000000000a3';
update public.profiles set grade = 11, avatar = 'a02', bio = 'Striker 🔥 Also into chess.'
  where id = '00000000-0000-0000-0000-0000000000a4';
update public.profiles set grade = 9, avatar = 'a09', bio = 'New here! Looking for people who like books and music.'
  where id = '00000000-0000-0000-0000-0000000000a5';

-- 40 more fake students with random grades and avatars.
do $$
declare
  first_names text[] := array['Ahmad','Sara','Mohammad','Lina','Khaled','Noor','Adam','Jana','Hamza','Dana',
    'Tariq','Hala','Sami','Rama','Ibrahim','Aya','Karim','Salma','Zaid','Tala',
    'Majd','Leen','Fadi','Yara','Amir','Mira','Bilal','Reem','Nadim','Lama',
    'Hadi','Joud','Rami','Farah','Issa','Ruba','Wael','Haneen','Jad','Malak'];
  last_names text[] := array['Barghouti','Shaheen','Awad','Hamdan','Mansour','Qasem','Darwish','Zayed','Khoury','Hijazi',
    'Abu Ali','Sabbah','Taha','Jaber','Masri','Nabulsi','Yassin','Rantisi','Kanaan','Halabi'];
  bios text[] := array['', 'Football every break ⚽', 'Coffee, books, repeat.', 'Future engineer.',
    'I draw a lot.', 'Ask me about chess openings.', 'Love dabke and music.', 'Science nerd 🔬', '', 'Photography and long walks.'];
  i int;
  v_id uuid;
begin
  perform setseed(0.42);
  for i in 1..40 loop
    v_id := ('00000000-0000-0000-0000-' || lpad(to_hex(4096 + i), 12, '0'))::uuid;
    perform pg_temp.demo_user(v_id, 'demo.student' || i || '@pioneers.edu.ps',
      first_names[i] || ' ' || last_names[1 + (i * 7) % 20]);
    update public.profiles
    set grade = (array[9,10,11,12])[1 + (i % 4)],
        avatar = 'a' || lpad((1 + (i * 5) % 12)::text, 2, '0'),
        bio = bios[1 + (i % 10)]
    where id = v_id;
  end loop;
end $$;

update public.profiles set onboarded_at = now() - interval '25 days';

-- Everyone picks 2–5 interests.
insert into public.profile_interests (profile_id, interest_id)
select p.id, i.id
from public.profiles p
cross join lateral (
  select id from public.interests order by md5(p.id::text || id::text) limit 2 + (abs(hashtext(p.id::text)) % 4)
) i;

-- ---------------------------------------------------------------------------
-- Clubs
-- ---------------------------------------------------------------------------
insert into public.clubs (id, school_id, name, description, emoji, status, requested_by, reviewed_by, reviewed_at, created_at) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a001', 'Robotics Club',
   'We build robots from Arduino kits and recycled parts. Beginners welcome — no experience needed!', '🤖', 'approved',
   '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a2', now() - interval '20 days', now() - interval '21 days'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000a001', 'Football Team',
   'Training on Tuesdays and Thursdays after school. Friendly matches against other schools.', '⚽', 'approved',
   '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a1', now() - interval '20 days', now() - interval '21 days'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000a001', 'Debate Society',
   'Practice public speaking in English and Arabic. We prepare for the national debate competition.', '🎤', 'approved',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', now() - interval '19 days', now() - interval '20 days'),
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-00000000a001', 'Art & Tatreez',
   'Drawing, painting and traditional Palestinian embroidery. Materials provided.', '🎨', 'approved',
   '00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-0000000000a1', now() - interval '18 days', now() - interval '19 days'),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-00000000a001', 'Coding Club',
   'Learn Python and make websites and games together. Weekly mini-challenges.', '💻', 'approved',
   '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', now() - interval '17 days', now() - interval '18 days'),
  ('00000000-0000-0000-0000-00000000c006', '00000000-0000-0000-0000-00000000a001', 'Dabke Troupe',
   'Rehearsals for the heritage day show. Come dance with us!', '💃', 'approved',
   '00000000-0000-0000-0000-000000001006', '00000000-0000-0000-0000-0000000000a2', now() - interval '15 days', now() - interval '16 days'),
  ('00000000-0000-0000-0000-00000000c007', '00000000-0000-0000-0000-00000000a001', 'Book Club',
   'One book a month, one cozy discussion. This month: "Men in the Sun" by Ghassan Kanafani.', '📚', 'approved',
   '00000000-0000-0000-0000-000000001010', '00000000-0000-0000-0000-0000000000a1', now() - interval '12 days', now() - interval '13 days'),
  ('00000000-0000-0000-0000-00000000c008', '00000000-0000-0000-0000-00000000a001', 'Green School',
   'Recycling, planting trees and keeping our school clean.', '🌱', 'approved',
   '00000000-0000-0000-0000-000000001014', '00000000-0000-0000-0000-0000000000a2', now() - interval '10 days', now() - interval '11 days'),
  ('00000000-0000-0000-0000-00000000c009', '00000000-0000-0000-0000-00000000a001', 'Photography Club',
   'Learning to take great photos with just our phones.', '📷', 'pending',
   '00000000-0000-0000-0000-0000000000a5', null, null, now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000c010', '00000000-0000-0000-0000-00000000a001', 'Chess Club',
   'Weekly games and a school tournament at the end of term.', '♟️', 'pending',
   '00000000-0000-0000-0000-0000000000a4', null, null, now() - interval '3 hours');

insert into public.conversations (school_id, kind, club_id)
select school_id, 'club', id from public.clubs where status = 'approved';

-- Club leaders
insert into public.club_members (club_id, profile_id, role, joined_at)
select id, requested_by, 'leader', reviewed_at from public.clubs where status = 'approved';

-- About 70% of students join 1–3 clubs (so the dashboard has a nice number).
insert into public.club_members (club_id, profile_id, role, joined_at)
select c.id, p.id, 'member', now() - interval '9 days'
from public.profiles p
cross join lateral (
  select id from public.clubs
  where status = 'approved'
  order by md5(p.id::text || id::text)
  limit case when abs(hashtext(p.id::text)) % 10 < 3 then 0 else 1 + abs(hashtext(p.id::text)) % 3 end
) c
on conflict do nothing;

-- Make sure the demo accounts are in the clubs the walkthrough uses.
insert into public.club_members (club_id, profile_id, joined_at) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a5', now() - interval '8 days'),
  ('00000000-0000-0000-0000-00000000c007', '00000000-0000-0000-0000-0000000000a5', now() - interval '8 days'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a3', now() - interval '8 days'),
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-0000000000a3', now() - interval '8 days'),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-0000000000a4', now() - interval '8 days'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a2', now() - interval '8 days')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Club posts
-- ---------------------------------------------------------------------------
insert into public.posts (club_id, author_id, body, created_at) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a3',
   'Our line-following robot finally works! 🎉 Thanks everyone who stayed after school on Monday. Next goal: obstacle avoidance.', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a2',
   'Reminder: bring your old phone chargers and toy motors on Thursday, we can reuse the parts.', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a5',
   'Hi, I''m new to the club. Is it OK if I have never coded before?', now() - interval '5 hours'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a4',
   'Great win today 3–1! Training moves to Wednesday this week because of exams.', now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000001005',
   'Who has an extra pair of shin guards? Mine broke 😅', now() - interval '20 hours'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-0000000000a1',
   'This week''s motion: "This house believes social media does more good than harm for teenagers." Pick your side!', now() - interval '4 days'),
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-000000001003',
   'We finished the first tatreez pattern — the cypress tree. Photos at the next meeting!', now() - interval '6 days'),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-0000000000a2',
   'Mini-challenge: write a program that prints the multiplication table of any number. Share your code in the chat 💻', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000c006', '00000000-0000-0000-0000-000000001006',
   'Rehearsal is in the sports hall today at 2 PM. Wear comfortable shoes!', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000c007', '00000000-0000-0000-0000-000000001010',
   'Next month we are reading "Mornings in Jenin". Who wants to lead the discussion?', now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000000c008', '00000000-0000-0000-0000-000000001014',
   'We collected 120 plastic bottles this week ♻️ Let''s reach 200 by the end of the month!', now() - interval '2 days');

-- This post contains a blocked word, so the filter hides it and sends it to
-- the moderator queue automatically.
insert into public.posts (club_id, author_id, body, created_at) values
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000001009',
   'The referee was a total bitch today, we got robbed', now() - interval '6 hours');

-- ---------------------------------------------------------------------------
-- Chats
-- ---------------------------------------------------------------------------
insert into public.messages (conversation_id, sender_id, body, created_at)
select c.id, m.sender::uuid, m.body, now() - m.ago::interval
from public.conversations c
join (values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a3', 'Who is coming on Thursday?', '26 hours'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a2', 'Me! I''ll bring the soldering kit.', '25 hours'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a5', 'Can I come just to watch the first time?', '5 hours'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a3', 'Of course Maya, everyone starts somewhere 😊', '4 hours'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a4', 'Wednesday training at 2:30, don''t be late!', '10 hours'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000001005', '👍', '9 hours'),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-0000000000a2', 'for i in range(1, 11): print(i * 7)', '30 hours'),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-0000000000a4', 'Nice, mine also asks the user for the number', '29 hours')
) as m(club, sender, body, ago) on c.club_id = m.club::uuid;

-- Private chats between demo students
insert into public.conversations (id, school_id, kind) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000a001', 'direct'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000a001', 'direct');
insert into public.conversation_members (conversation_id, profile_id, last_read_at) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a3', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a5', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000000a5', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-000000001021', now() - interval '1 day');
insert into public.messages (conversation_id, sender_id, body, created_at) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a5', 'Hi Layla! Thanks for welcoming me in the robotics chat 🙏', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a3', 'Anytime! Want to sit together at the workshop?', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a5', 'Yes please! See you there', now() - interval '90 minutes'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-000000001021', 'hey new girl, nobody wants you in book club lol', now() - interval '20 hours'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-000000001021', 'just stay away', now() - interval '19 hours');

-- ---------------------------------------------------------------------------
-- Events (times are relative to today, so the demo always looks fresh)
-- ---------------------------------------------------------------------------
create function pg_temp.at_local(days int, hhmm text) returns timestamptz
language sql as $$
  select ((date_trunc('day', now() at time zone 'Asia/Hebron') + make_interval(days => days)) + hhmm::time)
         at time zone 'Asia/Hebron'
$$;

insert into public.events (id, school_id, club_id, title, description, location, starts_at, ends_at, status, created_by, reviewed_by, reviewed_at, cancel_reason) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000a001', null,
   'Clubs Fair', 'Visit every club''s table, try activities and sign up. Free knafeh for the first 100 students!',
   'Main courtyard', pg_temp.at_local(3, '10:00'), pg_temp.at_local(3, '13:00'), 'approved',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', now() - interval '5 days', null),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001',
   'Arduino Workshop for Beginners', 'Learn to make an LED blink and read a sensor. Laptops provided.',
   'Computer lab 2', pg_temp.at_local(2, '14:00'), pg_temp.at_local(2, '15:30'), 'approved',
   '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a2', now() - interval '4 days', null),
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c002',
   'Friendly Match vs Al-Nahda School', 'Come cheer for our team! Wear the school colours.',
   'School football field', pg_temp.at_local(1, '15:00'), pg_temp.at_local(1, '16:30'), 'approved',
   '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a1', now() - interval '6 days', null),
  ('00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c003',
   'Debate Practice: Social Media', 'Two teams, one motion. Spectators welcome.',
   'Library', pg_temp.at_local(5, '13:30'), pg_temp.at_local(5, '14:30'), 'approved',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', now() - interval '2 days', null),
  ('00000000-0000-0000-0000-00000000e005', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c006',
   'Heritage Day Dabke Show', 'Our troupe performs for the whole school and parents.',
   'Sports hall', pg_temp.at_local(12, '11:00'), pg_temp.at_local(12, '12:00'), 'approved',
   '00000000-0000-0000-0000-000000001006', '00000000-0000-0000-0000-0000000000a1', now() - interval '3 days', null),
  ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000a001', null,
   'Science Fair', 'Show your experiments and projects. Prizes for the best class project.',
   'Main hall', pg_temp.at_local(18, '09:00'), pg_temp.at_local(18, '13:00'), 'approved',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', now() - interval '7 days', null),
  ('00000000-0000-0000-0000-00000000e007', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c008',
   'Tree Planting Morning', 'We plant 30 olive trees around the school.',
   'Back garden', pg_temp.at_local(-4, '08:30'), pg_temp.at_local(-4, '10:00'), 'approved',
   '00000000-0000-0000-0000-000000001014', '00000000-0000-0000-0000-0000000000a2', now() - interval '12 days', null),
  ('00000000-0000-0000-0000-00000000e008', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c007',
   'Book Club Movie Night', 'Watching the film version of this month''s book.',
   'Room 14', pg_temp.at_local(4, '16:00'), null, 'cancelled',
   '00000000-0000-0000-0000-000000001010', '00000000-0000-0000-0000-0000000000a1', now() - interval '6 days', 'The projector is being repaired. We will choose a new date soon.'),
  ('00000000-0000-0000-0000-00000000e009', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c005',
   'After-school Hackathon', 'Build a small app in teams of three in 6 hours. Snacks included.',
   'Computer lab 1', pg_temp.at_local(9, '09:00'), pg_temp.at_local(9, '15:00'), 'pending',
   '00000000-0000-0000-0000-0000000000a2', null, null, null);

-- RSVPs: club members go to their club's events, plus random students for school events.
insert into public.event_rsvps (event_id, profile_id, reminded_day, reminded_hour, created_at)
select e.id, cm.profile_id, false, false, now() - interval '2 days'
from public.events e
join public.club_members cm on cm.club_id = e.club_id
where e.status in ('approved', 'cancelled') and abs(hashtext(cm.profile_id::text || e.id::text)) % 10 < 7;

insert into public.event_rsvps (event_id, profile_id, created_at)
select e.id, p.id, now() - interval '1 day'
from public.events e cross join public.profiles p
where e.club_id is null and e.status = 'approved' and abs(hashtext(p.id::text || e.id::text)) % 10 < 5
on conflict do nothing;

-- Past events should not send reminders.
update public.event_rsvps r set reminded_day = true, reminded_hour = true
from public.events e where e.id = r.event_id and e.starts_at < now();

-- ---------------------------------------------------------------------------
-- Announcements (each one also creates a notification for every student)
-- ---------------------------------------------------------------------------
insert into public.announcements (school_id, author_id, title, body, created_at) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1',
   'Welcome to Pbs Go! 👋',
   'This is our school''s own space to find clubs, events and friends who like the same things as you. Be kind, use your real name, and report anything that makes you uncomfortable.',
   now() - interval '20 days'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1',
   'Clubs Fair this week',
   'Every club will have a table in the courtyard. Come and discover something new. Want to start your own club? Tap "Request a club" on the Clubs page.',
   now() - interval '1 day');

-- ---------------------------------------------------------------------------
-- Reports sent by students (we pretend to be each reporter while inserting)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', false);
insert into public.reports (reporter_id, target_type, target_id, reason, details)
select '00000000-0000-0000-0000-0000000000a5', 'message', id, 'bullying', 'This person keeps sending me mean messages.'
from public.messages where body = 'hey new girl, nobody wants you in book club lol';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001002","role":"authenticated"}', false);
insert into public.reports (reporter_id, target_type, target_id, reason, details)
select '00000000-0000-0000-0000-000000001002', 'post', id, 'spam', 'Off-topic'
from public.posts where body like 'Who has an extra pair%';

select set_config('request.jwt.claims', '', false);

-- A few moderation history entries for the log page.
insert into public.moderation_log (school_id, actor_id, action, target_type, target_id, details, created_at)
select school_id, reviewed_by, 'approve_club', 'club', id, name, reviewed_at
from public.clubs where status = 'approved';

-- Mark older notifications as read so the demo shows a realistic mix.
update public.notifications set read_at = now() where created_at < now() - interval '2 days';
update public.notifications set pushed_at = now();
