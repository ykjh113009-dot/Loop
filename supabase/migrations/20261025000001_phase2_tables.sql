-- =============================================================================
-- Pbs Go Phase 2: tables
-- Tutors & study buddies, marketplace, weekly challenges, points & badges,
-- polls, volunteering, Tawjihi corner, student council, suggestion box and
-- the private counselor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- New kinds of accounts: the school counselor (an adult staff member) and
-- alumni mentors (graduates who help with Tawjihi).
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'moderator', 'admin', 'counselor'));
alter table public.profiles
  add column alumni_year int check (alumni_year between 1990 and 2100),
  add column university text not null default '' check (char_length(university) <= 80),
  add column major text not null default '' check (char_length(major) <= 80);

-- The admin's email list can also say who is a counselor or an alumni mentor.
alter table public.roster
  add column role text not null default 'student' check (role in ('student', 'counselor')),
  add column alumni_year int check (alumni_year between 1990 and 2100);

-- Reports can now also be about listings and Tawjihi questions/answers.
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'message', 'profile', 'club', 'event', 'listing', 'question', 'answer'));

-- ---------------------------------------------------------------------------
-- Points & badges. Points are private to each student; only grades are ranked.
-- ---------------------------------------------------------------------------
create table public.points_ledger (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  points int not null check (points > 0),
  reason text not null,
  source_id uuid not null,
  created_at timestamptz not null default now(),
  -- The same action never earns points twice (e.g. leaving and re-joining a club).
  unique (profile_id, reason, source_id)
);
create index on public.points_ledger (school_id, created_at);
create index on public.points_ledger (profile_id, created_at desc);

create table public.badges (
  code text primary key,
  name text not null,
  emoji text not null,
  description text not null,
  sort int not null default 0
);

create table public.profile_badges (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge_code text not null references public.badges (code),
  school_id uuid not null references public.schools (id),
  earned_at timestamptz not null default now(),
  primary key (profile_id, badge_code)
);

-- ---------------------------------------------------------------------------
-- Weekly challenges
-- ---------------------------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  emoji text not null default '🏁' check (char_length(emoji) <= 8),
  points int not null default 20 check (points between 5 and 100),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.challenges (school_id, ends_at desc);

create table public.challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  note text not null check (char_length(note) between 1 and 1000),
  image_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (challenge_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- Polls (school-wide by moderators, or inside a club by its leaders)
-- ---------------------------------------------------------------------------
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  club_id uuid references public.clubs (id) on delete cascade,
  question text not null check (char_length(question) between 3 and 200),
  options text[] not null check (array_length(options, 1) between 2 and 6),
  closes_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.polls (school_id, closes_at desc);

-- Who voted for what is private: students only ever see totals.
create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  option_index int not null check (option_index between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (poll_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- Volunteering hours
-- ---------------------------------------------------------------------------
create table public.volunteer_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  organization text not null check (char_length(organization) between 2 and 100),
  description text not null default '' check (char_length(description) <= 500),
  activity_date date not null,
  hours numeric(4, 1) not null check (hours > 0 and hours <= 12),
  supervisor_name text not null default '' check (char_length(supervisor_name) <= 80),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.volunteer_entries (profile_id, activity_date desc);
create index on public.volunteer_entries (school_id, status);

-- ---------------------------------------------------------------------------
-- Peer tutors and study buddies
-- ---------------------------------------------------------------------------
create table public.tutor_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  subjects text[] not null check (array_length(subjects, 1) between 1 and 8),
  about text not null default '' check (char_length(about) <= 300),
  availability text not null default '' check (char_length(availability) <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tutoring_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  learner_id uuid not null references public.profiles (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (char_length(subject) between 2 and 40),
  message text not null default '' check (char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  completed_at timestamptz,
  check (learner_id <> tutor_id)
);
create index on public.tutoring_requests (tutor_id, status);
create index on public.tutoring_requests (learner_id, status);

create table public.study_buddy_posts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  author_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (char_length(subject) between 2 and 40),
  note text not null check (char_length(note) between 3 and 300),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.study_buddy_posts (school_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Buy / sell / swap. No online payments: students meet at school.
-- ---------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text not null default '' check (char_length(description) <= 800),
  category text not null check (category in ('books', 'uniform', 'electronics', 'sports', 'art', 'music', 'other')),
  kind text not null check (kind in ('sell', 'swap', 'free')),
  -- In Israeli shekels (₪), only for "sell".
  price numeric(7, 2) check (price >= 0 and price <= 5000),
  condition text not null default 'good' check (condition in ('new', 'like_new', 'good', 'used')),
  image_path text,
  status text not null default 'active' check (status in ('active', 'reserved', 'sold', 'held', 'removed')),
  created_at timestamptz not null default now()
);
create index on public.listings (school_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Tawjihi corner: questions answered by classmates and alumni mentors
-- ---------------------------------------------------------------------------
create table public.tawjihi_questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  author_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (char_length(subject) between 2 and 40),
  title text not null check (char_length(title) between 5 and 150),
  body text not null default '' check (char_length(body) <= 2000),
  status text not null default 'visible' check (status in ('visible', 'held', 'removed')),
  created_at timestamptz not null default now()
);
create index on public.tawjihi_questions (school_id, created_at desc);

create table public.tawjihi_answers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  question_id uuid not null references public.tawjihi_questions (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'visible' check (status in ('visible', 'held', 'removed')),
  created_at timestamptz not null default now()
);
create index on public.tawjihi_answers (question_id, created_at);

-- ---------------------------------------------------------------------------
-- Student council and elections
-- ---------------------------------------------------------------------------
create table public.council_members (
  school_id uuid not null references public.schools (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  position text not null check (char_length(position) between 2 and 60),
  sort int not null default 0,
  added_at timestamptz not null default now(),
  primary key (school_id, profile_id)
);

create table public.elections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  -- Null means every grade can vote.
  eligible_grades int[],
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);

create table public.election_candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  statement text not null default '' check (char_length(statement) <= 500),
  unique (election_id, profile_id)
);

-- Secret ballot: nobody (not even admins in the app) can see who voted for whom.
create table public.election_votes (
  election_id uuid not null references public.elections (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  candidate_id uuid not null references public.election_candidates (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  created_at timestamptz not null default now(),
  primary key (election_id, voter_id)
);

-- ---------------------------------------------------------------------------
-- Suggestion box (read by admins and student council members)
-- ---------------------------------------------------------------------------
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  author_id uuid not null references public.profiles (id) on delete cascade,
  category text not null default 'other' check (category in ('activities', 'facilities', 'clubs', 'events', 'app', 'other')),
  title text not null check (char_length(title) between 3 and 100),
  body text not null default '' check (char_length(body) <= 1500),
  status text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'done', 'declined')),
  response text,
  responded_by uuid references public.profiles (id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.suggestions (school_id, created_at desc);

-- ---------------------------------------------------------------------------
-- "Talk to the counselor": only the student and the school counselor(s)
-- can read these. Admins and moderators cannot.
-- ---------------------------------------------------------------------------
create table public.counselor_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  student_id uuid not null references public.profiles (id) on delete cascade,
  topic text not null default 'other' check (topic in ('stress', 'friends', 'family', 'school', 'future', 'other')),
  urgent boolean not null default false,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.counselor_requests (school_id, status, last_message_at desc);

create table public.counselor_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.counselor_requests (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.counselor_messages (request_id, created_at);
