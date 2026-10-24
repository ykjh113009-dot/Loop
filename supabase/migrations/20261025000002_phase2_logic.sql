-- =============================================================================
-- Pbs Go Phase 2: database logic
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Current students (not alumni, not the counselor).
create function public.is_current_student(p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = p_profile and deactivated_at is null and role <> 'counselor' and alumni_year is null
  )
$$;

create function public.is_counselor() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active() and public.my_role() = 'counselor'
$$;

create function public.is_council_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.council_members
    where profile_id = auth.uid() and school_id = public.my_school_id()
  ) and public.is_active()
$$;

create function public.school_has_counselor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where school_id = public.my_school_id() and role = 'counselor'
      and deactivated_at is null and onboarded_at is not null
  )
$$;

-- Raises a friendly error if the text has a blocked word.
create function public.reject_blocked(p_school uuid, p_text text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.contains_blocked_word(p_school, p_text) then
    raise exception 'BLOCKED_WORD: Please remove inappropriate words and try again.';
  end if;
end;
$$;

-- Sunday 00:00 of the current week, Palestine time.
create function public.week_start() returns timestamptz
language sql stable set search_path = '' as $$
  select (((now() at time zone 'Asia/Hebron')::date
           - extract(dow from now() at time zone 'Asia/Hebron')::int)::timestamp) at time zone 'Asia/Hebron'
$$;

-- Fills in school_id from the signed-in student (seed scripts set it themselves).
create function public.set_my_school() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.school_id := public.my_school_id();
  end if;
  return new;
end;
$$;

create trigger set_school before insert on public.volunteer_entries for each row execute function public.set_my_school();
create trigger set_school before insert on public.tutor_profiles for each row execute function public.set_my_school();
create trigger set_school before insert on public.study_buddy_posts for each row execute function public.set_my_school();
create trigger set_school before insert on public.listings for each row execute function public.set_my_school();
create trigger set_school before insert on public.tawjihi_questions for each row execute function public.set_my_school();
create trigger set_school before insert on public.suggestions for each row execute function public.set_my_school();
create trigger set_school before insert on public.counselor_requests for each row execute function public.set_my_school();
create trigger set_school before insert on public.challenges for each row execute function public.set_my_school();
create trigger set_school before insert on public.polls for each row execute function public.set_my_school();
create trigger set_school before insert on public.elections for each row execute function public.set_my_school();

-- Child rows take the school of their parent.
create function public.set_school_from_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'challenge_submissions' then
    select school_id into new.school_id from public.challenges where id = new.challenge_id;
  elsif tg_table_name = 'poll_votes' then
    select school_id into new.school_id from public.polls where id = new.poll_id;
  elsif tg_table_name = 'tawjihi_answers' then
    select school_id into new.school_id from public.tawjihi_questions where id = new.question_id;
  elsif tg_table_name = 'election_votes' then
    select school_id into new.school_id from public.elections where id = new.election_id;
  elsif tg_table_name = 'counselor_messages' then
    select school_id into new.school_id from public.counselor_requests where id = new.request_id;
  end if;
  return new;
end;
$$;

create trigger set_school before insert on public.challenge_submissions for each row execute function public.set_school_from_parent();
create trigger set_school before insert on public.poll_votes for each row execute function public.set_school_from_parent();
create trigger set_school before insert on public.tawjihi_answers for each row execute function public.set_school_from_parent();
create trigger set_school before insert on public.election_votes for each row execute function public.set_school_from_parent();
create trigger set_school before insert on public.counselor_messages for each row execute function public.set_school_from_parent();

-- ---------------------------------------------------------------------------
-- Updated Phase 1 logic for counselors and alumni
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
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

  insert into public.profiles (id, school_id, full_name, grade, role, alumni_year)
  values (new.id, v_school.id, left(v_name, 80), v_roster.grade,
          coalesce(v_roster.role, 'student'), v_roster.alumni_year);

  insert into public.private_profiles (id, email) values (new.id, v_email);
  return new;
end;
$$;

-- Counselors and alumni don't pick a grade on the welcome screen.
create or replace function public.complete_onboarding(
  p_grade int, p_avatar text, p_bio text, p_interests bigint[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  v_grades int[];
  v_no_grade boolean;
begin
  select * into me from public.profiles where id = auth.uid() and deactivated_at is null;
  if me.id is null then
    raise exception 'Not signed in';
  end if;
  v_no_grade := me.role = 'counselor' or me.alumni_year is not null;
  select grades into v_grades from public.schools where id = me.school_id;
  if not v_no_grade and me.grade is null and not (p_grade = any (v_grades)) then
    raise exception 'Please choose your grade.';
  end if;
  if coalesce(array_length(p_interests, 1), 0) > 10 then
    raise exception 'Choose up to 10 interests.';
  end if;

  update public.profiles
  set grade = case when v_no_grade then null else coalesce(me.grade, p_grade) end,
      avatar = p_avatar,
      bio = coalesce(p_bio, ''),
      onboarded_at = coalesce(onboarded_at, now())
  where id = me.id;

  delete from public.profile_interests where profile_id = me.id;
  insert into public.profile_interests (profile_id, interest_id)
  select me.id, unnest(coalesce(p_interests, '{}'));
end;
$$;

-- Private messages: only between current students of the same school
-- (not alumni and not the counselor, who has its own private channel).
create or replace function public.start_direct_conversation(p_other uuid) returns uuid
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
  if not public.is_current_student(auth.uid()) or not public.is_current_student(p_other) then
    raise exception 'Private messages are only between current students.';
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

create or replace function public.admin_update_member(p_user uuid, p_grade int, p_role text) returns void
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
  if p_role not in ('student', 'moderator', 'admin', 'counselor') then
    raise exception 'Unknown role';
  end if;
  if t.id = auth.uid() and p_role <> t.role then
    raise exception 'You cannot change your own role.';
  end if;

  update public.profiles
  set grade = case when p_role = 'counselor' then null else coalesce(p_grade, grade) end,
      role = p_role
  where id = t.id;

  if p_grade is distinct from t.grade and p_grade is not null and p_role <> 'counselor' then
    perform public.log_action(t.school_id, 'change_grade', 'profile', t.id,
      t.full_name || ': grade ' || coalesce(t.grade::text, '-') || ' → ' || p_grade);
  end if;
  if p_role <> t.role then
    perform public.log_action(t.school_id, 'change_role', 'profile', t.id,
      t.full_name || ': ' || t.role || ' → ' || p_role);
  end if;
end;
$$;

-- Marks an account as an alumni mentor (graduation year) or back to a student.
create function public.admin_set_alumni(p_user uuid, p_year int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change accounts.';
  end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school_id();
  if t.id is null then
    raise exception 'Student not found.';
  end if;
  if t.id = auth.uid() then
    raise exception 'You cannot change your own account type.';
  end if;
  update public.profiles
  set alumni_year = p_year,
      grade = case when p_year is not null then null else grade end,
      role = case when p_year is not null and role in ('moderator', 'admin') then 'student' else role end
  where id = t.id;
  perform public.log_action(t.school_id, case when p_year is null then 'unset_alumni' else 'set_alumni' end,
    'profile', t.id, t.full_name || coalesce(' · class of ' || p_year, ''));
end;
$$;

-- Menu badge counts, now including Phase 2 approvals and the counselor inbox.
create or replace function public.my_badges() returns json
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
      + (select count(*) from public.challenge_submissions where school_id = public.my_school_id() and status = 'pending')
      + (select count(*) from public.volunteer_entries where school_id = public.my_school_id() and status = 'pending')
    ) else 0 end,
    'counselor', case when public.is_counselor() then (
      select count(*) from public.counselor_requests
      where school_id = public.my_school_id() and status = 'open'
    ) else 0 end
  )
$$;

-- ---------------------------------------------------------------------------
-- Reports: listings and Tawjihi questions/answers
-- ---------------------------------------------------------------------------

create or replace function public.reports_before_insert() returns trigger
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
  elsif new.target_type = 'listing' then
    select school_id, seller_id,
           title || ': ' || description || case when image_path is not null then ' [photo attached]' else '' end
      into v_school, new.target_author_id, new.snapshot
    from public.listings where id = new.target_id;
  elsif new.target_type = 'question' then
    select school_id, author_id, title || ': ' || body
      into v_school, new.target_author_id, new.snapshot
    from public.tawjihi_questions where id = new.target_id;
  elsif new.target_type = 'answer' then
    select school_id, author_id, body
      into v_school, new.target_author_id, new.snapshot
    from public.tawjihi_answers where id = new.target_id;
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

create or replace function public.reports_after_insert() returns trigger
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
    elsif new.target_type = 'listing' then
      update public.listings set status = 'held' where id = new.target_id and status in ('active', 'reserved');
    elsif new.target_type = 'question' then
      update public.tawjihi_questions set status = 'held' where id = new.target_id and status = 'visible';
    elsif new.target_type = 'answer' then
      update public.tawjihi_answers set status = 'held' where id = new.target_id and status = 'visible';
    end if;
  end if;

  if new.reason = 'self_harm' then
    -- Admins see it in the queue; the counselor (an adult) is told straight away too.
    insert into public.notifications (school_id, recipient_id, kind, title, body, link)
    select new.school_id, p.id, 'urgent_report', '⚠️ Urgent report: a student may need help',
           'Please review this report as soon as possible.', '/moderation'
    from public.profiles p
    where p.school_id = new.school_id and p.role = 'admin' and p.deactivated_at is null;

    insert into public.notifications (school_id, recipient_id, kind, title, body, link)
    select new.school_id, p.id, 'urgent_report', '⚠️ A student may need help',
           'A student reported that someone may need help. Please check with the school admins today.', null
    from public.profiles p
    where p.school_id = new.school_id and p.role = 'counselor' and p.deactivated_at is null;
  end if;
  return new;
end;
$$;

create or replace function public.moderate_report(p_report uuid, p_action text, p_note text) returns void
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
    elsif r.target_type = 'listing' then
      update public.listings set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'question' then
      update public.tawjihi_questions set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'answer' then
      update public.tawjihi_answers set status = 'removed' where id = r.target_id;
    end if;
    if r.target_type <> 'profile' then
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
    elsif r.target_type = 'listing' then
      update public.listings set status = 'active' where id = r.target_id and status = 'held';
    elsif r.target_type = 'question' then
      update public.tawjihi_questions set status = 'visible' where id = r.target_id and status = 'held';
    elsif r.target_type = 'answer' then
      update public.tawjihi_answers set status = 'visible' where id = r.target_id and status = 'held';
    end if;
  end if;

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

-- ---------------------------------------------------------------------------
-- Points and badges
-- ---------------------------------------------------------------------------

-- Checks every badge rule for a student and awards any new ones.
create function public.award_badges(p_profile uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid;
  v_total int;
  v_clubs int;
  v_rsvps int;
  v_challenges int;
  v_tutoring int;
  v_hours numeric;
  v_votes int;
  v_answers int;
  b record;
begin
  select school_id into v_school from public.profiles where id = p_profile;
  select coalesce(sum(points), 0) into v_total from public.points_ledger where profile_id = p_profile;
  select count(*) into v_clubs from public.club_members where profile_id = p_profile;
  select count(*) into v_rsvps from public.event_rsvps where profile_id = p_profile;
  select count(*) into v_challenges from public.challenge_submissions where profile_id = p_profile and status = 'approved';
  select count(*) into v_tutoring from public.tutoring_requests where tutor_id = p_profile and status = 'completed';
  select coalesce(sum(hours), 0) into v_hours from public.volunteer_entries where profile_id = p_profile and status = 'approved';
  select (select count(*) from public.poll_votes where profile_id = p_profile)
       + (select count(*) from public.election_votes where voter_id = p_profile) into v_votes;
  select count(*) into v_answers from public.tawjihi_answers where author_id = p_profile and status = 'visible';

  for b in
    select code, name, emoji from public.badges
    where (code = 'first_club' and v_clubs >= 1)
       or (code = 'clubs_3' and v_clubs >= 3)
       or (code = 'events_5' and v_rsvps >= 5)
       or (code = 'challenge_1' and v_challenges >= 1)
       or (code = 'challenge_5' and v_challenges >= 5)
       or (code = 'helper' and v_tutoring >= 1)
       or (code = 'volunteer_10' and v_hours >= 10)
       or (code = 'volunteer_50' and v_hours >= 50)
       or (code = 'voter' and v_votes >= 1)
       or (code = 'tawjihi_helper' and v_answers >= 3)
       or (code = 'points_100' and v_total >= 100)
       or (code = 'points_500' and v_total >= 500)
  loop
    insert into public.profile_badges (profile_id, badge_code, school_id)
    values (p_profile, b.code, v_school)
    on conflict do nothing;
    if found then
      perform public.notify(p_profile, 'badge', b.emoji || ' New badge: ' || b.name,
        'Nice! See all your badges and points.', '/points');
    end if;
  end loop;
end;
$$;

-- Gives points once per action. Alumni and the counselor don't collect points.
create function public.award_points(
  p_profile uuid, p_points int, p_reason text, p_source uuid, p_at timestamptz default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid;
  v_rows int;
begin
  if p_points is null or p_points <= 0 or not public.is_current_student(p_profile) then
    return;
  end if;
  select school_id into v_school from public.profiles where id = p_profile;
  insert into public.points_ledger (school_id, profile_id, points, reason, source_id, created_at)
  values (v_school, p_profile, p_points, p_reason, p_source, coalesce(p_at, now()))
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    perform public.award_badges(p_profile);
  end if;
end;
$$;

-- How many times today a student already got points for something
-- (so posting 50 times doesn't farm points).
create function public.points_today(p_profile uuid, p_reason text) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.points_ledger
  where profile_id = p_profile and reason = p_reason and created_at > now() - interval '1 day'
$$;

create function public.points_on_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'club_members' then
    perform public.award_points(new.profile_id, 5, 'club_join', new.club_id, new.joined_at);
  elsif tg_table_name = 'posts' then
    if new.status = 'visible' and public.points_today(new.author_id, 'post') < 5 then
      perform public.award_points(new.author_id, 2, 'post', new.id, new.created_at);
    end if;
  elsif tg_table_name = 'event_rsvps' then
    perform public.award_points(new.profile_id, 3, 'rsvp', new.event_id, new.created_at);
  elsif tg_table_name = 'poll_votes' then
    perform public.award_points(new.profile_id, 1, 'poll_vote', new.poll_id, new.created_at);
  elsif tg_table_name = 'election_votes' then
    perform public.award_points(new.voter_id, 3, 'election_vote', new.election_id, new.created_at);
  elsif tg_table_name = 'tawjihi_answers' then
    if new.status = 'visible' and public.points_today(new.author_id, 'tawjihi_answer') < 5 then
      perform public.award_points(new.author_id, 3, 'tawjihi_answer', new.id, new.created_at);
    end if;
  elsif tg_table_name = 'suggestions' then
    if public.points_today(new.author_id, 'suggestion') < 2 then
      perform public.award_points(new.author_id, 2, 'suggestion', new.id, new.created_at);
    end if;
  end if;
  return new;
end;
$$;

create trigger points after insert on public.club_members for each row execute function public.points_on_activity();
create trigger points after insert on public.posts for each row execute function public.points_on_activity();
create trigger points after insert on public.event_rsvps for each row execute function public.points_on_activity();
create trigger points after insert on public.poll_votes for each row execute function public.points_on_activity();
create trigger points after insert on public.election_votes for each row execute function public.points_on_activity();
create trigger points after insert on public.tawjihi_answers for each row execute function public.points_on_activity();
create trigger points after insert on public.suggestions for each row execute function public.points_on_activity();

-- Class vs class: grades ranked by average points per student (fair for
-- grades of different sizes). Individual students are never ranked.
create function public.grade_leaderboard(p_period text)
returns table (grade int, students bigint, points bigint, avg_points numeric)
language sql stable security definer set search_path = '' as $$
  with s as (
    select p.id, p.grade from public.profiles p
    where p.school_id = public.my_school_id() and public.is_reader()
      and p.onboarded_at is not null and p.deactivated_at is null
      and p.grade is not null and p.role <> 'counselor' and p.alumni_year is null
  ),
  pts as (
    select l.profile_id, sum(l.points) as points from public.points_ledger l
    where l.school_id = public.my_school_id()
      and (p_period = 'all' or l.created_at >= public.week_start())
    group by l.profile_id
  )
  select s.grade, count(*), coalesce(sum(pts.points), 0)::bigint,
         round(coalesce(sum(pts.points), 0)::numeric / count(*), 1)
  from s left join pts on pts.profile_id = s.id
  group by s.grade
  order by 4 desc, 1
$$;

-- ---------------------------------------------------------------------------
-- Content filter for Phase 2 text
-- ---------------------------------------------------------------------------

-- Listings and Tawjihi posts are held for review (like club posts).
create function public.hold_if_blocked() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_text text;
begin
  if tg_table_name = 'listings' then
    v_text := new.title || ' ' || new.description;
    if tg_op = 'INSERT' then
      new.status := case when public.contains_blocked_word(new.school_id, v_text) then 'held' else 'active' end;
      if auth.uid() is not null then
        new.seller_id := auth.uid();
        new.created_at := now();
      end if;
    elsif public.contains_blocked_word(new.school_id, v_text) then
      raise exception 'BLOCKED_WORD: Please remove inappropriate words and try again.';
    end if;
    if new.kind <> 'sell' then
      new.price := null;
    end if;
  elsif tg_table_name = 'tawjihi_questions' then
    new.status := case when public.contains_blocked_word(new.school_id, new.title || ' ' || new.body) then 'held' else 'visible' end;
    if auth.uid() is not null then new.created_at := now(); end if;
  elsif tg_table_name = 'tawjihi_answers' then
    new.status := case when public.contains_blocked_word(new.school_id, new.body) then 'held' else 'visible' end;
    if auth.uid() is not null then new.created_at := now(); end if;
  end if;
  return new;
end;
$$;

-- set_school (alphabetically earlier) runs first, so school_id is known here.
create trigger tfilter before insert or update of title, description, kind, price on public.listings
  for each row execute function public.hold_if_blocked();
create trigger tfilter before insert on public.tawjihi_questions for each row execute function public.hold_if_blocked();
create trigger tfilter before insert on public.tawjihi_answers for each row execute function public.hold_if_blocked();

create function public.report_if_held() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'held' then
    if tg_table_name = 'listings' then
      insert into public.reports (school_id, target_type, target_id, target_author_id, reason, snapshot)
      values (new.school_id, 'listing', new.id, new.seller_id, 'filter', new.title || ': ' || new.description);
    elsif tg_table_name = 'tawjihi_questions' then
      insert into public.reports (school_id, target_type, target_id, target_author_id, reason, snapshot)
      values (new.school_id, 'question', new.id, new.author_id, 'filter', new.title || ': ' || new.body);
    elsif tg_table_name = 'tawjihi_answers' then
      insert into public.reports (school_id, target_type, target_id, target_author_id, reason, snapshot)
      values (new.school_id, 'answer', new.id, new.author_id, 'filter', new.body);
    end if;
  end if;
  return new;
end;
$$;

create trigger report_held after insert on public.listings for each row execute function public.report_if_held();
create trigger report_held after insert on public.tawjihi_questions for each row execute function public.report_if_held();
create trigger report_held after insert on public.tawjihi_answers for each row execute function public.report_if_held();

-- Everything else with bad words is simply refused.
create function public.refuse_if_blocked() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'challenge_submissions' then
    perform public.reject_blocked(new.school_id, new.note);
  elsif tg_table_name = 'volunteer_entries' then
    perform public.reject_blocked(new.school_id, new.organization || ' ' || new.description || ' ' || new.supervisor_name);
  elsif tg_table_name = 'tutor_profiles' then
    perform public.reject_blocked(new.school_id, new.about || ' ' || new.availability);
  elsif tg_table_name = 'study_buddy_posts' then
    perform public.reject_blocked(new.school_id, new.note);
  elsif tg_table_name = 'suggestions' then
    perform public.reject_blocked(new.school_id, new.title || ' ' || new.body);
  elsif tg_table_name = 'election_candidates' then
    perform public.reject_blocked((select school_id from public.elections where id = new.election_id), new.statement);
  elsif tg_table_name = 'profiles' then
    perform public.reject_blocked(new.school_id, new.university || ' ' || new.major);
  end if;
  return new;
end;
$$;

create trigger tfilter before insert or update on public.challenge_submissions for each row execute function public.refuse_if_blocked();
create trigger tfilter before insert or update on public.volunteer_entries for each row execute function public.refuse_if_blocked();
create trigger tfilter before insert or update on public.tutor_profiles for each row execute function public.refuse_if_blocked();
create trigger tfilter before insert or update on public.study_buddy_posts for each row execute function public.refuse_if_blocked();
create trigger tfilter before insert or update on public.suggestions for each row execute function public.refuse_if_blocked();
create trigger tfilter before insert or update on public.election_candidates for each row execute function public.refuse_if_blocked();
create trigger tfilter_mentor before update of university, major on public.profiles for each row execute function public.refuse_if_blocked();

-- Students can only submit their own entries as "pending".
create function public.force_pending() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_note := null;
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger force_pending before insert on public.challenge_submissions for each row execute function public.force_pending();
create trigger force_pending before insert on public.volunteer_entries for each row execute function public.force_pending();

-- ---------------------------------------------------------------------------
-- Weekly challenges
-- ---------------------------------------------------------------------------

create function public.challenge_completions(p_challenge uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.challenge_submissions s
  join public.challenges c on c.id = s.challenge_id
  where s.challenge_id = p_challenge and s.status = 'approved' and c.school_id = public.my_school_id()
$$;

create function public.review_challenge_submission(p_submission uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.challenge_submissions;
  c public.challenges;
begin
  if not public.is_staff() then
    raise exception 'Only moderators can review challenges.';
  end if;
  select * into s from public.challenge_submissions
  where id = p_submission and school_id = public.my_school_id() and status = 'pending';
  if s.id is null then
    raise exception 'Submission not found or already reviewed.';
  end if;
  if s.profile_id = auth.uid() then
    raise exception 'You cannot review your own submission.';
  end if;
  select * into c from public.challenges where id = s.challenge_id;

  update public.challenge_submissions
  set status = case when p_approve then 'approved' else 'rejected' end,
      review_note = nullif(btrim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = s.id;

  if p_approve then
    perform public.award_points(s.profile_id, c.points, 'challenge', c.id);
    perform public.notify(s.profile_id, 'challenge_approved', c.emoji || ' Challenge complete: ' || c.title,
      '+' || c.points || ' points for your grade!', '/challenges');
  else
    perform public.notify(s.profile_id, 'challenge_rejected', 'Your challenge entry wasn''t accepted',
      coalesce(nullif(btrim(p_note), ''), 'You can talk to a moderator to find out why.'), '/challenges');
  end if;
  perform public.log_action(s.school_id, case when p_approve then 'approve_challenge' else 'reject_challenge' end,
    'challenge', c.id, c.title);
end;
$$;

-- ---------------------------------------------------------------------------
-- Volunteering
-- ---------------------------------------------------------------------------

create function public.review_volunteer(p_entry uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.volunteer_entries;
begin
  if not public.is_staff() then
    raise exception 'Only moderators can check volunteering hours.';
  end if;
  select * into v from public.volunteer_entries
  where id = p_entry and school_id = public.my_school_id() and status = 'pending';
  if v.id is null then
    raise exception 'Entry not found or already checked.';
  end if;
  if v.profile_id = auth.uid() then
    raise exception 'You cannot approve your own hours.';
  end if;

  update public.volunteer_entries
  set status = case when p_approve then 'approved' else 'rejected' end,
      review_note = nullif(btrim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = v.id;

  if p_approve then
    perform public.award_points(v.profile_id, greatest(1, round(v.hours * 10)::int), 'volunteer', v.id);
    perform public.notify(v.profile_id, 'volunteer_approved', '💚 ' || v.hours || ' volunteering hours approved',
      v.organization, '/volunteering');
  else
    perform public.notify(v.profile_id, 'volunteer_rejected', 'Volunteering hours not approved',
      v.organization || coalesce(' — ' || nullif(btrim(p_note), ''), ''), '/volunteering');
  end if;
  perform public.log_action(v.school_id, case when p_approve then 'approve_hours' else 'reject_hours' end,
    'volunteer', v.id, v.hours || 'h · ' || v.organization);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tutoring
-- ---------------------------------------------------------------------------

create function public.request_tutoring(p_tutor uuid, p_subject text, p_message text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_id uuid;
begin
  if not public.is_active() or not public.is_current_student(auth.uid()) then
    raise exception 'Your account cannot ask for tutoring right now.';
  end if;
  if p_tutor = auth.uid() then
    raise exception 'You cannot ask yourself for help.';
  end if;
  if not exists (
    select 1 from public.tutor_profiles t join public.profiles p on p.id = t.profile_id
    where t.profile_id = p_tutor and t.active and t.school_id = v_school and p.deactivated_at is null
  ) then
    raise exception 'This tutor is not available.';
  end if;
  if public.is_blocked_between(auth.uid(), p_tutor) then
    raise exception 'You cannot contact this student.';
  end if;
  if exists (
    select 1 from public.tutoring_requests
    where learner_id = auth.uid() and tutor_id = p_tutor and status in ('pending', 'accepted')
  ) then
    raise exception 'You already have an open request with this tutor.';
  end if;
  perform public.reject_blocked(v_school, p_message);

  insert into public.tutoring_requests (school_id, learner_id, tutor_id, subject, message)
  values (v_school, auth.uid(), p_tutor, left(btrim(p_subject), 40), left(coalesce(btrim(p_message), ''), 500))
  returning id into v_id;

  perform public.notify(p_tutor, 'tutoring_request', '📚 New tutoring request: ' || left(btrim(p_subject), 40),
    (select full_name from public.profiles where id = auth.uid()) || ' would like your help.', '/tutors?tab=requests');
  return v_id;
end;
$$;

-- The tutor accepts (this opens a private chat to plan when to meet at school) or declines.
create function public.respond_tutoring(p_request uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r public.tutoring_requests;
  v_conversation uuid;
begin
  select * into r from public.tutoring_requests
  where id = p_request and tutor_id = auth.uid() and status = 'pending';
  if r.id is null then
    raise exception 'Request not found.';
  end if;
  update public.tutoring_requests
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = r.id;

  if p_accept then
    v_conversation := public.start_direct_conversation(r.learner_id);
    perform public.notify(r.learner_id, 'tutoring_accepted', '✅ Tutoring accepted: ' || r.subject,
      'Plan a time to meet at school.', '/messages/' || v_conversation);
  else
    perform public.notify(r.learner_id, 'tutoring_declined', 'Tutoring request declined: ' || r.subject,
      'Try another tutor — there are more on the Tutors page.', '/tutors');
  end if;
  return v_conversation;
end;
$$;

-- The learner says how it went: completed (the tutor gets points) or cancelled.
create function public.finish_tutoring(p_request uuid, p_completed boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.tutoring_requests;
begin
  select * into r from public.tutoring_requests
  where id = p_request and learner_id = auth.uid()
    and status in (case when p_completed then 'accepted' else 'pending' end, 'accepted');
  if r.id is null then
    raise exception 'Request not found.';
  end if;
  update public.tutoring_requests
  set status = case when p_completed then 'completed' else 'cancelled' end,
      completed_at = case when p_completed then now() end
  where id = r.id;

  if p_completed then
    perform public.award_points(r.tutor_id, 15, 'tutoring', r.id);
    perform public.notify(r.tutor_id, 'tutoring_done', '🤝 Thanks for tutoring ' || r.subject || '!',
      '+15 points for helping a classmate.', '/points');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Polls and elections
-- ---------------------------------------------------------------------------

-- Totals only. Shown once you voted, when the poll is closed, or to moderators.
create function public.poll_results(p_poll uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.polls;
  v_mine int;
  v_counts int[];
  v_total int;
begin
  select * into p from public.polls where id = p_poll and school_id = public.my_school_id();
  if p.id is null or not public.is_reader() then
    return null;
  end if;
  if p.club_id is not null and not public.is_club_member(p.club_id) and not public.is_staff() then
    return null;
  end if;
  select option_index into v_mine from public.poll_votes where poll_id = p.id and profile_id = auth.uid();
  select count(*) into v_total from public.poll_votes where poll_id = p.id;
  if v_mine is null and p.closes_at > now() and not public.is_staff() and p.created_by is distinct from auth.uid() then
    return json_build_object('show', false, 'total', v_total, 'mine', null);
  end if;
  select array_agg(coalesce(c.n, 0) order by i.idx) into v_counts
  from generate_series(0, array_length(p.options, 1) - 1) as i(idx)
  left join (
    select option_index, count(*)::int as n from public.poll_votes where poll_id = p.id group by option_index
  ) c on c.option_index = i.idx;
  return json_build_object('show', true, 'total', v_total, 'mine', v_mine, 'counts', v_counts);
end;
$$;

-- Turnout while voting is open; results only after it closes.
create function public.election_summary(p_election uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.elections;
  v_turnout int;
  v_voted boolean;
  v_results json;
begin
  select * into e from public.elections where id = p_election and school_id = public.my_school_id();
  if e.id is null or not public.is_reader() then
    return null;
  end if;
  select count(*) into v_turnout from public.election_votes where election_id = e.id;
  select exists (select 1 from public.election_votes where election_id = e.id and voter_id = auth.uid()) into v_voted;
  if e.closes_at <= now() then
    select json_agg(json_build_object('candidate_id', c.id, 'votes', coalesce(v.n, 0)) order by coalesce(v.n, 0) desc)
      into v_results
    from public.election_candidates c
    left join (
      select candidate_id, count(*)::int as n from public.election_votes where election_id = e.id group by candidate_id
    ) v on v.candidate_id = c.id
    where c.election_id = e.id;
  end if;
  return json_build_object('turnout', v_turnout, 'voted', v_voted, 'results', v_results);
end;
$$;

-- ---------------------------------------------------------------------------
-- Suggestion box
-- ---------------------------------------------------------------------------

create function public.respond_suggestion(p_suggestion uuid, p_status text, p_response text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.suggestions;
begin
  if not (public.is_admin() or public.is_council_member()) then
    raise exception 'Only admins and the student council can answer suggestions.';
  end if;
  if p_status not in ('reviewing', 'planned', 'done', 'declined') then
    raise exception 'Unknown status';
  end if;
  select * into s from public.suggestions where id = p_suggestion and school_id = public.my_school_id();
  if s.id is null then
    raise exception 'Suggestion not found.';
  end if;
  update public.suggestions
  set status = p_status, response = nullif(btrim(p_response), ''), responded_by = auth.uid(), responded_at = now()
  where id = s.id;
  perform public.notify(s.author_id, 'suggestion_update', '💡 Update on your suggestion: ' || s.title,
    case p_status when 'reviewing' then 'It''s being looked at.' when 'planned' then 'It''s planned!'
      when 'done' then 'It''s done!' else 'It won''t go ahead this time.' end
    || coalesce(' ' || nullif(btrim(p_response), ''), ''), '/suggestions');
end;
$$;

-- ---------------------------------------------------------------------------
-- Counselor
-- ---------------------------------------------------------------------------

-- Creates a private request and its first message in one go.
create function public.start_counselor_request(p_topic text, p_urgent boolean, p_message text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_id uuid;
begin
  -- Suspended students can still ask for help.
  if not public.is_reader() or not public.is_current_student(auth.uid()) then
    raise exception 'Not allowed';
  end if;
  if not public.school_has_counselor() then
    raise exception 'Your school has not added a counselor yet. Please talk to a teacher you trust.';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) = 0 then
    raise exception 'Please write a short message.';
  end if;

  insert into public.counselor_requests (school_id, student_id, topic, urgent)
  values (v_school, auth.uid(), p_topic, coalesce(p_urgent, false))
  returning id into v_id;
  insert into public.counselor_messages (request_id, school_id, sender_id, body)
  values (v_id, v_school, auth.uid(), left(btrim(p_message), 2000));

  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select v_school, p.id, 'counselor_request',
         case when p_urgent then '🔒 Urgent private request' else '🔒 New private request' end,
         'A student would like to talk.', '/counselor/' || v_id
  from public.profiles p
  where p.school_id = v_school and p.role = 'counselor' and p.deactivated_at is null;
  return v_id;
end;
$$;

-- Every new message tells the other side, without saying what it is about
-- (notifications can show on a phone's lock screen).
create function public.counselor_message_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r public.counselor_requests;
begin
  select * into r from public.counselor_requests where id = new.request_id;
  update public.counselor_requests
  set last_message_at = new.created_at,
      status = case when new.sender_id <> r.student_id and status = 'open' then 'in_progress' else status end
  where id = r.id;

  if new.sender_id = r.student_id then
    -- The first message is announced by start_counselor_request.
    if exists (select 1 from public.counselor_messages where request_id = r.id and id <> new.id) then
      insert into public.notifications (school_id, recipient_id, kind, title, body, link)
      select r.school_id, p.id, 'counselor_message', '🔒 New private message', 'A student replied.', '/counselor/' || r.id
      from public.profiles p
      where p.school_id = r.school_id and p.role = 'counselor' and p.deactivated_at is null;
    end if;
  else
    perform public.notify(r.student_id, 'counselor_reply', '📬 You have a new private reply', null, '/counselor/' || r.id);
  end if;
  return new;
end;
$$;

create trigger counselor_message_after_insert after insert on public.counselor_messages
  for each row execute function public.counselor_message_after_insert();

create function public.set_counselor_status(p_request uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_counselor() then
    raise exception 'Only the counselor can do that.';
  end if;
  if p_status not in ('open', 'in_progress', 'closed') then
    raise exception 'Unknown status';
  end if;
  update public.counselor_requests set status = p_status
  where id = p_request and school_id = public.my_school_id();
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin stats: add the Phase 2 numbers
-- ---------------------------------------------------------------------------
create function public.school_stats_phase2() returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
begin
  if not public.is_admin() then
    raise exception 'Only admins can see school stats.';
  end if;
  return json_build_object(
    'volunteer_hours', (select coalesce(sum(hours), 0) from public.volunteer_entries where school_id = v_school and status = 'approved'),
    'volunteers', (select count(distinct profile_id) from public.volunteer_entries where school_id = v_school and status = 'approved'),
    'tutors', (select count(*) from public.tutor_profiles where school_id = v_school and active),
    'tutoring_done', (select count(*) from public.tutoring_requests where school_id = v_school and status = 'completed'),
    'listings_active', (select count(*) from public.listings where school_id = v_school and status = 'active'),
    'challenge_entries_week', (select count(*) from public.challenge_submissions
      where school_id = v_school and created_at >= public.week_start()),
    'suggestions_new', (select count(*) from public.suggestions where school_id = v_school and status = 'new'),
    'tawjihi_questions', (select count(*) from public.tawjihi_questions where school_id = v_school and status = 'visible')
  );
end;
$$;

-- The Phase 1 stats again, now leaving out the counselor and alumni mentors
-- (they are not current students).
create or replace function public.school_stats() returns json
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
      and p.role <> 'counselor' and p.alumni_year is null
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
