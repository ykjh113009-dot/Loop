-- Loop Challenges: anyone can propose a challenge, the Student Council or an admin approves it,
-- students join and send proof, reviewers check it, points go to the central points ledger.
-- Everything sensitive is a function; the tables cannot be written to directly.

-- ---------------------------------------------------------------------------
-- Who may do what
-- ---------------------------------------------------------------------------
-- Student Council members and admins approve ideas, rank winners and can change a decision.
create function public.can_govern_challenges() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_leadership('council_member')
$$;

-- Can this person check proof for this challenge? Its creator, moderators, admins and the Council.
create function public.can_review_challenge(p_challenge uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active() and exists (
    select 1 from public.challenges c
    where c.id = p_challenge and c.school_id = public.my_school_id()
      and (c.created_by = (select auth.uid()) or public.is_staff() or public.has_leadership('council_member'))
  )
$$;

create function public.challenge_in_audience(p_audience text, p_grade int, p_section text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_audience = 'school' or exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and grade = p_grade and (p_audience = 'grade' or section = p_section)
  )
$$;

-- ---------------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------------
alter table public.challenges
  add column status text not null default 'approved'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  add column category text not null default 'other'
    check (category in ('academic', 'creative', 'sports', 'community', 'wellbeing', 'fun', 'other')),
  add column kind text not null default 'digital' check (kind in ('digital', 'real_life', 'hybrid')),
  add column instructions text not null default '' check (char_length(instructions) <= 2000),
  add column rules text not null default '' check (char_length(rules) <= 1000),
  add column cover_path text,
  add column audience text not null default 'school' check (audience in ('school', 'grade', 'class')),
  add column audience_grade int check (audience_grade between 1 and 12),
  add column audience_section text check (char_length(audience_section) <= 2),
  add column proof_kinds text[] not null default array['text']
    check (cardinality(proof_kinds) >= 1 and proof_kinds <@ array['photo', 'video', 'text', 'answers']),
  add column questions text[] not null default '{}' check (cardinality(questions) <= 10),
  add column max_participants int check (max_participants between 1 and 5000),
  add column attempts_per_student int not null default 1 check (attempts_per_student between 1 and 20),
  add column rewards_per_student int not null default 1 check (rewards_per_student between 1 and 20),
  add column reward_mode text not null default 'fixed' check (reward_mode in ('fixed', 'ranked')),
  add column safety_confirmed boolean not null default true,
  add column review_note text,
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz,
  add column submitted_at timestamptz,
  add column ranked_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint challenges_audience_shape check (
    (audience = 'school' and audience_grade is null and audience_section is null)
    or (audience = 'grade' and audience_grade is not null and audience_section is null)
    or (audience = 'class' and audience_grade is not null and audience_section is not null)),
  add constraint challenges_rewards_limit check (rewards_per_student <= attempts_per_student);

alter table public.challenges alter column status set default 'draft';
alter table public.challenges alter column safety_confirmed set default false;
alter table public.challenges drop constraint challenges_points_check;
alter table public.challenges
  add constraint challenges_points_check check (points between 0 and 100),
  add constraint challenges_fixed_points_check check (reward_mode = 'ranked' or points >= 5);
create index on public.challenges (school_id, status, ends_at desc);
create index on public.challenges (created_by, created_at desc);

create table public.challenge_prizes (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  place int not null check (place between 1 and 10),
  points int not null check (points between 1 and 300),
  primary key (challenge_id, place)
);
alter table public.challenge_prizes enable row level security;
create policy "see prizes of visible challenges" on public.challenge_prizes for select to authenticated
  using (exists (select 1 from public.challenges c where c.id = challenge_prizes.challenge_id));
revoke insert, update, delete on public.challenge_prizes from authenticated;

drop policy "see challenges" on public.challenges;
drop policy "moderators create challenges" on public.challenges;
drop policy "moderators delete challenges" on public.challenges;
create policy "see challenges" on public.challenges for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader() and (
      created_by = (select auth.uid())
      or (status <> 'draft' and (public.is_staff() or public.has_leadership('council_member')))
      or (status = 'approved' and public.challenge_in_audience(audience, audience_grade, audience_section))
    )
  );
revoke insert, update, delete on public.challenges from authenticated;

-- ---------------------------------------------------------------------------
-- Participants
-- ---------------------------------------------------------------------------
create table public.challenge_participants (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  joined_at timestamptz not null default now(),
  primary key (challenge_id, profile_id)
);
create index on public.challenge_participants (profile_id, joined_at desc);
alter table public.challenge_participants enable row level security;
create policy "see own or managed participants" on public.challenge_participants for select to authenticated
  using (profile_id = (select auth.uid()) or public.can_review_challenge(challenge_id));
revoke insert, update, delete on public.challenge_participants from authenticated;

-- ---------------------------------------------------------------------------
-- Submissions
-- ---------------------------------------------------------------------------
drop trigger force_pending on public.challenge_submissions;
drop policy "submit to an open challenge" on public.challenge_submissions;
drop policy "withdraw a pending submission" on public.challenge_submissions;
drop policy "see own or review submissions" on public.challenge_submissions;
alter table public.challenge_submissions
  drop constraint challenge_submissions_note_check,
  drop constraint challenge_submissions_status_check,
  drop constraint challenge_submissions_challenge_id_profile_id_key;
update public.challenge_submissions set status = 'submitted' where status = 'pending';
alter table public.challenge_submissions
  alter column note set default '',
  alter column status set default 'submitted',
  add column video_path text,
  add column answers text[] not null default '{}',
  add column attempt int not null default 1 check (attempt >= 1),
  add column claimed_by uuid references public.profiles (id) on delete set null,
  add column placement int check (placement between 1 and 10),
  add column points_awarded int,
  add column ledger_source uuid,
  add column overridden boolean not null default false,
  add constraint challenge_submissions_note_check check (char_length(note) <= 1000),
  add constraint challenge_submissions_status_check check (status in ('submitted', 'pending', 'approved', 'rejected')),
  add constraint challenge_submissions_attempt_key unique (challenge_id, profile_id, attempt);
-- Entries from the old weekly challenges were paid against the challenge itself.
update public.challenge_submissions s
set ledger_source = s.challenge_id, points_awarded = c.points
from public.challenges c
where c.id = s.challenge_id and s.status = 'approved';
create index on public.challenge_submissions (challenge_id, status, created_at);
create index on public.challenge_submissions (profile_id, created_at desc);

create policy "see own or managed submissions" on public.challenge_submissions for select to authenticated
  using (profile_id = (select auth.uid()) or public.can_review_challenge(challenge_id));
revoke insert, update, delete on public.challenge_submissions from authenticated;

-- ---------------------------------------------------------------------------
-- Audit trail and point history (nobody can change or delete these)
-- ---------------------------------------------------------------------------
create table public.challenge_reviews (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  submission_id uuid references public.challenge_submissions (id) on delete set null,
  subject text not null check (subject in ('idea', 'proof')),
  action text not null check (action in ('submit', 'withdraw', 'approve', 'reject', 'override_approve', 'override_reject',
                                         'cancel', 'claim', 'rank')),
  actor_id uuid references public.profiles (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index on public.challenge_reviews (challenge_id, created_at desc);
create index on public.challenge_reviews (submission_id);
alter table public.challenge_reviews enable row level security;
create policy "see challenge history" on public.challenge_reviews for select to authenticated
  using (public.can_review_challenge(challenge_id));
revoke insert, update, delete on public.challenge_reviews from authenticated;

create table public.challenge_point_log (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  submission_id uuid references public.challenge_submissions (id) on delete set null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  points int not null check (points <> 0),
  kind text not null check (kind in ('award', 'rank', 'revoke')),
  by_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.challenge_point_log (challenge_id, created_at desc);
create index on public.challenge_point_log (profile_id, created_at desc);
alter table public.challenge_point_log enable row level security;
create policy "see own or managed point history" on public.challenge_point_log for select to authenticated
  using (profile_id = (select auth.uid()) or public.can_review_challenge(challenge_id));
revoke insert, update, delete on public.challenge_point_log from authenticated;

-- ---------------------------------------------------------------------------
-- Proof files: private; only the student and the people who check the challenge can open them.
-- Path: "<school id>/<challenge id>/<student id>/<file>"
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('challenge-proof', 'challenge-proof', false, 26214400,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

create function public.challenge_proof_uploader(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' then
      split_part(p_name, '/', 1) = public.my_school_id()::text
      and split_part(p_name, '/', 3) = (select auth.uid())::text
      and exists (select 1 from public.challenge_participants
                  where challenge_id = split_part(p_name, '/', 2)::uuid and profile_id = (select auth.uid()))
    else false end
$$;
create function public.challenge_proof_viewer(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' then
      split_part(p_name, '/', 3) = (select auth.uid())::text
      or public.can_review_challenge(split_part(p_name, '/', 2)::uuid)
    else false end
$$;
create policy "upload challenge proof" on storage.objects for insert to authenticated
  with check (bucket_id = 'challenge-proof' and public.is_active() and public.challenge_proof_uploader(name));
create policy "see challenge proof" on storage.objects for select to authenticated
  using (bucket_id = 'challenge-proof' and public.is_reader() and public.challenge_proof_viewer(name));
create policy "delete own challenge proof" on storage.objects for delete to authenticated
  using (bucket_id = 'challenge-proof' and split_part(name, '/', 3) = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Create, edit and send a challenge idea for review
-- ---------------------------------------------------------------------------
create function public.save_challenge(p_id uuid, p jsonb, p_submit boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_school uuid := public.my_school_id();
  c public.challenges;
  v_id uuid;
  v_title text := left(btrim(coalesce(p ->> 'title', '')), 100);
  v_desc text := left(btrim(coalesce(p ->> 'description', '')), 1000);
  v_instr text := left(btrim(coalesce(p ->> 'instructions', '')), 2000);
  v_rules text := left(btrim(coalesce(p ->> 'rules', '')), 1000);
  v_emoji text := coalesce(nullif(left(btrim(coalesce(p ->> 'emoji', '')), 8), ''), '🏁');
  v_cat text := coalesce(nullif(p ->> 'category', ''), 'other');
  v_kind text := coalesce(nullif(p ->> 'kind', ''), 'digital');
  v_aud text := coalesce(nullif(p ->> 'audience', ''), 'school');
  v_grade int := nullif(p ->> 'audience_grade', '')::int;
  v_section text := nullif(upper(btrim(coalesce(p ->> 'audience_section', ''))), '');
  v_starts timestamptz := coalesce(nullif(p ->> 'starts_at', '')::timestamptz, now());
  v_ends timestamptz := coalesce(nullif(p ->> 'ends_at', '')::timestamptz, now() + interval '7 days');
  v_points int := coalesce(nullif(p ->> 'points', '')::int, 0);
  v_mode text := coalesce(nullif(p ->> 'reward_mode', ''), 'fixed');
  v_max int := nullif(p ->> 'max_participants', '')::int;
  v_attempts int := coalesce(nullif(p ->> 'attempts_per_student', '')::int, 1);
  v_rewards int := coalesce(nullif(p ->> 'rewards_per_student', '')::int, 1);
  v_cover text := nullif(btrim(coalesce(p ->> 'cover_path', '')), '');
  v_safe boolean := coalesce((p ->> 'safety_confirmed')::boolean, false);
  v_proof text[];
  v_questions text[];
  v_prizes jsonb := coalesce(p -> 'prizes', '[]'::jsonb);
  v_n int;
  v_last int;
  i int;
  v_pts int;
begin
  if not public.is_active() then
    raise exception 'Your account cannot create challenges right now.';
  end if;
  if public.is_restricted('publishing') then
    raise exception 'You cannot publish challenges right now.';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_proof from jsonb_array_elements_text(coalesce(p -> 'proof_kinds', '[]')) x;
  select coalesce(array_agg(left(btrim(x), 200)), '{}') into v_questions
  from jsonb_array_elements_text(coalesce(p -> 'questions', '[]')) x where btrim(x) <> '';

  if v_cat not in ('academic', 'creative', 'sports', 'community', 'wellbeing', 'fun', 'other') then
    raise exception 'Choose a category.';
  end if;
  if v_kind not in ('digital', 'real_life', 'hybrid') then
    raise exception 'Choose the challenge type.';
  end if;
  if v_mode not in ('fixed', 'ranked') then
    raise exception 'Choose how points are given.';
  end if;
  if v_aud not in ('school', 'grade', 'class') then
    raise exception 'Choose who can take part.';
  end if;
  if v_aud = 'school' then
    v_grade := null; v_section := null;
  elsif v_grade is null or v_grade not between 1 and 12 then
    raise exception 'Choose a grade.';
  elsif v_aud = 'grade' then
    v_section := null;
  elsif v_section is null or char_length(v_section) > 2 then
    raise exception 'Choose a class letter.';
  end if;
  if not v_proof <@ array['photo', 'video', 'text', 'answers'] then
    raise exception 'Unknown proof type.';
  end if;
  if cardinality(v_questions) > 10 then
    raise exception 'Use at most 10 questions.';
  end if;
  if v_points not between 0 and 100 then
    raise exception 'The reward must be between 0 and 100 points.';
  end if;
  if v_attempts not between 1 and 20 then
    raise exception 'Attempts must be between 1 and 20.';
  end if;
  if v_rewards not between 1 and v_attempts then
    raise exception 'Rewarded attempts must be between 1 and the number of attempts.';
  end if;
  if v_max is not null and v_max not between 1 and 5000 then
    raise exception 'The participant limit must be between 1 and 5000.';
  end if;
  if v_ends <= v_starts then
    raise exception 'The deadline must be after the start.';
  end if;
  if v_ends > v_starts + interval '120 days' then
    raise exception 'A challenge can run for at most 120 days.';
  end if;
  if v_cover is not null and v_cover not like v_school::text || '/' || me::text || '/%' then
    raise exception 'That cover photo is not yours.';
  end if;
  if char_length(v_title) < 3 then
    raise exception 'Give the challenge a title.';
  end if;
  perform public.reject_blocked(v_school,
    v_title || ' ' || v_desc || ' ' || v_instr || ' ' || v_rules || ' ' || array_to_string(v_questions, ' '));

  -- Prizes for a ranked challenge.
  if v_mode = 'ranked' then
    v_n := jsonb_array_length(v_prizes);
    if v_n > 10 then
      raise exception 'You can give prizes for at most 10 places.';
    end if;
    v_last := 301;
    for i in 1..v_n loop
      v_pts := coalesce(nullif(v_prizes -> (i - 1) ->> 'points', '')::int, 0);
      if v_pts not between 1 and 300 then
        raise exception 'Each prize must be between 1 and 300 points.';
      end if;
      if v_pts > v_last then
        raise exception 'A better place cannot get fewer points than a lower place.';
      end if;
      v_last := v_pts;
    end loop;
  else
    v_prizes := '[]'::jsonb;
    v_n := 0;
    if v_points < 5 and p_submit then
      raise exception 'A fixed reward must be at least 5 points.';
    end if;
    if v_points < 5 then v_points := 5; end if;
  end if;

  if p_submit then
    if char_length(v_desc) < 10 then
      raise exception 'Describe the challenge so students know what to do.';
    end if;
    if cardinality(v_proof) < 1 then
      raise exception 'Choose what proof students must send.';
    end if;
    if 'answers' = any (v_proof) and cardinality(v_questions) < 1 then
      raise exception 'Add at least one question, or remove "answers" from the proof.';
    end if;
    if v_mode = 'ranked' and v_n < 1 then
      raise exception 'Add at least one prize for a ranked challenge.';
    end if;
    if not v_safe then
      raise exception 'Please confirm the challenge is safe and respects other people''s privacy.';
    end if;
    if v_ends <= now() then
      raise exception 'The deadline must be in the future.';
    end if;
  end if;
  -- A draft may be unfinished; keep it valid for the table.
  if cardinality(v_questions) = 0 then
    v_proof := array_remove(v_proof, 'answers');
  end if;
  if cardinality(v_proof) < 1 then
    v_proof := array['text'];
  end if;

  if p_id is null then
    perform public.check_rate('challenge_create', 10, 86400);
    insert into public.challenges (
      school_id, created_by, title, description, emoji, points, starts_at, ends_at, status, category, kind,
      instructions, rules, cover_path, audience, audience_grade, audience_section, proof_kinds, questions,
      max_participants, attempts_per_student, rewards_per_student, reward_mode, safety_confirmed
    ) values (
      v_school, me, v_title, v_desc, v_emoji, v_points, v_starts, v_ends, 'draft', v_cat, v_kind,
      v_instr, v_rules, v_cover, v_aud, v_grade, v_section, v_proof, v_questions,
      v_max, v_attempts, v_rewards, v_mode, v_safe
    ) returning id into v_id;
  else
    select * into c from public.challenges
    where id = p_id and created_by = me and school_id = v_school for update;
    if c.id is null then
      raise exception 'Challenge not found.';
    end if;
    if c.status not in ('draft', 'rejected') then
      raise exception 'You can only edit a draft or a rejected challenge. Withdraw it from review first.';
    end if;
    update public.challenges set
      title = v_title, description = v_desc, emoji = v_emoji, points = v_points, starts_at = v_starts, ends_at = v_ends,
      category = v_cat, kind = v_kind, instructions = v_instr, rules = v_rules, cover_path = v_cover,
      audience = v_aud, audience_grade = v_grade, audience_section = v_section, proof_kinds = v_proof,
      questions = v_questions, max_participants = v_max, attempts_per_student = v_attempts,
      rewards_per_student = v_rewards, reward_mode = v_mode, safety_confirmed = v_safe,
      status = 'draft', updated_at = now()
    where id = c.id;
    v_id := c.id;
  end if;

  delete from public.challenge_prizes where challenge_id = v_id;
  for i in 1..v_n loop
    insert into public.challenge_prizes (challenge_id, place, points)
    values (v_id, i, (v_prizes -> (i - 1) ->> 'points')::int);
  end loop;

  if p_submit then
    update public.challenges set status = 'pending', submitted_at = now(), review_note = null
    where id = v_id;
    insert into public.challenge_reviews (school_id, challenge_id, subject, action, actor_id)
    values (v_school, v_id, 'idea', 'submit', me);
    insert into public.notifications (school_id, recipient_id, kind, title, body, link)
    select v_school, pr.id, 'challenge_idea', 'A challenge is waiting for review', v_title, '/challenges/review'
    from public.profiles pr
    where pr.school_id = v_school and pr.deactivated_at is null and pr.id <> me
      and (pr.role in ('admin', 'super_admin') or exists (
        select 1 from public.leadership_roles l where l.profile_id = pr.id and l.kind = 'council_member'));
  end if;
  return v_id;
end;
$$;

create function public.withdraw_challenge(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.challenges set status = 'draft', updated_at = now()
  where id = p_id and created_by = auth.uid() and status = 'pending' and school_id = public.my_school_id();
  if not found then
    raise exception 'Only a challenge waiting for review can be taken back.';
  end if;
  insert into public.challenge_reviews (school_id, challenge_id, subject, action, actor_id, note)
  values (public.my_school_id(), p_id, 'idea', 'withdraw', auth.uid(), 'Taken back by its creator');
end;
$$;

create function public.delete_challenge_draft(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.challenges
  where id = p_id and created_by = auth.uid() and status in ('draft', 'rejected') and school_id = public.my_school_id();
  if not found then
    raise exception 'Only a draft or rejected challenge can be deleted.';
  end if;
end;
$$;

-- The Council or an admin approves or rejects a challenge idea.
create function public.review_challenge_idea(p_challenge uuid, p_approve boolean, p_note text, p_safe boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.challenges;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
  v_top int;
begin
  if not public.can_govern_challenges() then
    raise exception 'Only the Student Council or an admin can review challenge ideas.';
  end if;
  select * into c from public.challenges
  where id = p_challenge and school_id = public.my_school_id() and status = 'pending' for update;
  if c.id is null then
    raise exception 'Challenge not found or already reviewed.';
  end if;
  if c.created_by = auth.uid() and not public.is_admin() then
    raise exception 'Another reviewer has to check your own challenge.';
  end if;
  if p_approve then
    if p_safe is not true then
      raise exception 'Confirm the challenge is safe, private and inside school rules first.';
    end if;
    if c.ends_at <= now() then
      raise exception 'The deadline has already passed. Ask the creator to change the dates.';
    end if;
    select coalesce(max(points), 0) into v_top from public.challenge_prizes where challenge_id = c.id;
    if greatest(v_top, c.points) > 100 and not public.is_admin() then
      raise exception 'Only an admin can approve prizes above 100 points.';
    end if;
  elsif v_note is null or char_length(v_note) < 3 then
    raise exception 'Tell the creator what to change.';
  end if;

  update public.challenges
  set status = case when p_approve then 'approved' else 'rejected' end,
      review_note = v_note, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = c.id;
  insert into public.challenge_reviews (school_id, challenge_id, subject, action, actor_id, note)
  values (c.school_id, c.id, 'idea', case when p_approve then 'approve' else 'reject' end, auth.uid(), coalesce(v_note, ''));
  perform public.log_action(c.school_id, case when p_approve then 'approve_challenge_idea' else 'reject_challenge_idea' end,
    'challenge', c.id, c.title);
  perform public.notify(c.created_by, 'challenge_idea',
    case when p_approve then 'Your challenge was approved: ' || c.title else 'Your challenge needs changes: ' || c.title end,
    coalesce(v_note, case when p_approve then 'Students can join it now.' else '' end), '/challenges/' || c.id);
end;
$$;

-- The creator, the Council or an admin can stop a challenge.
create function public.cancel_challenge(p_challenge uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.challenges;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
begin
  select * into c from public.challenges
  where id = p_challenge and school_id = public.my_school_id() and status in ('pending', 'approved') for update;
  if c.id is null then
    raise exception 'Challenge not found.';
  end if;
  if not (c.created_by = auth.uid() or public.can_govern_challenges()) then
    raise exception 'Only its creator, the Student Council or an admin can cancel a challenge.';
  end if;
  if v_note is null then
    raise exception 'Say why you are cancelling it.';
  end if;
  update public.challenges set status = 'cancelled', review_note = v_note, updated_at = now() where id = c.id;
  insert into public.challenge_reviews (school_id, challenge_id, subject, action, actor_id, note)
  values (c.school_id, c.id, 'idea', 'cancel', auth.uid(), v_note);
  perform public.log_action(c.school_id, 'cancel_challenge', 'challenge', c.id, c.title);
  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select c.school_id, p.profile_id, 'challenge_cancelled', 'A challenge was cancelled: ' || c.title, v_note, '/challenges/' || c.id
  from public.challenge_participants p where p.challenge_id = c.id and p.profile_id <> auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Join and send proof
-- ---------------------------------------------------------------------------
create function public.join_challenge(p_challenge uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c public.challenges;
begin
  if not public.is_active() or not public.is_current_student(me) then
    raise exception 'Only current students can join challenges.';
  end if;
  select * into c from public.challenges
  where id = p_challenge and school_id = public.my_school_id() and status = 'approved' for update;
  if c.id is null or not public.challenge_in_audience(c.audience, c.audience_grade, c.audience_section) then
    raise exception 'This challenge is not available.';
  end if;
  if c.created_by = me then
    raise exception 'You cannot join your own challenge.';
  end if;
  if now() < c.starts_at then
    raise exception 'This challenge has not started yet.';
  end if;
  if now() >= c.ends_at then
    raise exception 'This challenge has ended.';
  end if;
  if exists (select 1 from public.challenge_participants where challenge_id = c.id and profile_id = me) then
    return;
  end if;
  if c.max_participants is not null
     and (select count(*) from public.challenge_participants where challenge_id = c.id) >= c.max_participants then
    raise exception 'This challenge is full.';
  end if;
  perform public.check_rate('challenge_join', 30, 3600);
  insert into public.challenge_participants (challenge_id, profile_id, school_id) values (c.id, me, c.school_id);
end;
$$;

create function public.submit_challenge(p_challenge uuid, p_note text, p_photo text, p_video text, p_answers text[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c public.challenges;
  v_prefix text;
  v_note text := left(btrim(coalesce(p_note, '')), 1000);
  v_answers text[] := '{}';
  v_photo text := nullif(btrim(coalesce(p_photo, '')), '');
  v_video text := nullif(btrim(coalesce(p_video, '')), '');
  v_id uuid := gen_random_uuid();
  v_live int;
  v_all int;
  v_attempt int;
  x text;
begin
  if not public.is_active() or not public.is_current_student(me) then
    raise exception 'Only current students can send proof.';
  end if;
  select * into c from public.challenges
  where id = p_challenge and school_id = public.my_school_id() and status = 'approved' for update;
  if c.id is null then
    raise exception 'This challenge is not available.';
  end if;
  if now() < c.starts_at or now() >= c.ends_at then
    raise exception 'This challenge is not open right now.';
  end if;
  if not exists (select 1 from public.challenge_participants where challenge_id = c.id and profile_id = me) then
    raise exception 'Join the challenge first.';
  end if;
  perform public.check_rate('challenge_submit', 20, 86400);

  if exists (select 1 from public.challenge_submissions
             where challenge_id = c.id and profile_id = me and status in ('submitted', 'pending')) then
    raise exception 'Your last entry is still being checked.';
  end if;
  select count(*) filter (where status in ('submitted', 'pending', 'approved')), count(*), coalesce(max(attempt), 0) + 1
  into v_live, v_all, v_attempt
  from public.challenge_submissions where challenge_id = c.id and profile_id = me;
  if v_live >= c.attempts_per_student then
    raise exception 'You have used all your attempts for this challenge.';
  end if;
  if v_all >= least(c.attempts_per_student * 3, 30) then
    raise exception 'You have tried this challenge too many times.';
  end if;

  v_prefix := c.school_id::text || '/' || c.id::text || '/' || me::text || '/';
  if 'photo' = any (c.proof_kinds) then
    if v_photo is null or v_photo not like v_prefix || '%' or char_length(v_photo) > 250 then
      raise exception 'Add a photo.';
    end if;
  else
    v_photo := null;
  end if;
  if 'video' = any (c.proof_kinds) then
    if v_video is null or v_video not like v_prefix || '%' or char_length(v_video) > 250 then
      raise exception 'Add a video.';
    end if;
  else
    v_video := null;
  end if;
  if 'text' = any (c.proof_kinds) then
    if char_length(v_note) < 3 then
      raise exception 'Write a short description of what you did.';
    end if;
  end if;
  if 'answers' = any (c.proof_kinds) then
    if p_answers is null or cardinality(p_answers) <> cardinality(c.questions) then
      raise exception 'Answer every question.';
    end if;
    foreach x in array p_answers loop
      if char_length(btrim(coalesce(x, ''))) < 1 then
        raise exception 'Answer every question.';
      end if;
      v_answers := v_answers || left(btrim(x), 500);
    end loop;
    perform public.reject_blocked(c.school_id, array_to_string(v_answers, ' '));
  end if;

  insert into public.challenge_submissions (id, school_id, challenge_id, profile_id, note, image_path, video_path, answers,
                                            attempt, status, ledger_source)
  values (v_id, c.school_id, c.id, me, v_note, v_photo, v_video, v_answers, v_attempt, 'submitted', v_id);
  insert into public.challenge_reviews (school_id, challenge_id, submission_id, subject, action, actor_id)
  values (c.school_id, c.id, v_id, 'proof', 'submit', me);
  if c.created_by is not null then
    perform public.notify(c.created_by, 'challenge_entry', 'New entry for ' || c.title,
      (select full_name from public.profiles where id = me), '/challenges/' || c.id || '/manage');
  end if;
  return v_id;
end;
$$;

create function public.withdraw_challenge_submission(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.challenge_submissions;
begin
  select * into s from public.challenge_submissions
  where id = p_id and profile_id = auth.uid() and status = 'submitted' for update;
  if s.id is null then
    raise exception 'You can only take back an entry nobody has started checking.';
  end if;
  insert into public.challenge_reviews (school_id, challenge_id, submission_id, subject, action, actor_id, note)
  values (s.school_id, s.challenge_id, s.id, 'proof', 'withdraw', auth.uid(), 'Taken back by the student');
  delete from public.challenge_submissions where id = s.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Checking proof
-- ---------------------------------------------------------------------------
create function public.claim_challenge_submission(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.challenge_submissions;
begin
  select * into s from public.challenge_submissions
  where id = p_id and school_id = public.my_school_id() and status = 'submitted' for update;
  if s.id is null then
    raise exception 'Entry not found or already being checked.';
  end if;
  if not public.can_review_challenge(s.challenge_id) then
    raise exception 'You cannot check this challenge.';
  end if;
  if s.profile_id = auth.uid() then
    raise exception 'You cannot check your own entry.';
  end if;
  update public.challenge_submissions set status = 'pending', claimed_by = auth.uid() where id = s.id;
  insert into public.challenge_reviews (school_id, challenge_id, submission_id, subject, action, actor_id)
  values (s.school_id, s.challenge_id, s.id, 'proof', 'claim', auth.uid());
end;
$$;

-- Approve or reject. A decision that is already made can only be changed by the Council or an admin.
create or replace function public.review_challenge_submission(p_submission uuid, p_approve boolean, p_note text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  s public.challenge_submissions;
  c public.challenges;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
  v_override boolean;
  v_got int := 0;
  v_before int;
  v_after int;
begin
  select * into s from public.challenge_submissions
  where id = p_submission and school_id = public.my_school_id() for update;
  if s.id is null then
    raise exception 'Entry not found.';
  end if;
  select * into c from public.challenges where id = s.challenge_id for update;
  if not public.can_review_challenge(c.id) then
    raise exception 'You cannot check this challenge.';
  end if;
  if s.profile_id = me then
    raise exception 'You cannot check your own entry.';
  end if;
  if p_approve and s.status = 'approved' or not p_approve and s.status = 'rejected' then
    raise exception 'That is already the decision.';
  end if;
  v_override := s.status in ('approved', 'rejected');
  if v_override and not public.can_govern_challenges() then
    raise exception 'Only the Student Council or an admin can change a decision.';
  end if;
  if v_override and (v_note is null or char_length(v_note) < 3) then
    raise exception 'Explain why you are changing the decision.';
  end if;
  if not p_approve and (v_note is null or char_length(v_note) < 3) then
    raise exception 'Tell the student why it was not accepted.';
  end if;
  if p_approve and c.status <> 'approved' then
    raise exception 'This challenge is closed.';
  end if;

  select coalesce(sum(points), 0) into v_before from public.points_ledger
  where profile_id = s.profile_id and source_id = s.ledger_source and reason in ('challenge', 'challenge_rank');

  if p_approve then
    if c.points > 0 and (select count(*) from public.challenge_submissions
                         where challenge_id = c.id and profile_id = s.profile_id and status = 'approved'
                           and coalesce(points_awarded, 0) > 0 and id <> s.id) < c.rewards_per_student then
      perform public.award_points(s.profile_id, c.points, 'challenge', s.ledger_source);
    end if;
  elsif s.status = 'approved' then
    -- A decision is reversed: take the points back and keep a record.
    delete from public.points_ledger
    where profile_id = s.profile_id and source_id = s.ledger_source and reason in ('challenge', 'challenge_rank');
  end if;

  select coalesce(sum(points), 0) into v_after from public.points_ledger
  where profile_id = s.profile_id and source_id = s.ledger_source and reason in ('challenge', 'challenge_rank');
  v_got := v_after - v_before;

  update public.challenge_submissions
  set status = case when p_approve then 'approved' else 'rejected' end,
      review_note = v_note, reviewed_by = me, reviewed_at = now(),
      overridden = overridden or v_override,
      placement = case when p_approve then placement end,
      points_awarded = nullif(v_after, 0)
  where id = s.id;

  if v_got <> 0 then
    insert into public.challenge_point_log (school_id, challenge_id, submission_id, profile_id, points, kind, by_id)
    values (s.school_id, c.id, s.id, s.profile_id, v_got, case when v_got > 0 then 'award' else 'revoke' end, me);
  end if;
  insert into public.challenge_reviews (school_id, challenge_id, submission_id, subject, action, actor_id, note)
  values (s.school_id, c.id, s.id, 'proof',
          case when v_override then (case when p_approve then 'override_approve' else 'override_reject' end)
               else (case when p_approve then 'approve' else 'reject' end) end, me, coalesce(v_note, ''));
  perform public.log_action(s.school_id, case when p_approve then 'approve_challenge' else 'reject_challenge' end,
    'challenge', c.id, c.title || case when v_override then ' (decision changed)' else '' end);
  if p_approve then
    perform public.notify(s.profile_id, 'challenge_approved', c.emoji || ' Challenge complete: ' || c.title,
      case when v_got > 0 then '+' || v_got || ' points!' else coalesce(v_note, 'Well done!') end, '/challenges/' || c.id);
  else
    perform public.notify(s.profile_id, 'challenge_rejected', 'Your entry for ' || c.title || ' was not accepted',
      v_note, '/challenges/' || c.id);
  end if;
end;
$$;

-- Final places for a ranked challenge, set once after the deadline.
create function public.rank_challenge(p_challenge uuid, p_order uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.challenges;
  s public.challenge_submissions;
  v_prizes int;
  v_pts int;
  v_got int;
  v_seen uuid[] := '{}';
  i int;
begin
  select * into c from public.challenges
  where id = p_challenge and school_id = public.my_school_id() for update;
  if c.id is null or not public.can_review_challenge(c.id) then
    raise exception 'You cannot rank this challenge.';
  end if;
  if c.reward_mode <> 'ranked' or c.status <> 'approved' then
    raise exception 'This challenge does not have ranked prizes.';
  end if;
  if c.ends_at > now() then
    raise exception 'You can set the winners after the deadline.';
  end if;
  if c.ranked_at is not null then
    raise exception 'The winners were already chosen.';
  end if;
  select count(*) into v_prizes from public.challenge_prizes where challenge_id = c.id;
  if p_order is null or cardinality(p_order) < 1 or cardinality(p_order) > v_prizes then
    raise exception 'Choose between 1 and % winners.', v_prizes;
  end if;
  for i in 1..cardinality(p_order) loop
    select * into s from public.challenge_submissions
    where id = p_order[i] and challenge_id = c.id and status = 'approved' for update;
    if s.id is null then
      raise exception 'Only approved entries can win.';
    end if;
    if s.profile_id = any (v_seen) then
      raise exception 'A student can only win one place.';
    end if;
    v_seen := v_seen || s.profile_id;
    select points into v_pts from public.challenge_prizes where challenge_id = c.id and place = i;
    perform public.award_points(s.profile_id, v_pts, 'challenge_rank', s.ledger_source);
    select coalesce(sum(points), 0) into v_got from public.points_ledger
    where profile_id = s.profile_id and source_id = s.ledger_source and reason in ('challenge', 'challenge_rank');
    update public.challenge_submissions set placement = i, points_awarded = nullif(v_got, 0) where id = s.id;
    insert into public.challenge_point_log (school_id, challenge_id, submission_id, profile_id, points, kind, by_id)
    values (c.school_id, c.id, s.id, s.profile_id, v_pts, 'rank', auth.uid());
    perform public.notify(s.profile_id, 'challenge_rank', c.emoji || ' You placed #' || i || ' in ' || c.title,
      '+' || v_pts || ' points!', '/challenges/' || c.id);
  end loop;
  update public.challenges set ranked_at = now(), updated_at = now() where id = c.id;
  insert into public.challenge_reviews (school_id, challenge_id, subject, action, actor_id, note)
  values (c.school_id, c.id, 'proof', 'rank', auth.uid(), cardinality(p_order) || ' winners');
  perform public.log_action(c.school_id, 'rank_challenge', 'challenge', c.id, c.title);
end;
$$;

-- ---------------------------------------------------------------------------
-- Numbers and warning signs
-- ---------------------------------------------------------------------------
create function public.challenge_counts(p_ids uuid[]) returns table (challenge_id uuid, participants int, approved int)
language sql stable security definer set search_path = '' as $$
  select c.id,
         (select count(*)::int from public.challenge_participants p where p.challenge_id = c.id),
         (select count(distinct s.profile_id)::int from public.challenge_submissions s
          where s.challenge_id = c.id and s.status = 'approved')
  from public.challenges c
  where c.id = any (p_ids) and c.school_id = public.my_school_id() and c.status in ('approved', 'cancelled')
$$;

create function public.challenge_stats(p_challenge uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_review_challenge(p_challenge) then
    raise exception 'You cannot see these numbers.';
  end if;
  return (select json_build_object(
    'participants', (select count(*) from public.challenge_participants where challenge_id = p_challenge),
    'submitted', (select count(*) from public.challenge_submissions where challenge_id = p_challenge and status = 'submitted'),
    'pending', (select count(*) from public.challenge_submissions where challenge_id = p_challenge and status = 'pending'),
    'approved', (select count(*) from public.challenge_submissions where challenge_id = p_challenge and status = 'approved'),
    'rejected', (select count(*) from public.challenge_submissions where challenge_id = p_challenge and status = 'rejected'),
    'points', (select coalesce(sum(points), 0) from public.challenge_point_log where challenge_id = p_challenge)));
end;
$$;

create function public.challenge_flags() returns table (kind text, profile_id uuid, full_name text, detail text, n int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.can_govern_challenges() or public.is_staff()) then
    raise exception 'Only reviewers can see this.';
  end if;
  return query
    select 'rejections'::text, s.profile_id, p.full_name, 'entries rejected in the last 14 days'::text, count(*)::int
    from public.challenge_submissions s join public.profiles p on p.id = s.profile_id
    where s.school_id = public.my_school_id() and s.status = 'rejected' and s.reviewed_at > now() - interval '14 days'
    group by s.profile_id, p.full_name having count(*) >= 3
    union all
    select 'burst'::text, s.profile_id, p.full_name, 'entries sent in the last 24 hours'::text, count(*)::int
    from public.challenge_submissions s join public.profiles p on p.id = s.profile_id
    where s.school_id = public.my_school_id() and s.created_at > now() - interval '24 hours'
    group by s.profile_id, p.full_name having count(*) >= 10
    union all
    select 'creator_favours'::text, s.profile_id, p.full_name,
           'entries approved by the same challenge creator in 30 days'::text, count(*)::int
    from public.challenge_submissions s
    join public.challenges c on c.id = s.challenge_id
    join public.profiles p on p.id = s.profile_id
    where s.school_id = public.my_school_id() and s.status = 'approved' and s.reviewed_by = c.created_by
      and s.reviewed_at > now() - interval '30 days'
    group by s.profile_id, c.created_by, p.full_name having count(*) >= 5
    union all
    select 'ideas_rejected'::text, c.created_by, p.full_name, 'challenge ideas rejected in 30 days'::text, count(*)::int
    from public.challenges c join public.profiles p on p.id = c.created_by
    where c.school_id = public.my_school_id() and c.status = 'rejected' and c.reviewed_at > now() - interval '30 days'
    group by c.created_by, p.full_name having count(*) >= 3;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports can be about a challenge
-- ---------------------------------------------------------------------------
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'message', 'profile', 'club', 'event', 'listing', 'question', 'answer', 'comment', 'group',
                         'challenge'));

do $$
declare
  f record;
  d text;
begin
  -- Reports: look up and remove a challenge.
  for f in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
    and p.proname in ('reports_before_insert', 'moderate_report') loop
    d := pg_get_functiondef(f.oid);
    d := replace(d, E'  elsif new.target_type = ''comment'' then',
      E'  elsif new.target_type = ''challenge'' then\n    select school_id, created_by, title || '': '' || description\n      into v_school, new.target_author_id, new.snapshot\n    from public.challenges where id = new.target_id;\n  elsif new.target_type = ''comment'' then');
    d := replace(d, E'    elsif r.target_type = ''group'' then',
      E'    elsif r.target_type = ''challenge'' then\n      update public.challenges set status = ''cancelled'', updated_at = now()\n      where id = r.target_id and status in (''pending'', ''approved'');\n    elsif r.target_type = ''group'' then');
    execute d;
  end loop;
  -- The moderators'' to-do count includes entries that are still waiting.
  for f in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
    and pg_get_functiondef(p.oid) like '%from public.challenge_submissions where school_id = public.my_school_id() and status = ''pending''%' loop
    d := replace(pg_get_functiondef(f.oid),
      'from public.challenge_submissions where school_id = public.my_school_id() and status = ''pending''',
      'from public.challenge_submissions where school_id = public.my_school_id() and status in (''submitted'', ''pending'')');
    execute d;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'can_govern_challenges()', 'can_review_challenge(uuid)', 'challenge_in_audience(text, int, text)',
    'challenge_proof_uploader(text)', 'challenge_proof_viewer(text)',
    'save_challenge(uuid, jsonb, boolean)', 'withdraw_challenge(uuid)', 'delete_challenge_draft(uuid)',
    'review_challenge_idea(uuid, boolean, text, boolean)', 'cancel_challenge(uuid, text)',
    'join_challenge(uuid)', 'submit_challenge(uuid, text, text, text, text[])', 'withdraw_challenge_submission(uuid)',
    'claim_challenge_submission(uuid)', 'review_challenge_submission(uuid, boolean, text)',
    'rank_challenge(uuid, uuid[])', 'challenge_counts(uuid[])', 'challenge_stats(uuid)', 'challenge_flags()'
  ] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
