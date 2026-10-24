-- =============================================================================
-- Pbs Go Phase 2: security rules and starter data
-- =============================================================================

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Internal helpers the app never calls directly.
revoke execute on function public.award_points(uuid, int, text, uuid, timestamptz) from authenticated;
revoke execute on function public.award_badges(uuid) from authenticated;
revoke execute on function public.points_today(uuid, text) from authenticated;

-- Alumni mentors can fill in their university and major.
grant update (avatar, bio, university, major) on public.profiles to authenticated;

alter table public.points_ledger enable row level security;
alter table public.badges enable row level security;
alter table public.profile_badges enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_submissions enable row level security;
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
alter table public.volunteer_entries enable row level security;
alter table public.tutor_profiles enable row level security;
alter table public.tutoring_requests enable row level security;
alter table public.study_buddy_posts enable row level security;
alter table public.listings enable row level security;
alter table public.tawjihi_questions enable row level security;
alter table public.tawjihi_answers enable row level security;
alter table public.council_members enable row level security;
alter table public.elections enable row level security;
alter table public.election_candidates enable row level security;
alter table public.election_votes enable row level security;
alter table public.suggestions enable row level security;
alter table public.counselor_requests enable row level security;
alter table public.counselor_messages enable row level security;

-- Points: each student sees only their own. ------------------------------
create policy "own points" on public.points_ledger for select to authenticated
  using (profile_id = auth.uid());
revoke insert, update, delete on public.points_ledger from authenticated;

create policy "anyone signed in sees badge list" on public.badges for select to authenticated using (true);
revoke insert, update, delete on public.badges from authenticated;

-- Badges are achievements, shown on profiles (never a ranking).
create policy "see badges at school" on public.profile_badges for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.profile_badges from authenticated;

-- Challenges -----------------------------------------------------------
create policy "see challenges" on public.challenges for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "moderators create challenges" on public.challenges for insert to authenticated
  with check (school_id = public.my_school_id() and public.is_staff() and created_by = auth.uid());
create policy "moderators delete challenges" on public.challenges for delete to authenticated
  using (school_id = public.my_school_id() and public.is_staff());
revoke update on public.challenges from authenticated;

create policy "see own or review submissions" on public.challenge_submissions for select to authenticated
  using (profile_id = auth.uid() or (school_id = public.my_school_id() and public.is_staff()));
create policy "submit to an open challenge" on public.challenge_submissions for insert to authenticated
  with check (
    profile_id = auth.uid() and public.is_active() and public.is_current_student(auth.uid())
    and school_id = public.my_school_id()
    and (image_path is null or image_path like public.my_school_id()::text || '/' || auth.uid()::text || '/%')
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_submissions.challenge_id and c.starts_at <= now() and c.ends_at > now()
    )
  );
create policy "withdraw a pending submission" on public.challenge_submissions for delete to authenticated
  using (profile_id = auth.uid() and status = 'pending');
revoke update on public.challenge_submissions from authenticated;

-- Polls ----------------------------------------------------------------
create policy "see polls" on public.polls for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (club_id is null or public.is_club_member(club_id) or public.is_staff())
  );
create policy "create polls" on public.polls for insert to authenticated
  with check (
    school_id = public.my_school_id() and public.is_active() and created_by = auth.uid()
    and closes_at > now()
    and ((club_id is null and public.is_staff()) or (club_id is not null and public.is_club_leader(club_id)))
  );
create policy "delete own polls" on public.polls for delete to authenticated
  using (school_id = public.my_school_id() and (created_by = auth.uid() or public.is_staff()));
revoke update on public.polls from authenticated;

create policy "see own vote" on public.poll_votes for select to authenticated
  using (profile_id = auth.uid());
create policy "vote once in an open poll" on public.poll_votes for insert to authenticated
  with check (
    profile_id = auth.uid() and public.is_active() and public.is_current_student(auth.uid())
    and exists (
      select 1 from public.polls p
      where p.id = poll_votes.poll_id and p.school_id = public.my_school_id() and p.closes_at > now()
        and poll_votes.option_index < array_length(p.options, 1)
        and (p.club_id is null or public.is_club_member(p.club_id))
    )
  );
revoke update, delete on public.poll_votes from authenticated;

-- Volunteering ---------------------------------------------------------
create policy "see own or check hours" on public.volunteer_entries for select to authenticated
  using (profile_id = auth.uid() or (school_id = public.my_school_id() and public.is_staff()));
create policy "log own hours" on public.volunteer_entries for insert to authenticated
  with check (
    profile_id = auth.uid() and public.is_active() and public.is_current_student(auth.uid())
    and school_id = public.my_school_id()
    and activity_date <= (now() at time zone 'Asia/Hebron')::date
  );
create policy "delete pending hours" on public.volunteer_entries for delete to authenticated
  using (profile_id = auth.uid() and status = 'pending');
revoke update on public.volunteer_entries from authenticated;

-- Tutors and study buddies --------------------------------------------
create policy "see tutors" on public.tutor_profiles for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "become a tutor" on public.tutor_profiles for insert to authenticated
  with check (profile_id = auth.uid() and public.is_active() and public.is_current_student(auth.uid())
              and school_id = public.my_school_id());
create policy "edit own tutor profile" on public.tutor_profiles for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "remove own tutor profile" on public.tutor_profiles for delete to authenticated
  using (profile_id = auth.uid());
revoke update on public.tutor_profiles from authenticated;
grant update (subjects, about, availability, active) on public.tutor_profiles to authenticated;

create policy "see own tutoring" on public.tutoring_requests for select to authenticated
  using (learner_id = auth.uid() or tutor_id = auth.uid());
revoke insert, update, delete on public.tutoring_requests from authenticated;

create policy "see study buddy posts" on public.study_buddy_posts for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "post study buddy request" on public.study_buddy_posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_active() and public.is_current_student(auth.uid())
              and school_id = public.my_school_id());
create policy "close own study buddy post" on public.study_buddy_posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete own study buddy post" on public.study_buddy_posts for delete to authenticated
  using (author_id = auth.uid());
revoke update on public.study_buddy_posts from authenticated;
grant update (active) on public.study_buddy_posts to authenticated;

-- Marketplace ----------------------------------------------------------
create policy "see listings" on public.listings for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (status in ('active', 'reserved', 'sold') or seller_id = auth.uid())
  );
create policy "create listing" on public.listings for insert to authenticated
  with check (
    seller_id = auth.uid() and public.is_active() and public.is_current_student(auth.uid())
    and school_id = public.my_school_id()
    and (image_path is null or image_path like public.my_school_id()::text || '/' || auth.uid()::text || '/%')
  );
-- Sellers can mark their item reserved/sold, but not undo a moderator's decision.
create policy "update own listing" on public.listings for update to authenticated
  using (seller_id = auth.uid() and status in ('active', 'reserved', 'sold'))
  with check (seller_id = auth.uid() and status in ('active', 'reserved', 'sold'));
create policy "delete own listing" on public.listings for delete to authenticated
  using (seller_id = auth.uid());
revoke update on public.listings from authenticated;
grant update (title, description, price, condition, status) on public.listings to authenticated;

-- Tawjihi corner -------------------------------------------------------
create policy "see questions" on public.tawjihi_questions for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader() and (status = 'visible' or author_id = auth.uid()));
create policy "ask a question" on public.tawjihi_questions for insert to authenticated
  with check (author_id = auth.uid() and public.is_active() and school_id = public.my_school_id());
create policy "delete own question" on public.tawjihi_questions for delete to authenticated
  using (author_id = auth.uid());
revoke update on public.tawjihi_questions from authenticated;

create policy "see answers" on public.tawjihi_answers for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader() and (status = 'visible' or author_id = auth.uid()));
create policy "answer a question" on public.tawjihi_answers for insert to authenticated
  with check (
    author_id = auth.uid() and public.is_active()
    and exists (select 1 from public.tawjihi_questions q
                where q.id = tawjihi_answers.question_id and q.school_id = public.my_school_id() and q.status = 'visible')
  );
create policy "delete own answer" on public.tawjihi_answers for delete to authenticated
  using (author_id = auth.uid());
revoke update on public.tawjihi_answers from authenticated;

-- Student council and elections ---------------------------------------
create policy "see council" on public.council_members for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "admins manage council" on public.council_members for all to authenticated
  using (school_id = public.my_school_id() and public.is_admin())
  with check (school_id = public.my_school_id() and public.is_admin());

create policy "see elections" on public.elections for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "admins create elections" on public.elections for insert to authenticated
  with check (school_id = public.my_school_id() and public.is_admin() and created_by = auth.uid());
create policy "admins delete elections" on public.elections for delete to authenticated
  using (school_id = public.my_school_id() and public.is_admin());
revoke update on public.elections from authenticated;

create policy "see candidates" on public.election_candidates for select to authenticated
  using (exists (select 1 from public.elections e where e.id = election_candidates.election_id
                 and e.school_id = public.my_school_id()) and public.is_reader());
-- Admins add candidates before voting opens.
create policy "admins add candidates" on public.election_candidates for insert to authenticated
  with check (
    public.is_admin()
    and exists (select 1 from public.elections e where e.id = election_candidates.election_id
                and e.school_id = public.my_school_id() and e.opens_at > now())
    and public.is_current_student(profile_id)
    and exists (select 1 from public.profiles p where p.id = election_candidates.profile_id and p.school_id = public.my_school_id())
  );
create policy "admins remove candidates" on public.election_candidates for delete to authenticated
  using (public.is_admin() and exists (select 1 from public.elections e where e.id = election_candidates.election_id
         and e.school_id = public.my_school_id() and e.opens_at > now()));
-- Candidates write their own statement.
create policy "candidates edit statement" on public.election_candidates for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
revoke update on public.election_candidates from authenticated;
grant update (statement) on public.election_candidates to authenticated;

create policy "see own ballot" on public.election_votes for select to authenticated
  using (voter_id = auth.uid());
create policy "vote once while open" on public.election_votes for insert to authenticated
  with check (
    voter_id = auth.uid() and public.is_active() and public.is_current_student(auth.uid())
    and exists (
      select 1 from public.elections e join public.election_candidates c on c.election_id = e.id
      where e.id = election_votes.election_id and c.id = election_votes.candidate_id
        and e.school_id = public.my_school_id() and e.opens_at <= now() and e.closes_at > now()
        and (e.eligible_grades is null
             or (select grade from public.profiles where id = auth.uid()) = any (e.eligible_grades))
    )
  );
revoke update, delete on public.election_votes from authenticated;

-- Suggestion box -------------------------------------------------------
create policy "see own or answer suggestions" on public.suggestions for select to authenticated
  using (author_id = auth.uid()
         or (school_id = public.my_school_id() and (public.is_admin() or public.is_council_member())));
create policy "send a suggestion" on public.suggestions for insert to authenticated
  with check (author_id = auth.uid() and public.is_active() and school_id = public.my_school_id() and status = 'new');
revoke update, delete on public.suggestions from authenticated;

-- Counselor: ONLY the student and counselors. Admins and moderators cannot see this.
create policy "student or counselor sees request" on public.counselor_requests for select to authenticated
  using (student_id = auth.uid() or (school_id = public.my_school_id() and public.is_counselor()));
revoke insert, update, delete on public.counselor_requests from authenticated;

create policy "student or counselor sees messages" on public.counselor_messages for select to authenticated
  using (exists (
    select 1 from public.counselor_requests r
    where r.id = counselor_messages.request_id
      and (r.student_id = auth.uid() or (r.school_id = public.my_school_id() and public.is_counselor()))
  ));
create policy "reply in own request" on public.counselor_messages for insert to authenticated
  with check (
    sender_id = auth.uid() and public.is_reader()
    and exists (
      select 1 from public.counselor_requests r
      where r.id = counselor_messages.request_id and r.status <> 'closed'
        and (r.student_id = auth.uid() or (r.school_id = public.my_school_id() and public.is_counselor()))
    )
  );
revoke update, delete on public.counselor_messages from authenticated;

-- ---------------------------------------------------------------------------
-- Badges students can earn
-- ---------------------------------------------------------------------------
insert into public.badges (code, name, emoji, description, sort) values
  ('first_club', 'Explorer', '🧭', 'Joined your first club', 1),
  ('clubs_3', 'Club hopper', '🌟', 'Joined 3 clubs', 2),
  ('events_5', 'Event-goer', '🎟️', 'Said "I''m going" to 5 events', 3),
  ('voter', 'My voice', '🗳️', 'Voted in a poll or an election', 4),
  ('challenge_1', 'Challenger', '🏁', 'Completed a weekly challenge', 5),
  ('challenge_5', 'Challenge champion', '🏆', 'Completed 5 weekly challenges', 6),
  ('helper', 'Helper', '🤝', 'Tutored a classmate', 7),
  ('tawjihi_helper', 'Study guide', '🎓', 'Answered 3 Tawjihi questions', 8),
  ('volunteer_10', 'Volunteer', '💚', '10 approved volunteering hours', 9),
  ('volunteer_50', 'Community hero', '🌍', '50 approved volunteering hours', 10),
  ('points_100', 'Rising star', '⭐', 'Earned 100 points', 11),
  ('points_500', 'Superstar', '💫', 'Earned 500 points', 12);
