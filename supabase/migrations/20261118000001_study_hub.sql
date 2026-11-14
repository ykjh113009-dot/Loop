-- Study Hub: tutor applications (review-based), academic resources, university and opportunities,
-- reward images and the Top 10 prizes. Same rules as before: tables are read-only for signed-in users,
-- every change is a function that checks who is calling.

-- ---------------------------------------------------------------------------
-- A. Tutors: only approved students are listed
-- ---------------------------------------------------------------------------
create function public.can_review_tutors() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_leadership('council_member')
$$;

alter table public.tutor_profiles
  add column qualifications text not null default '' check (char_length(qualifications) <= 600),
  add column experience text not null default '' check (char_length(experience) <= 600),
  add column format text not null default 'both' check (format in ('online', 'in_person', 'both')),
  add column days text[] not null default '{}' check (days <@ array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']),
  add column hours text not null default '' check (char_length(hours) <= 100),
  add column preferred_times text not null default '' check (char_length(preferred_times) <= 100),
  add column photo_path text,
  add column application_id uuid,
  add column approved_at timestamptz;
-- Tutors who were already listed before approvals existed stay listed.
update public.tutor_profiles set approved_at = created_at;
alter table public.tutor_profiles drop constraint tutor_profiles_subjects_check;
alter table public.tutor_profiles add constraint tutor_profiles_subjects_check check (array_length(subjects, 1) between 1 and 12);

drop policy "see tutors" on public.tutor_profiles;
drop policy "become a tutor" on public.tutor_profiles;
drop policy "edit own tutor profile" on public.tutor_profiles;
drop policy "remove own tutor profile" on public.tutor_profiles;
create policy "see approved tutors" on public.tutor_profiles for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader()
         and (approved_at is not null or profile_id = (select auth.uid())));
revoke insert, update, delete on public.tutor_profiles from authenticated;

create table public.tutor_applications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  grade text not null default '' check (char_length(grade) <= 40),
  subjects text[] not null default '{}' check (cardinality(subjects) <= 12),
  other_subjects text not null default '' check (char_length(other_subjects) <= 200),
  achievements text not null default '' check (char_length(achievements) <= 1000),
  experience text not null default '' check (char_length(experience) <= 600),
  qualifications text not null default '' check (char_length(qualifications) <= 600),
  intro text not null default '' check (char_length(intro) <= 300),
  motivation text not null default '' check (char_length(motivation) <= 600),
  topics text not null default '' check (char_length(topics) <= 600),
  format text not null default 'both' check (format in ('online', 'in_person', 'both')),
  days text[] not null default '{}' check (days <@ array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']),
  hours text not null default '' check (char_length(hours) <= 100),
  preferred_times text not null default '' check (char_length(preferred_times) <= 100),
  availability_notes text not null default '' check (char_length(availability_notes) <= 300),
  photo_path text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tutor_applications (school_id, status, submitted_at);
alter table public.tutor_applications enable row level security;
create policy "see own or reviewed applications" on public.tutor_applications for select to authenticated
  using (profile_id = (select auth.uid()) or (school_id = public.my_school_id() and public.can_review_tutors()));
revoke insert, update, delete on public.tutor_applications from authenticated;
alter table public.tutor_profiles add constraint tutor_profiles_application_fk foreign key (application_id)
  references public.tutor_applications (id) on delete set null;

create table public.tutor_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.tutor_applications (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  path text not null,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('cv', 'certificate', 'academic', 'other')),
  size int not null check (size between 1 and 8388608),
  created_at timestamptz not null default now()
);
create index on public.tutor_application_documents (application_id);
alter table public.tutor_application_documents enable row level security;
create policy "see own or reviewed documents" on public.tutor_application_documents for select to authenticated
  using (profile_id = (select auth.uid()) or (school_id = public.my_school_id() and public.can_review_tutors()));
revoke insert, update, delete on public.tutor_application_documents from authenticated;

-- Every status change is written here and can never be edited or deleted.
create table public.tutor_application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.tutor_applications (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('save', 'submit', 'resubmit', 'withdraw', 'approve', 'reject')),
  from_status text,
  to_status text,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index on public.tutor_application_events (application_id, created_at);
alter table public.tutor_application_events enable row level security;
create policy "see own or reviewed history" on public.tutor_application_events for select to authenticated
  using (exists (select 1 from public.tutor_applications a
                 where a.id = tutor_application_events.application_id
                   and (a.profile_id = (select auth.uid()) or (a.school_id = public.my_school_id() and public.can_review_tutors()))));
revoke insert, update, delete on public.tutor_application_events from authenticated;

-- Private bucket for application documents: "<school id>/<student id>/<file>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tutor-docs', 'tutor-docs', false, 8388608, array['application/pdf', 'image/jpeg', 'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;
create function public.tutor_doc_uploader(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
    and split_part(p_name, '/', 1) = public.my_school_id()::text
    and split_part(p_name, '/', 2) = (select auth.uid())::text
$$;
create function public.tutor_doc_viewer(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' and (
    split_part(p_name, '/', 2) = (select auth.uid())::text
    or (split_part(p_name, '/', 1) = public.my_school_id()::text and public.can_review_tutors()))
$$;
create policy "upload tutor documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'tutor-docs' and public.is_active() and public.is_current_student(auth.uid()) and public.tutor_doc_uploader(name));
create policy "see tutor documents" on storage.objects for select to authenticated
  using (bucket_id = 'tutor-docs' and public.is_reader() and public.tutor_doc_viewer(name));
create policy "delete own tutor documents" on storage.objects for delete to authenticated
  using (bucket_id = 'tutor-docs' and split_part(name, '/', 2) = (select auth.uid())::text);

-- Turns "ap chemistry, Latin" style text into a clean list of extra subjects.
create function public.split_subjects(p text) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct left(btrim(x), 30)) filter (where btrim(x) <> ''), '{}')
  from unnest(regexp_split_to_array(coalesce(p, ''), '[,\n;]')) as x
$$;

create function public.save_tutor_application(p jsonb, p_submit boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_school uuid := public.my_school_id();
  a public.tutor_applications;
  v_prev text;
  v_grade text := left(btrim(coalesce(p ->> 'grade', '')), 40);
  v_subjects text[];
  v_other text := left(btrim(coalesce(p ->> 'other_subjects', '')), 200);
  v_ach text := left(btrim(coalesce(p ->> 'achievements', '')), 1000);
  v_exp text := left(btrim(coalesce(p ->> 'experience', '')), 600);
  v_qual text := left(btrim(coalesce(p ->> 'qualifications', '')), 600);
  v_intro text := left(btrim(coalesce(p ->> 'intro', '')), 300);
  v_why text := left(btrim(coalesce(p ->> 'motivation', '')), 600);
  v_topics text := left(btrim(coalesce(p ->> 'topics', '')), 600);
  v_format text := coalesce(nullif(p ->> 'format', ''), 'both');
  v_days text[];
  v_hours text := left(btrim(coalesce(p ->> 'hours', '')), 100);
  v_pref text := left(btrim(coalesce(p ->> 'preferred_times', '')), 100);
  v_notes text := left(btrim(coalesce(p ->> 'availability_notes', '')), 300);
  v_photo text := nullif(btrim(coalesce(p ->> 'photo_path', '')), '');
begin
  if not public.is_active() or not public.is_current_student(me) then
    raise exception 'Only current students can apply to be a tutor.';
  end if;
  select coalesce(array_agg(distinct left(btrim(x), 40)), '{}') into v_subjects
  from jsonb_array_elements_text(coalesce(p -> 'subjects', '[]')) x where btrim(x) <> '';
  select coalesce(array_agg(distinct x), '{}') into v_days from jsonb_array_elements_text(coalesce(p -> 'days', '[]')) x;
  if v_format not in ('online', 'in_person', 'both') then
    raise exception 'Choose online, in person or both.';
  end if;
  if not v_days <@ array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] then
    raise exception 'Unknown day.';
  end if;
  if cardinality(v_subjects) + cardinality(public.split_subjects(v_other)) > 12 then
    raise exception 'Choose at most 12 subjects.';
  end if;
  if v_photo is not null and v_photo not like v_school::text || '/' || me::text || '/%' then
    raise exception 'That photo is not yours.';
  end if;
  perform public.reject_blocked(v_school, v_grade || ' ' || v_other || ' ' || v_ach || ' ' || v_exp || ' ' || v_qual || ' ' ||
    v_intro || ' ' || v_why || ' ' || v_topics || ' ' || v_hours || ' ' || v_pref || ' ' || v_notes);

  select * into a from public.tutor_applications where profile_id = me for update;
  if a.id is not null then
    if a.status = 'pending' then
      raise exception 'Your application is waiting for review. Take it back first if you want to change it.';
    elsif a.status = 'approved' then
      raise exception 'You are already an approved tutor. You can edit your tutor profile.';
    end if;
  end if;

  if p_submit then
    if v_grade = '' then raise exception 'Say which grade you are in.'; end if;
    if cardinality(v_subjects) + cardinality(public.split_subjects(v_other)) < 1 then raise exception 'Choose at least one subject.'; end if;
    if char_length(v_intro) < 20 then raise exception 'Write a short introduction (at least 20 letters).'; end if;
    if char_length(v_why) < 20 then raise exception 'Tell us why you want to be a tutor (at least 20 letters).'; end if;
    if cardinality(v_days) < 1 or v_hours = '' then raise exception 'Choose the days and hours you are free.'; end if;
    perform public.check_rate('tutor_apply', 5, 86400);
  end if;

  if a.id is null then
    insert into public.tutor_applications (school_id, profile_id, grade, subjects, other_subjects, achievements, experience, qualifications,
      intro, motivation, topics, format, days, hours, preferred_times, availability_notes, photo_path)
    values (v_school, me, v_grade, v_subjects, v_other, v_ach, v_exp, v_qual, v_intro, v_why, v_topics, v_format, v_days, v_hours, v_pref, v_notes, v_photo)
    returning * into a;
    v_prev := null;
  else
    v_prev := a.status;
    update public.tutor_applications set grade = v_grade, subjects = v_subjects, other_subjects = v_other, achievements = v_ach,
      experience = v_exp, qualifications = v_qual, intro = v_intro, motivation = v_why, topics = v_topics, format = v_format, days = v_days,
      hours = v_hours, preferred_times = v_pref, availability_notes = v_notes, photo_path = v_photo, status = 'draft', updated_at = now()
    where id = a.id returning * into a;
  end if;

  if p_submit then
    update public.tutor_applications set status = 'pending', submitted_at = now(), updated_at = now() where id = a.id;
    insert into public.tutor_application_events (application_id, school_id, actor_id, action, from_status, to_status)
    values (a.id, v_school, me, case when v_prev = 'rejected' then 'resubmit' else 'submit' end, coalesce(v_prev, 'draft'), 'pending');
    insert into public.notifications (school_id, recipient_id, kind, title, body, link)
    select v_school, pr.id, 'tutor_application', 'A tutor application is waiting', (select full_name from public.profiles where id = me), '/tutors/review'
    from public.profiles pr
    where pr.school_id = v_school and pr.deactivated_at is null and pr.id <> me
      and (pr.role in ('admin', 'super_admin') or exists (
        select 1 from public.leadership_roles l where l.profile_id = pr.id and l.kind = 'council_member'));
  elsif v_prev is distinct from 'draft' then
    insert into public.tutor_application_events (application_id, school_id, actor_id, action, from_status, to_status)
    values (a.id, v_school, me, 'save', v_prev, 'draft');
  end if;
  return a.id;
end;
$$;

create function public.withdraw_tutor_application() returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.tutor_applications;
begin
  select * into a from public.tutor_applications where profile_id = auth.uid() and status = 'pending' for update;
  if a.id is null then
    raise exception 'You have no application waiting for review.';
  end if;
  update public.tutor_applications set status = 'draft', updated_at = now() where id = a.id;
  insert into public.tutor_application_events (application_id, school_id, actor_id, action, from_status, to_status)
  values (a.id, a.school_id, auth.uid(), 'withdraw', 'pending', 'draft');
end;
$$;

create function public.add_tutor_document(p_path text, p_name text, p_kind text, p_size int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  a public.tutor_applications;
  v_id uuid;
begin
  if not public.is_current_student(me) or not public.is_active() then
    raise exception 'Only current students can do that.';
  end if;
  if p_path is null or p_path not like public.my_school_id()::text || '/' || me::text || '/%' then
    raise exception 'That file is not yours.';
  end if;
  if p_kind not in ('cv', 'certificate', 'academic', 'other') then
    raise exception 'Choose what kind of document it is.';
  end if;
  if p_size is null or p_size < 1 or p_size > 8388608 then
    raise exception 'Files can be up to 8 MB.';
  end if;
  select * into a from public.tutor_applications where profile_id = me;
  if a.id is null then
    -- Documents belong to the application, so start a draft.
    insert into public.tutor_applications (school_id, profile_id) values (public.my_school_id(), me) returning * into a;
  elsif a.status not in ('draft', 'rejected') then
    raise exception 'You cannot change documents while your application is under review or approved.';
  end if;
  if (select count(*) from public.tutor_application_documents where application_id = a.id) >= 8 then
    raise exception 'You can add at most 8 documents.';
  end if;
  insert into public.tutor_application_documents (application_id, school_id, profile_id, path, name, kind, size)
  values (a.id, a.school_id, me, p_path, left(btrim(p_name), 120), p_kind, p_size) returning id into v_id;
  return v_id;
end;
$$;

create function public.remove_tutor_document(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.tutor_application_documents;
begin
  select * into d from public.tutor_application_documents where id = p_id and profile_id = auth.uid();
  if d.id is null then
    raise exception 'Document not found.';
  end if;
  if not exists (select 1 from public.tutor_applications where id = d.application_id and status in ('draft', 'rejected')) then
    raise exception 'You cannot change documents while your application is under review or approved.';
  end if;
  delete from public.tutor_application_documents where id = d.id;
end;
$$;

-- Admins and the Student Council decide. Approving publishes only the public profile.
create function public.review_tutor_application(p_app uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.tutor_applications;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  v_subjects text[];
  v_summary text;
begin
  if not public.can_review_tutors() then
    raise exception 'Only admins and the Student Council can review tutor applications.';
  end if;
  select * into a from public.tutor_applications
  where id = p_app and school_id = public.my_school_id() and status = 'pending' for update;
  if a.id is null then
    raise exception 'Application not found or already reviewed.';
  end if;
  if a.profile_id = auth.uid() then
    raise exception 'You cannot review your own application.';
  end if;
  if not p_approve and (v_note is null or char_length(v_note) < 3) then
    raise exception 'Tell the student what to improve.';
  end if;

  update public.tutor_applications
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now(), review_note = v_note, updated_at = now()
  where id = a.id;
  insert into public.tutor_application_events (application_id, school_id, actor_id, action, from_status, to_status, note)
  values (a.id, a.school_id, auth.uid(), case when p_approve then 'approve' else 'reject' end, 'pending',
          case when p_approve then 'approved' else 'rejected' end, coalesce(v_note, ''));

  if p_approve then
    select coalesce(array_agg(distinct s), '{}') into v_subjects
    from unnest(a.subjects || public.split_subjects(a.other_subjects)) s;
    v_summary := left(array_to_string(a.days, ', ') || case when a.hours <> '' then ' · ' || a.hours else '' end, 100);
    insert into public.tutor_profiles (profile_id, school_id, subjects, about, availability, active, qualifications, experience, format,
                                       days, hours, preferred_times, photo_path, application_id, approved_at)
    values (a.profile_id, a.school_id, v_subjects[1:12], a.intro, v_summary, true, a.qualifications, a.experience, a.format,
            a.days, a.hours, a.preferred_times, a.photo_path, a.id, now())
    on conflict (profile_id) do update set subjects = excluded.subjects, about = excluded.about, availability = excluded.availability,
      active = true, qualifications = excluded.qualifications, experience = excluded.experience, format = excluded.format, days = excluded.days,
      hours = excluded.hours, preferred_times = excluded.preferred_times, photo_path = excluded.photo_path,
      application_id = excluded.application_id, approved_at = now();
    perform public.notify(a.profile_id, 'tutor_approved', '🎉 You are now a tutor',
      'Your profile is in the Tutors Directory. You can update it or pause it any time.', '/tutors/me');
  else
    perform public.notify(a.profile_id, 'tutor_rejected', 'Your tutor application needs changes', v_note, '/tutors/apply');
  end if;
  perform public.log_action(a.school_id, case when p_approve then 'approve_tutor' else 'reject_tutor' end, 'profile', a.profile_id, '');
end;
$$;

-- An approved tutor can complete or change the public profile (not the approved subjects).
create function public.update_tutor_profile(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_school uuid := public.my_school_id();
  v_intro text := left(btrim(coalesce(p ->> 'intro', '')), 300);
  v_qual text := left(btrim(coalesce(p ->> 'qualifications', '')), 600);
  v_exp text := left(btrim(coalesce(p ->> 'experience', '')), 600);
  v_format text := coalesce(nullif(p ->> 'format', ''), 'both');
  v_days text[];
  v_hours text := left(btrim(coalesce(p ->> 'hours', '')), 100);
  v_pref text := left(btrim(coalesce(p ->> 'preferred_times', '')), 100);
  v_photo text := nullif(btrim(coalesce(p ->> 'photo_path', '')), '');
  v_active boolean := coalesce((p ->> 'active')::boolean, true);
begin
  if not exists (select 1 from public.tutor_profiles where profile_id = me and approved_at is not null) then
    raise exception 'Only approved tutors have a tutor profile.';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_days from jsonb_array_elements_text(coalesce(p -> 'days', '[]')) x;
  if v_format not in ('online', 'in_person', 'both') or not v_days <@ array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] then
    raise exception 'Please check the format and days.';
  end if;
  if v_photo is not null and v_photo not like v_school::text || '/' || me::text || '/%' then
    raise exception 'That photo is not yours.';
  end if;
  perform public.reject_blocked(v_school, v_intro || ' ' || v_qual || ' ' || v_exp || ' ' || v_hours || ' ' || v_pref);
  update public.tutor_profiles set about = v_intro, qualifications = v_qual, experience = v_exp, format = v_format, days = v_days,
    hours = v_hours, preferred_times = v_pref, photo_path = coalesce(v_photo, photo_path), active = v_active,
    availability = left(array_to_string(v_days, ', ') || case when v_hours <> '' then ' · ' || v_hours else '' end, 100)
  where profile_id = me;
end;
$$;

-- Asking a tutor for help only works with approved tutors.
do $$
declare
  f record;
begin
  for f in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'request_tutoring' loop
    execute replace(pg_get_functiondef(f.oid), 'where t.profile_id = p_tutor and t.active', 'where t.profile_id = p_tutor and t.active and t.approved_at is not null');
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- B. Academic resources
-- ---------------------------------------------------------------------------
create table public.study_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  slug text not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  emoji text not null default '📘' check (char_length(emoji) <= 8),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, slug)
);
alter table public.study_categories enable row level security;
create policy "see study categories" on public.study_categories for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.study_categories from authenticated;

create function public.seed_study_categories() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.study_categories (school_id, slug, name, emoji, sort) values
    (new.id, 'sat', 'SAT', '📝', 1), (new.id, 'ap-chemistry', 'AP Chemistry', '🧪', 2), (new.id, 'ap-biology', 'AP Biology', '🧬', 3),
    (new.id, 'ap-physics', 'AP Physics', '⚛️', 4), (new.id, 'ap-calculus', 'AP Calculus', '📐', 5), (new.id, 'other', 'Other subjects', '📚', 99)
  on conflict do nothing;
  return new;
end;
$$;
create trigger seed_study_categories after insert on public.schools for each row execute function public.seed_study_categories();
insert into public.study_categories (school_id, slug, name, emoji, sort)
select s.id, v.slug, v.name, v.emoji, v.sort from public.schools s,
  (values ('sat', 'SAT', '📝', 1), ('ap-chemistry', 'AP Chemistry', '🧪', 2), ('ap-biology', 'AP Biology', '🧬', 3),
          ('ap-physics', 'AP Physics', '⚛️', 4), ('ap-calculus', 'AP Calculus', '📐', 5), ('other', 'Other subjects', '📚', 99)) as v(slug, name, emoji, sort)
on conflict do nothing;

create table public.study_resources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  category_id uuid not null references public.study_categories (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 500),
  url text not null check (url ~* '^https?://[^\s]+$' and char_length(url) <= 500),
  kind text not null default 'link' check (kind in ('link', 'pdf', 'video', 'notes', 'practice', 'other')),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.study_resources (category_id, created_at desc);
alter table public.study_resources enable row level security;
create policy "see study resources" on public.study_resources for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.study_resources from authenticated;

-- Admins, the Council, school staff and approved tutors can add materials.
create function public.can_add_resources() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_leadership('council_member') or public.has_leadership('school_staff')
    or exists (select 1 from public.tutor_profiles where profile_id = (select auth.uid()) and approved_at is not null and active)
$$;

create function public.add_study_resource(p_category uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_title text := left(btrim(coalesce(p ->> 'title', '')), 100);
  v_desc text := left(btrim(coalesce(p ->> 'description', '')), 500);
  v_url text := left(btrim(coalesce(p ->> 'url', '')), 500);
  v_kind text := coalesce(nullif(p ->> 'kind', ''), 'link');
  v_id uuid;
begin
  if not public.is_active() or not public.can_add_resources() then
    raise exception 'Only admins, the Student Council, school staff and approved tutors can add study materials.';
  end if;
  if not exists (select 1 from public.study_categories where id = p_category and school_id = v_school) then
    raise exception 'Category not found.';
  end if;
  if char_length(v_title) < 3 then raise exception 'Give it a title.'; end if;
  if v_url !~* '^https?://[^\s]+$' then raise exception 'Add a web link that starts with https://'; end if;
  if v_kind not in ('link', 'pdf', 'video', 'notes', 'practice', 'other') then raise exception 'Choose the type.'; end if;
  perform public.reject_blocked(v_school, v_title || ' ' || v_desc);
  perform public.check_rate('resource_add', 20, 86400);
  insert into public.study_resources (school_id, category_id, title, description, url, kind, added_by)
  values (v_school, p_category, v_title, v_desc, v_url, v_kind, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create function public.remove_study_resource(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.study_resources;
begin
  select * into r from public.study_resources where id = p_id and school_id = public.my_school_id();
  if r.id is null or not (r.added_by = auth.uid() or public.is_admin() or public.has_leadership('council_member')
                          or public.has_leadership('school_staff')) then
    raise exception 'You cannot remove this.';
  end if;
  delete from public.study_resources where id = r.id;
end;
$$;

create function public.add_study_category(p_name text, p_emoji text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(btrim(coalesce(p_name, '')), 60);
  v_slug text := regexp_replace(lower(btrim(coalesce(p_name, ''))), '[^a-z0-9]+', '-', 'g');
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can add a subject.';
  end if;
  v_slug := btrim(v_slug, '-');
  if char_length(v_name) < 2 or char_length(v_slug) < 2 then raise exception 'Give the subject a name.'; end if;
  perform public.reject_blocked(public.my_school_id(), v_name);
  insert into public.study_categories (school_id, slug, name, emoji, sort)
  values (public.my_school_id(), left(v_slug, 40), v_name, coalesce(nullif(left(btrim(coalesce(p_emoji, '')), 8), ''), '📘'),
          (select coalesce(max(sort), 0) from public.study_categories where school_id = public.my_school_id() and sort < 99) + 1)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'That subject already exists.';
end;
$$;

-- ---------------------------------------------------------------------------
-- C. University and opportunities
-- ---------------------------------------------------------------------------
create function public.can_manage_study_opportunities() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_leadership('council_member') or public.has_leadership('school_staff')
$$;

create table public.study_opportunities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  category text not null check (category in ('admissions', 'scholarships', 'competitions', 'summer', 'internships', 'exchange',
                                             'volunteering', 'other')),
  title text not null check (char_length(title) between 3 and 120),
  organization text not null default '' check (char_length(organization) <= 120),
  description text not null default '' check (char_length(description) <= 2000),
  eligibility text not null default '' check (char_length(eligibility) <= 1000),
  deadline date,
  link text check (link is null or (link ~* '^https?://[^\s]+$' and char_length(link) <= 500)),
  instructions text not null default '' check (char_length(instructions) <= 1000),
  extra_info text not null default '' check (char_length(extra_info) <= 1000),
  documents jsonb not null default '[]'::jsonb,
  is_sample boolean not null default false,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.study_opportunities (school_id, category, deadline);
alter table public.study_opportunities enable row level security;
create policy "see opportunities" on public.study_opportunities for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader() and (status = 'active' or public.can_manage_study_opportunities()));
revoke insert, update, delete on public.study_opportunities from authenticated;

create function public.save_study_opportunity(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_cat text := coalesce(p ->> 'category', '');
  v_title text := left(btrim(coalesce(p ->> 'title', '')), 120);
  v_org text := left(btrim(coalesce(p ->> 'organization', '')), 120);
  v_desc text := left(btrim(coalesce(p ->> 'description', '')), 2000);
  v_elig text := left(btrim(coalesce(p ->> 'eligibility', '')), 1000);
  v_deadline date := nullif(p ->> 'deadline', '')::date;
  v_link text := nullif(left(btrim(coalesce(p ->> 'link', '')), 500), '');
  v_instr text := left(btrim(coalesce(p ->> 'instructions', '')), 1000);
  v_extra text := left(btrim(coalesce(p ->> 'extra_info', '')), 1000);
  v_sample boolean := coalesce((p ->> 'is_sample')::boolean, false);
  v_status text := coalesce(nullif(p ->> 'status', ''), 'active');
  v_docs jsonb := '[]'::jsonb;
  d jsonb;
  v_id uuid;
begin
  if not public.is_active() or not public.can_manage_study_opportunities() then
    raise exception 'Only admins, the Student Council and school staff can add opportunities.';
  end if;
  if v_cat not in ('admissions', 'scholarships', 'competitions', 'summer', 'internships', 'exchange', 'volunteering', 'other') then
    raise exception 'Choose a category.';
  end if;
  if char_length(v_title) < 3 then raise exception 'Give it a title.'; end if;
  if v_link is not null and v_link !~* '^https?://[^\s]+$' then raise exception 'The link must start with https://'; end if;
  if v_status not in ('active', 'hidden') then raise exception 'Unknown status.'; end if;
  for d in select * from jsonb_array_elements(coalesce(p -> 'documents', '[]')) loop
    if (d ->> 'url') ~* '^https?://[^\s]+$' and char_length(coalesce(d ->> 'label', '')) between 1 and 80 and jsonb_array_length(v_docs) < 5 then
      v_docs := v_docs || jsonb_build_array(jsonb_build_object('label', d ->> 'label', 'url', d ->> 'url'));
    end if;
  end loop;
  perform public.reject_blocked(v_school, v_title || ' ' || v_org || ' ' || v_desc || ' ' || v_elig || ' ' || v_instr || ' ' || v_extra);
  if p_id is null then
    insert into public.study_opportunities (school_id, category, title, organization, description, eligibility, deadline, link, instructions,
                                            extra_info, documents, is_sample, status, created_by)
    values (v_school, v_cat, v_title, v_org, v_desc, v_elig, v_deadline, v_link, v_instr, v_extra, v_docs, v_sample, v_status, auth.uid())
    returning id into v_id;
  else
    update public.study_opportunities set category = v_cat, title = v_title, organization = v_org, description = v_desc, eligibility = v_elig,
      deadline = v_deadline, link = v_link, instructions = v_instr, extra_info = v_extra, documents = v_docs, is_sample = v_sample,
      status = v_status, updated_at = now()
    where id = p_id and school_id = v_school returning id into v_id;
    if v_id is null then raise exception 'Opportunity not found.'; end if;
  end if;
  return v_id;
end;
$$;

create function public.delete_study_opportunity(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_study_opportunities() then
    raise exception 'Only admins, the Student Council and school staff can do that.';
  end if;
  delete from public.study_opportunities where id = p_id and school_id = public.my_school_id();
end;
$$;

-- ---------------------------------------------------------------------------
-- D. Rewards shop: images and the Top 10 prizes
-- ---------------------------------------------------------------------------
alter table public.rewards add column image_path text;
revoke update on public.rewards from authenticated;
grant update (name, description, cost, stock, per_student_limit, active, image_path) on public.rewards to authenticated;
create function public.rewards_check_image() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.image_path is not null and auth.uid() is not null
     and (tg_op = 'INSERT' or new.image_path is distinct from old.image_path)
     and new.image_path not like new.school_id::text || '/' || auth.uid()::text || '/%' then
    raise exception 'That image is not yours.';
  end if;
  return new;
end;
$$;
create trigger check_image before insert or update on public.rewards for each row execute function public.rewards_check_image();

create table public.top10_prizes (
  school_id uuid not null references public.schools (id),
  place int not null check (place between 1 and 10),
  title text not null check (char_length(title) between 2 and 80),
  description text not null default '' check (char_length(description) <= 200),
  primary key (school_id, place)
);
alter table public.top10_prizes enable row level security;
create policy "see top 10 prizes" on public.top10_prizes for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.top10_prizes from authenticated;

create table public.top10_settings (
  school_id uuid primary key references public.schools (id),
  period text not null default 'week' check (period in ('week', 'all')),
  rules text not null default '' check (char_length(rules) <= 500),
  updated_at timestamptz not null default now()
);
alter table public.top10_settings enable row level security;
create policy "see top 10 settings" on public.top10_settings for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.top10_settings from authenticated;

create function public.set_top10_prize(p_place int, p_title text, p_description text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_title text := left(btrim(coalesce(p_title, '')), 80);
begin
  if not public.can_manage_points() then
    raise exception 'Only admins and school staff can set the Top 10 prizes.';
  end if;
  if p_place not between 1 and 10 then raise exception 'Choose a place from 1 to 10.'; end if;
  if v_title = '' then
    delete from public.top10_prizes where school_id = v_school and place = p_place;
    return;
  end if;
  perform public.reject_blocked(v_school, v_title || ' ' || coalesce(p_description, ''));
  insert into public.top10_prizes (school_id, place, title, description)
  values (v_school, p_place, v_title, left(btrim(coalesce(p_description, '')), 200))
  on conflict (school_id, place) do update set title = excluded.title, description = excluded.description;
end;
$$;

create function public.set_top10_settings(p_period text, p_rules text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_points() then
    raise exception 'Only admins and school staff can change this.';
  end if;
  if p_period not in ('week', 'all') then raise exception 'Choose weekly or all time.'; end if;
  perform public.reject_blocked(public.my_school_id(), coalesce(p_rules, ''));
  insert into public.top10_settings (school_id, period, rules) values (public.my_school_id(), p_period, left(btrim(coalesce(p_rules, '')), 500))
  on conflict (school_id) do update set period = excluded.period, rules = excluded.rules, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array['rewards_check_image()', 'seed_study_categories()', 'split_subjects(text)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array[
    'can_review_tutors()', 'tutor_doc_uploader(text)', 'tutor_doc_viewer(text)',
    'save_tutor_application(jsonb, boolean)', 'withdraw_tutor_application()', 'add_tutor_document(text, text, text, int)',
    'remove_tutor_document(uuid)', 'review_tutor_application(uuid, boolean, text)', 'update_tutor_profile(jsonb)',
    'can_add_resources()', 'add_study_resource(uuid, jsonb)', 'remove_study_resource(uuid)', 'add_study_category(text, text)',
    'can_manage_study_opportunities()', 'save_study_opportunity(uuid, jsonb)', 'delete_study_opportunity(uuid)',
    'set_top10_prize(int, text, text)', 'set_top10_settings(text, text)'
  ] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
