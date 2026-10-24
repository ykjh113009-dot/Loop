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
