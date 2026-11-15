-- Academic Resources Library: one library (Official + Community), reviewed submissions with versions,
-- ratings and reviews, personal library, internal flags. Tables are read-only for signed-in users;
-- every change is a function that checks who is calling. Additive: nothing existing is dropped.

-- ---------------------------------------------------------------------------
-- Who can do what
-- ---------------------------------------------------------------------------
create function public.can_review_library() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_leadership('council_member')
$$;

-- Verified students, approved tutors, designated staff (and admins) can share resources.
create function public.can_submit_library() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active() and (
    public.is_current_student((select auth.uid())) or public.is_admin()
    or public.has_leadership('council_member') or public.has_leadership('school_staff')
    or exists (select 1 from public.tutor_profiles where profile_id = (select auth.uid()) and approved_at is not null and active))
$$;

-- Only web links that are safe to open: http(s), a real host name, no logins, no local addresses.
create function public.library_valid_link(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p ~* '^https?://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{1,5})?([/?#][^\s<>"'']*)?$'
    and p !~* '^https?://([0-9]+\.)+[0-9]+([:/?#]|$)'
    and p !~* '^https?://(localhost|[^/]*\.local|[^/]*\.internal)([:/?#]|$)'
    and char_length(p) <= 500
$$;

create table public.library_settings (
  school_id uuid primary key references public.schools (id),
  points_per_approval int not null default 10 check (points_per_approval between 0 and 200),
  updated_at timestamptz not null default now()
);
alter table public.library_settings enable row level security;
create policy "see library settings" on public.library_settings for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.library_settings from authenticated;

create function public.library_points() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select points_per_approval from public.library_settings where school_id = public.my_school_id()), 10)
$$;

-- ---------------------------------------------------------------------------
-- Resources (the live, public version) and revisions (every submitted version)
-- ---------------------------------------------------------------------------
create table public.library_resources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  source text not null check (source in ('official', 'community')),
  submitter_id uuid references public.profiles (id) on delete set null,
  subject_id uuid not null references public.study_categories (id),
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 500),
  type text not null check (type in ('digital_book', 'textbook', 'pdf_notes', 'study_guide', 'past_paper', 'practice_questions',
                                     'worksheet', 'video', 'website', 'other')),
  author text not null default '' check (char_length(author) <= 120),
  cover_path text,
  file_path text,
  file_name text,
  file_size int,
  file_mime text,
  link_url text,
  downloadable boolean not null default false,
  file_hash text,
  content_key text,
  live_revision_id uuid,
  latest_revision_id uuid,
  visibility text not null default 'visible' check (visibility in ('visible', 'hidden', 'removed')),
  deleted_at timestamptz,
  published_at timestamptz,
  points_awarded boolean not null default false,
  views_count int not null default 0,
  downloads_count int not null default 0,
  rating_avg numeric(3, 2) not null default 0,
  rating_count int not null default 0,
  review_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.library_resources (school_id, subject_id, published_at desc);
create index on public.library_resources (submitter_id);
create index on public.library_resources (file_path);
create index on public.library_resources (cover_path);
create unique index library_resources_content_key on public.library_resources (school_id, content_key)
  where content_key is not null and deleted_at is null and visibility <> 'removed';
alter table public.library_resources enable row level security;
create policy "see library resources" on public.library_resources for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader() and (
    (published_at is not null and visibility = 'visible' and deleted_at is null)
    or (submitter_id = (select auth.uid()) and deleted_at is null)
    or public.can_review_library()));
revoke all on public.library_resources from authenticated;
-- The private file location and the duplicate key are not readable directly; files are reached through library_file_info().
grant select (id, school_id, source, submitter_id, subject_id, title, description, type, author, cover_path, file_name, file_size,
              file_mime, link_url, downloadable, live_revision_id, latest_revision_id, visibility, deleted_at, published_at,
              points_awarded, views_count, downloads_count, rating_avg, rating_count, review_count, created_at, updated_at)
  on public.library_resources to authenticated;

create table public.library_revisions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.library_resources (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  submitter_id uuid references public.profiles (id) on delete set null,
  number int not null default 1,
  subject_id uuid not null references public.study_categories (id),
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 500),
  type text not null check (type in ('digital_book', 'textbook', 'pdf_notes', 'study_guide', 'past_paper', 'practice_questions',
                                     'worksheet', 'video', 'website', 'other')),
  author text not null default '' check (char_length(author) <= 120),
  cover_path text,
  file_path text,
  file_name text,
  file_size int,
  file_mime text,
  file_hash text,
  link_url text,
  downloadable boolean not null default false,
  rights_confirmed boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.library_revisions (resource_id, number);
create index on public.library_revisions (school_id, status, submitted_at);
create index on public.library_revisions (submitter_id, status);
alter table public.library_revisions enable row level security;
create policy "see own or reviewed revisions" on public.library_revisions for select to authenticated
  using (submitter_id = (select auth.uid()) or (school_id = public.my_school_id() and public.can_review_library()));
revoke insert, update, delete on public.library_revisions from authenticated;

-- Every decision, kept forever.
create table public.library_decisions (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id),
  resource_id uuid not null references public.library_resources (id) on delete cascade,
  revision_id uuid not null references public.library_revisions (id) on delete cascade,
  reviewer_id uuid references public.profiles (id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index on public.library_decisions (resource_id, created_at);
alter table public.library_decisions enable row level security;
create policy "see own or reviewed decisions" on public.library_decisions for select to authenticated
  using (school_id = public.my_school_id() and (public.can_review_library() or exists (
    select 1 from public.library_resources r where r.id = library_decisions.resource_id and r.submitter_id = (select auth.uid()))));
revoke insert, update, delete on public.library_decisions from authenticated;

-- Internal record of reviewer and admin actions. Never shown to ordinary users.
create table public.library_actions (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id),
  resource_id uuid references public.library_resources (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index on public.library_actions (resource_id, created_at);
alter table public.library_actions enable row level security;
create policy "reviewers see actions" on public.library_actions for select to authenticated
  using (school_id = public.my_school_id() and public.can_review_library());
revoke insert, update, delete on public.library_actions from authenticated;

-- Flags raised by reviewers (internal).
create table public.library_flags (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  resource_id uuid not null references public.library_resources (id) on delete cascade,
  flagged_by uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'kept', 'hidden', 'removed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);
create index on public.library_flags (school_id, status, created_at);
alter table public.library_flags enable row level security;
create policy "reviewers see flags" on public.library_flags for select to authenticated
  using (school_id = public.my_school_id() and public.can_review_library());
revoke insert, update, delete on public.library_flags from authenticated;

create table public.library_ratings (
  resource_id uuid not null references public.library_resources (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  stars int not null check (stars between 1 and 5),
  review text check (review is null or char_length(review) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (resource_id, profile_id)
);
create index on public.library_ratings (resource_id, updated_at desc);
alter table public.library_ratings enable row level security;
create policy "see ratings" on public.library_ratings for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.library_ratings from authenticated;

create table public.library_saves (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  resource_id uuid not null references public.library_resources (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, resource_id)
);
alter table public.library_saves enable row level security;
create policy "see own saves" on public.library_saves for select to authenticated
  using (profile_id = (select auth.uid()));
revoke insert, update, delete on public.library_saves from authenticated;

-- Used only to count real views and downloads once per person per window.
create table public.library_events (
  id bigint generated always as identity primary key,
  resource_id uuid not null references public.library_resources (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('view', 'download')),
  created_at timestamptz not null default now()
);
create index on public.library_events (resource_id, profile_id, kind, created_at desc);
alter table public.library_events enable row level security;
revoke all on public.library_events from authenticated;

-- ---------------------------------------------------------------------------
-- Private files: "<school>/<user>/<uuid>/<file>"
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-files', 'library-files', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create function public.library_path_ok(p_name text) returns boolean
language sql immutable set search_path = '' as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
$$;
create function public.library_file_uploader(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.library_path_ok(p_name)
    and split_part(p_name, '/', 1) = public.my_school_id()::text
    and split_part(p_name, '/', 2) = (select auth.uid())::text
$$;
-- Your own files, any file for reviewers, and the live file or cover of a published resource.
create function public.library_file_viewer(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.library_path_ok(p_name) and (
    split_part(p_name, '/', 2) = (select auth.uid())::text
    or (split_part(p_name, '/', 1) = public.my_school_id()::text and public.can_review_library())
    or exists (select 1 from public.library_resources r
               where r.school_id = public.my_school_id() and (r.file_path = p_name or r.cover_path = p_name)
                 and r.published_at is not null and r.visibility = 'visible' and r.deleted_at is null))
$$;
create policy "upload library files" on storage.objects for insert to authenticated
  with check (bucket_id = 'library-files' and public.can_submit_library() and public.library_file_uploader(name));
create policy "see library files" on storage.objects for select to authenticated
  using (bucket_id = 'library-files' and public.is_reader() and public.library_file_viewer(name));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.library_notify_reviewers(p_school uuid, p_except uuid, p_title text, p_body text, p_link text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in
    select p.id from public.profiles p
    where p.school_id = p_school and p.deactivated_at is null and p.id <> coalesce(p_except, '00000000-0000-0000-0000-000000000000')
      and (p.role = 'admin' or exists (select 1 from public.leadership_roles l where l.profile_id = p.id and l.kind = 'council_member'))
    limit 50
  loop
    perform public.notify(r.id, 'library_pending', p_title, p_body, p_link);
  end loop;
end;
$$;

create function public.library_note(p_school uuid, p_resource uuid, p_action text, p_note text) returns void
language sql security definer set search_path = '' as $$
  insert into public.library_actions (school_id, resource_id, actor_id, action, note)
  values (p_school, p_resource, auth.uid(), p_action, left(coalesce(p_note, ''), 500))
$$;

create function public.library_refresh_rating(p_resource uuid) returns void
language sql security definer set search_path = '' as $$
  update public.library_resources r set
    rating_count = coalesce(s.n, 0),
    rating_avg = coalesce(round(s.a, 2), 0),
    review_count = coalesce(s.t, 0)
  from (select count(*)::int as n, avg(stars) as a, count(review)::int as t from public.library_ratings where resource_id = p_resource) s
  where r.id = p_resource
$$;

-- ---------------------------------------------------------------------------
-- Community submissions: create, edit, save as draft, submit
-- ---------------------------------------------------------------------------
create function public.library_submit(p_resource uuid, p jsonb, p_submit boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_school uuid := public.my_school_id();
  r public.library_resources;
  rv public.library_revisions;
  v_subject uuid := nullif(p ->> 'subject_id', '')::uuid;
  v_title text := left(btrim(coalesce(p ->> 'title', '')), 100);
  v_desc text := left(btrim(coalesce(p ->> 'description', '')), 500);
  v_type text := coalesce(nullif(p ->> 'type', ''), 'other');
  v_author text := left(btrim(coalesce(p ->> 'author', '')), 120);
  v_link text := nullif(left(btrim(coalesce(p ->> 'link_url', '')), 500), '');
  v_file text := nullif(p ->> 'file_path', '');
  v_fname text := nullif(left(btrim(coalesce(p ->> 'file_name', '')), 120), '');
  v_fsize int := nullif(p ->> 'file_size', '')::int;
  v_fmime text := nullif(p ->> 'file_mime', '');
  v_fhash text := nullif(left(coalesce(p ->> 'file_hash', ''), 64), '');
  v_cover text := nullif(p ->> 'cover_path', '');
  v_down boolean := coalesce((p ->> 'downloadable')::boolean, false);
  v_rights boolean := coalesce((p ->> 'rights_confirmed')::boolean, false);
  v_key text;
  v_status text := case when p_submit then 'pending' else 'draft' end;
  v_rev uuid;
  v_num int := 1;
  v_in_place boolean := false;
begin
  if not public.can_submit_library() then
    raise exception 'Only verified students, approved tutors and school staff can share resources.';
  end if;
  if v_title = '' or char_length(v_title) < 3 then raise exception 'Give the resource a title.'; end if;
  if v_subject is null or not exists (select 1 from public.study_categories where id = v_subject and school_id = v_school) then
    raise exception 'Choose a subject.';
  end if;
  if v_type not in ('digital_book', 'textbook', 'pdf_notes', 'study_guide', 'past_paper', 'practice_questions', 'worksheet', 'video',
                    'website', 'other') then
    raise exception 'Choose the type of resource.';
  end if;
  perform public.reject_blocked(v_school, v_title || ' ' || v_desc || ' ' || v_author);
  if v_link is not null and not public.library_valid_link(v_link) then
    raise exception 'That link does not look safe. Use a normal web address that starts with https://';
  end if;
  if v_file is not null and not public.library_file_uploader(v_file) then raise exception 'That file is not yours.'; end if;
  if v_cover is not null and not public.library_file_uploader(v_cover) then raise exception 'That cover is not yours.'; end if;
  if v_file is not null and v_link is not null then raise exception 'Add either a file or a link, not both.'; end if;
  if v_file is not null and (coalesce(v_fsize, 0) not between 1 and 26214400 or v_fname is null) then
    raise exception 'That file is too large (25 MB maximum).';
  end if;
  if v_file is not null and coalesce(v_fmime, '') not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/vnd.openxmlformats-officedocument.presentationml.presentation',
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') then
    raise exception 'That file type is not allowed. Use PDF, Word, PowerPoint, Excel, text or an image.';
  end if;
  if p_submit then
    if char_length(v_desc) < 10 then raise exception 'Add a short description (at least 10 characters).'; end if;
    if v_file is null and v_link is null then raise exception 'Upload a file or add a link.'; end if;
    if v_file is not null and not v_rights then
      raise exception 'Please confirm you are allowed to share this file.';
    end if;
  end if;
  if v_file is not null then
    v_key := md5(v_school::text || ':' || coalesce(v_fhash, v_fname || ':' || v_fsize::text));
  elsif v_link is not null then
    v_key := md5(v_school::text || ':' || lower(regexp_replace(v_link, '/+$', '')));
  end if;
  perform public.check_rate('library_submit', 30, 86400);

  if p_resource is null then
    insert into public.library_resources (school_id, source, submitter_id, subject_id, title, description, type, author, cover_path,
                                          file_path, file_name, file_size, file_mime, link_url, downloadable, file_hash, content_key)
    values (v_school, 'community', v_me, v_subject, v_title, v_desc, v_type, v_author, v_cover, v_file, v_fname, v_fsize, v_fmime,
            v_link, v_down, v_fhash, v_key)
    returning * into r;
  else
    select * into r from public.library_resources
    where id = p_resource and school_id = v_school and deleted_at is null for update;
    if r.id is null or r.source <> 'community' or r.submitter_id is distinct from v_me then
      raise exception 'You cannot edit this.';
    end if;
    if r.visibility <> 'visible' then raise exception 'This resource was taken down by the reviewers.'; end if;
    select * into rv from public.library_revisions where id = r.latest_revision_id;
    if rv.id is not null and rv.status <> 'approved' then
      v_in_place := true;
      v_num := rv.number;
    else
      v_num := coalesce(rv.number, 0) + 1;
    end if;
    -- Not yet published: the resource row mirrors the latest version. Published: the live version stays until approval.
    if r.published_at is null then
      update public.library_resources set subject_id = v_subject, title = v_title, description = v_desc, type = v_type, author = v_author,
        cover_path = v_cover, file_path = v_file, file_name = v_fname, file_size = v_fsize, file_mime = v_fmime, link_url = v_link,
        downloadable = v_down, file_hash = v_fhash, content_key = v_key, updated_at = now()
      where id = r.id;
    end if;
  end if;

  if v_in_place then
    update public.library_revisions set subject_id = v_subject, title = v_title, description = v_desc, type = v_type, author = v_author,
      cover_path = v_cover, file_path = v_file, file_name = v_fname, file_size = v_fsize, file_mime = v_fmime, file_hash = v_fhash,
      link_url = v_link, downloadable = v_down, rights_confirmed = v_rights, status = v_status, review_note = null,
      reviewed_by = null, reviewed_at = null, submitted_at = case when p_submit then now() else submitted_at end, updated_at = now()
    where id = rv.id returning id into v_rev;
  else
    insert into public.library_revisions (resource_id, school_id, submitter_id, number, subject_id, title, description, type, author,
                                          cover_path, file_path, file_name, file_size, file_mime, file_hash, link_url, downloadable,
                                          rights_confirmed, status, submitted_at)
    values (r.id, v_school, v_me, v_num, v_subject, v_title, v_desc, v_type, v_author, v_cover, v_file, v_fname, v_fsize, v_fmime,
            v_fhash, v_link, v_down, v_rights, v_status, case when p_submit then now() end)
    returning id into v_rev;
  end if;
  update public.library_resources set latest_revision_id = v_rev, updated_at = now() where id = r.id;

  if p_submit then
    perform public.library_notify_reviewers(v_school, v_me,
      case when r.published_at is null then 'New resource to review' else 'A resource was updated and needs review' end,
      v_title, '/academic-resources/review/' || v_rev::text);
  end if;
  return r.id;
exception when unique_violation then
  raise exception 'That file or link is already in the library.';
end;
$$;

-- Owners delete their own community resources. Public browsing stops; the history stays for the reviewers.
create function public.library_delete(p_resource uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.library_resources;
begin
  select * into r from public.library_resources where id = p_resource and school_id = public.my_school_id() and deleted_at is null;
  if r.id is null then raise exception 'Resource not found.'; end if;
  if r.source = 'community' and r.submitter_id = auth.uid() then
    null;
  elsif r.source = 'official' and public.is_admin() then
    null;
  else
    raise exception 'You cannot delete this.';
  end if;
  update public.library_resources set deleted_at = now(), updated_at = now() where id = r.id;
  delete from public.library_saves where resource_id = r.id;
  perform public.library_note(r.school_id, r.id, 'deleted', r.title);
end;
$$;

-- ---------------------------------------------------------------------------
-- Review
-- ---------------------------------------------------------------------------
create function public.library_review(p_revision uuid, p_approve boolean, p_note text, p_downloadable boolean default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_note text := left(btrim(coalesce(p_note, '')), 500);
  rv public.library_revisions;
  r public.library_resources;
  v_points int;
  v_update boolean;
begin
  if not public.can_review_library() then raise exception 'Only the Student Council and admins can review resources.'; end if;
  select * into rv from public.library_revisions where id = p_revision and school_id = public.my_school_id() for update;
  if rv.id is null then raise exception 'Submission not found.'; end if;
  if rv.status <> 'pending' then raise exception 'This submission was already reviewed.'; end if;
  if rv.submitter_id = v_me then raise exception 'You cannot review your own submission.'; end if;
  select * into r from public.library_resources where id = rv.resource_id for update;
  if r.deleted_at is not null or r.visibility = 'removed' then raise exception 'This resource was deleted.'; end if;
  v_update := r.published_at is not null;

  if not p_approve then
    if char_length(v_note) < 3 then raise exception 'Explain why it was not approved so the student can fix it.'; end if;
    perform public.reject_blocked(r.school_id, v_note);
    update public.library_revisions set status = 'rejected', review_note = v_note, reviewed_by = v_me, reviewed_at = now(), updated_at = now()
    where id = rv.id;
    insert into public.library_decisions (school_id, resource_id, revision_id, reviewer_id, decision, note)
    values (r.school_id, r.id, rv.id, v_me, 'rejected', v_note);
    perform public.notify(rv.submitter_id, case when v_update then 'library_update_rejected' else 'library_rejected' end,
      case when v_update then 'Your resource update was not approved' else 'Your resource needs changes' end,
      rv.title || ' — ' || v_note, '/academic-resources/my-contributions');
    return;
  end if;

  update public.library_resources set
    subject_id = rv.subject_id, title = rv.title, description = rv.description, type = rv.type, author = rv.author,
    cover_path = rv.cover_path, file_path = rv.file_path, file_name = rv.file_name, file_size = rv.file_size, file_mime = rv.file_mime,
    file_hash = rv.file_hash, link_url = rv.link_url, downloadable = coalesce(p_downloadable, rv.downloadable),
    live_revision_id = rv.id, published_at = coalesce(published_at, now()), updated_at = now()
  where id = r.id;
  update public.library_revisions set status = 'approved', review_note = nullif(v_note, ''), reviewed_by = v_me, reviewed_at = now(),
    downloadable = coalesce(p_downloadable, downloadable), updated_at = now()
  where id = rv.id;
  insert into public.library_decisions (school_id, resource_id, revision_id, reviewer_id, decision, note)
  values (r.school_id, r.id, rv.id, v_me, 'approved', v_note);
  perform public.notify(rv.submitter_id, case when v_update then 'library_update_approved' else 'library_approved' end,
    case when v_update then 'Your resource update is live' else '✅ Your resource is live' end,
    rv.title, '/academic-resources/resource/' || r.id::text);

  -- Points: once per resource, never for edits, and never again for the same content after a delete and re-share.
  if not r.points_awarded then
    update public.library_resources set points_awarded = true where id = r.id;
    v_points := public.library_points();
    if v_points > 0 and rv.submitter_id is not null and public.is_current_student(rv.submitter_id) then
      perform public.award_points(rv.submitter_id, v_points, 'library_resource',
        md5('library:' || r.school_id::text || ':' || rv.submitter_id::text || ':' || coalesce(r.content_key, r.id::text))::uuid);
      perform public.notify(rv.submitter_id, 'library_points', '⭐ +' || v_points::text || ' points',
        'For sharing "' || rv.title || '"', '/points');
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Official library (admins only; no review needed)
-- ---------------------------------------------------------------------------
create function public.library_official_save(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_school uuid := public.my_school_id();
  v_subject uuid := nullif(p ->> 'subject_id', '')::uuid;
  v_title text := left(btrim(coalesce(p ->> 'title', '')), 100);
  v_desc text := left(btrim(coalesce(p ->> 'description', '')), 500);
  v_type text := coalesce(nullif(p ->> 'type', ''), 'other');
  v_author text := left(btrim(coalesce(p ->> 'author', '')), 120);
  v_link text := nullif(left(btrim(coalesce(p ->> 'link_url', '')), 500), '');
  v_file text := nullif(p ->> 'file_path', '');
  v_fname text := nullif(left(btrim(coalesce(p ->> 'file_name', '')), 120), '');
  v_fsize int := nullif(p ->> 'file_size', '')::int;
  v_fmime text := nullif(p ->> 'file_mime', '');
  v_cover text := nullif(p ->> 'cover_path', '');
  v_down boolean := coalesce((p ->> 'downloadable')::boolean, true);
  v_vis text := coalesce(nullif(p ->> 'visibility', ''), 'visible');
  v_key text;
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Only admins can manage the official library.'; end if;
  if char_length(v_title) < 3 then raise exception 'Give the resource a title.'; end if;
  if v_subject is null or not exists (select 1 from public.study_categories where id = v_subject and school_id = v_school) then
    raise exception 'Choose a subject.';
  end if;
  if v_type not in ('digital_book', 'textbook', 'pdf_notes', 'study_guide', 'past_paper', 'practice_questions', 'worksheet', 'video',
                    'website', 'other') then
    raise exception 'Choose the type of resource.';
  end if;
  if v_vis not in ('visible', 'hidden') then raise exception 'Unknown availability.'; end if;
  if v_file is null and v_link is null and p_id is null then raise exception 'Upload a file or add a link.'; end if;
  if v_file is not null and v_link is not null then raise exception 'Add either a file or a link, not both.'; end if;
  if v_link is not null and not public.library_valid_link(v_link) then
    raise exception 'That link does not look safe. Use a normal web address that starts with https://';
  end if;
  if v_file is not null and (not public.library_file_uploader(v_file) or coalesce(v_fsize, 0) not between 1 and 26214400) then
    raise exception 'That file cannot be used.';
  end if;
  if v_cover is not null and not public.library_file_uploader(v_cover) then raise exception 'That cover is not yours.'; end if;
  perform public.reject_blocked(v_school, v_title || ' ' || v_desc || ' ' || v_author);
  if p_id is null then
    v_key := md5(v_school::text || ':' || coalesce(v_file, lower(regexp_replace(v_link, '/+$', ''))));
    insert into public.library_resources (school_id, source, submitter_id, subject_id, title, description, type, author, cover_path,
                                          file_path, file_name, file_size, file_mime, link_url, downloadable, content_key, visibility,
                                          published_at, points_awarded)
    values (v_school, 'official', v_me, v_subject, v_title, v_desc, v_type, v_author, v_cover, v_file, v_fname, v_fsize, v_fmime, v_link,
            v_down, v_key, v_vis, now(), true)
    returning id into v_id;
    perform public.library_note(v_school, v_id, 'official_added', v_title);
  else
    update public.library_resources set subject_id = v_subject, title = v_title, description = v_desc, type = v_type, author = v_author,
      cover_path = coalesce(v_cover, cover_path),
      file_path = case when v_link is not null then null else coalesce(v_file, file_path) end,
      file_name = case when v_link is not null then null else coalesce(v_fname, file_name) end,
      file_size = case when v_link is not null then null else coalesce(v_fsize, file_size) end,
      file_mime = case when v_link is not null then null else coalesce(v_fmime, file_mime) end,
      link_url = case when v_file is not null then null else coalesce(v_link, link_url) end,
      downloadable = v_down, visibility = v_vis, updated_at = now()
    where id = p_id and school_id = v_school and source = 'official' and deleted_at is null
    returning id into v_id;
    if v_id is null then raise exception 'Resource not found.'; end if;
    perform public.library_note(v_school, v_id, 'official_edited', v_title);
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'That file or link is already in the library.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Flags (reviewers only, internal)
-- ---------------------------------------------------------------------------
create function public.library_flag(p_resource uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := left(btrim(coalesce(p_reason, '')), 500);
begin
  if not public.can_review_library() then raise exception 'Only the Student Council and admins can flag a resource.'; end if;
  if char_length(v_reason) < 3 then raise exception 'Write the reason for the flag.'; end if;
  if not exists (select 1 from public.library_resources where id = p_resource and school_id = public.my_school_id() and deleted_at is null) then
    raise exception 'Resource not found.';
  end if;
  insert into public.library_flags (school_id, resource_id, flagged_by, reason)
  values (public.my_school_id(), p_resource, auth.uid(), v_reason);
  perform public.library_note(public.my_school_id(), p_resource, 'flagged', v_reason);
end;
$$;

create function public.library_resolve_flag(p_flag uuid, p_outcome text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  f public.library_flags;
  v_note text := left(btrim(coalesce(p_note, '')), 500);
begin
  if not public.can_review_library() then raise exception 'Only the Student Council and admins can do that.'; end if;
  if p_outcome not in ('kept', 'hidden', 'removed') then raise exception 'Choose keep, hide or remove.'; end if;
  select * into f from public.library_flags where id = p_flag and school_id = public.my_school_id() and status = 'open' for update;
  if f.id is null then raise exception 'Flag not found.'; end if;
  update public.library_flags set status = p_outcome, resolved_by = auth.uid(), resolved_at = now(), resolution_note = v_note where id = f.id;
  if p_outcome = 'hidden' then
    update public.library_resources set visibility = 'hidden', updated_at = now() where id = f.resource_id;
  elsif p_outcome = 'removed' then
    update public.library_resources set visibility = 'removed', updated_at = now() where id = f.resource_id;
  end if;
  perform public.library_note(f.school_id, f.resource_id, 'flag_' || p_outcome, v_note);
end;
$$;

-- Bring a hidden resource back.
create function public.library_restore(p_resource uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_review_library() then raise exception 'Only the Student Council and admins can do that.'; end if;
  update public.library_resources set visibility = 'visible', updated_at = now()
  where id = p_resource and school_id = public.my_school_id() and visibility = 'hidden' and deleted_at is null;
  perform public.library_note(public.my_school_id(), p_resource, 'restored', '');
end;
$$;

-- ---------------------------------------------------------------------------
-- Ratings, saving, access, statistics
-- ---------------------------------------------------------------------------
create function public.library_rate(p_resource uuid, p_stars int, p_review text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  r public.library_resources;
  v_review text := nullif(left(btrim(coalesce(p_review, '')), 1000), '');
begin
  if not public.is_active() then raise exception 'Sign in to rate.'; end if;
  select * into r from public.library_resources
  where id = p_resource and school_id = public.my_school_id() and published_at is not null and visibility = 'visible' and deleted_at is null;
  if r.id is null then raise exception 'Resource not found.'; end if;
  if r.submitter_id = v_me then raise exception 'You cannot rate your own resource.'; end if;
  if p_stars is null then
    delete from public.library_ratings where resource_id = r.id and profile_id = v_me;
  else
    if p_stars not between 1 and 5 then raise exception 'Choose 1 to 5 stars.'; end if;
    if v_review is not null then perform public.reject_blocked(r.school_id, v_review); end if;
    perform public.check_rate('library_rate', 30, 3600);
    insert into public.library_ratings (resource_id, profile_id, school_id, stars, review)
    values (r.id, v_me, r.school_id, p_stars, v_review)
    on conflict (resource_id, profile_id) do update set stars = excluded.stars, review = excluded.review, updated_at = now();
  end if;
  perform public.library_refresh_rating(r.id);
end;
$$;

create function public.library_save(p_resource uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active() then raise exception 'Sign in to save.'; end if;
  if p_on then
    if not exists (select 1 from public.library_resources where id = p_resource and school_id = public.my_school_id()
                   and published_at is not null and visibility = 'visible' and deleted_at is null) then
      raise exception 'Resource not found.';
    end if;
    perform public.check_rate('library_save', 100, 3600);
    insert into public.library_saves (profile_id, resource_id) values (auth.uid(), p_resource) on conflict do nothing;
  else
    delete from public.library_saves where profile_id = auth.uid() and resource_id = p_resource;
  end if;
end;
$$;

-- Where a file lives, if the caller may open it. kind: read (in Loop), download. Nothing is counted here.
create function public.library_file_info(p_resource uuid, p_kind text, p_revision uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.library_resources;
  rv public.library_revisions;
begin
  if not public.is_reader() then return null; end if;
  if p_revision is not null then
    select * into rv from public.library_revisions
    where id = p_revision and school_id = public.my_school_id() and (submitter_id = auth.uid() or public.can_review_library());
    if rv.id is null or rv.file_path is null then return null; end if;
    return jsonb_build_object('path', rv.file_path, 'name', rv.file_name, 'mime', rv.file_mime, 'downloadable', true, 'preview', true);
  end if;
  select * into r from public.library_resources
  where id = p_resource and school_id = public.my_school_id() and deleted_at is null
    and ((published_at is not null and visibility = 'visible') or submitter_id = auth.uid() or public.can_review_library());
  if r.id is null or r.file_path is null then return null; end if;
  if p_kind = 'download' and not r.downloadable and not (r.submitter_id = auth.uid() or public.can_review_library()) then return null; end if;
  return jsonb_build_object('path', r.file_path, 'name', r.file_name, 'mime', r.file_mime, 'downloadable', r.downloadable, 'preview', false);
end;
$$;

-- Counts a view once per person per 6 hours and a download once per day. Owners and refreshes do not count.
create function public.library_track(p_resource uuid, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  r public.library_resources;
begin
  if p_kind not in ('view', 'download') or not public.is_active() then return; end if;
  select * into r from public.library_resources
  where id = p_resource and school_id = public.my_school_id() and published_at is not null and visibility = 'visible' and deleted_at is null;
  if r.id is null or r.submitter_id = v_me then return; end if;
  if p_kind = 'download' and (r.file_path is null or not r.downloadable) then return; end if;
  perform public.check_rate('library_track', 120, 3600);
  if exists (select 1 from public.library_events where resource_id = r.id and profile_id = v_me and kind = p_kind
             and created_at > now() - case when p_kind = 'view' then interval '6 hours' else interval '1 day' end) then
    return;
  end if;
  insert into public.library_events (resource_id, profile_id, kind) values (r.id, v_me, p_kind);
  if p_kind = 'view' then
    update public.library_resources set views_count = views_count + 1 where id = r.id;
  else
    update public.library_resources set downloads_count = downloads_count + 1 where id = r.id;
  end if;
end;
$$;

-- Fair ranking: a Bayesian average, so one 5-star review does not beat many good ones.
create function public.library_top_rated(p_limit int default 10) returns table (resource_id uuid, score numeric)
language sql stable security definer set search_path = '' as $$
  with school_mean as (
    select coalesce(avg(rating_avg) filter (where rating_count > 0), 3.5) as c from public.library_resources
    where school_id = public.my_school_id() and published_at is not null and visibility = 'visible' and deleted_at is null
  )
  select r.id, round(((r.rating_count::numeric / (r.rating_count + 5)) * r.rating_avg + (5::numeric / (r.rating_count + 5)) * m.c), 4)
  from public.library_resources r, school_mean m
  where r.school_id = public.my_school_id() and public.is_reader() and r.rating_count > 0
    and r.published_at is not null and r.visibility = 'visible' and r.deleted_at is null
  order by 2 desc, r.rating_count desc, r.published_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
$$;

create function public.library_set_points(p_points int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_points() then raise exception 'Only admins and school staff can change this.'; end if;
  if p_points is null or p_points not between 0 and 200 then raise exception 'Choose 0 to 200 points.'; end if;
  insert into public.library_settings (school_id, points_per_approval) values (public.my_school_id(), p_points)
  on conflict (school_id) do update set points_per_approval = excluded.points_per_approval, updated_at = now();
  perform public.library_note(public.my_school_id(), null, 'points_changed', p_points::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Carry over the old link list into the official library
-- ---------------------------------------------------------------------------
insert into public.library_resources (school_id, source, submitter_id, subject_id, title, description, type, link_url, content_key,
                                      published_at, points_awarded, created_at)
select s.school_id, 'official', s.added_by, s.category_id, s.title, s.description,
       case s.kind when 'pdf' then 'pdf_notes' when 'video' then 'video' when 'notes' then 'pdf_notes'
                   when 'practice' then 'practice_questions' when 'link' then 'website' else 'other' end,
       s.url, md5(s.school_id::text || ':' || lower(regexp_replace(s.url, '/+$', ''))), s.created_at, true, s.created_at
from public.study_resources s
where public.library_valid_link(s.url)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array['library_notify_reviewers(uuid, uuid, text, text, text)', 'library_note(uuid, uuid, text, text)',
                           'library_refresh_rating(uuid)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array[
    'can_review_library()', 'can_submit_library()', 'library_valid_link(text)', 'library_points()', 'library_path_ok(text)',
    'library_file_uploader(text)', 'library_file_viewer(text)',
    'library_submit(uuid, jsonb, boolean)', 'library_delete(uuid)', 'library_review(uuid, boolean, text, boolean)',
    'library_official_save(uuid, jsonb)', 'library_flag(uuid, text)', 'library_resolve_flag(uuid, text, text)', 'library_restore(uuid)',
    'library_rate(uuid, int, text)', 'library_save(uuid, boolean)', 'library_file_info(uuid, text, uuid)', 'library_track(uuid, text)',
    'library_top_rated(int)', 'library_set_points(int)'
  ] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
