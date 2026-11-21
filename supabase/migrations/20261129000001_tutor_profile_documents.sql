-- A tutor can choose which of their documents (for example a CV) are shown on their public tutor profile.
-- Nothing is shared unless the tutor turns it on, and only people in the same school who are signed in can open it.
alter table public.tutor_application_documents add column public_on_profile boolean not null default false;

-- True when this tutor is approved and listed (so their shared documents may be seen by their school).
create function public.tutor_is_listed(p_tutor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tutor_profiles t
                 where t.profile_id = p_tutor and t.active and t.approved_at is not null and t.school_id = public.my_school_id())
$$;

create function public.tutor_doc_shared(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tutor_application_documents d
                 where d.path = p_name and d.public_on_profile and d.school_id = public.my_school_id() and public.tutor_is_listed(d.profile_id))
$$;

create policy "see shared tutor documents" on public.tutor_application_documents for select to authenticated
  using (public_on_profile and school_id = public.my_school_id() and public.is_reader() and public.tutor_is_listed(profile_id));
create policy "see shared tutor files" on storage.objects for select to authenticated
  using (bucket_id = 'tutor-docs' and public.is_reader() and public.tutor_doc_shared(name));

-- Approved tutors can keep adding and removing their own documents (before, only drafts could).
create or replace function public.add_tutor_document(p_path text, p_name text, p_kind text, p_size int) returns uuid
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
    insert into public.tutor_applications (school_id, profile_id) values (public.my_school_id(), me) returning * into a;
  elsif a.status not in ('draft', 'rejected', 'approved') then
    raise exception 'You cannot change documents while your application is under review.';
  end if;
  if (select count(*) from public.tutor_application_documents where application_id = a.id) >= 8 then
    raise exception 'You can add at most 8 documents.';
  end if;
  insert into public.tutor_application_documents (application_id, school_id, profile_id, path, name, kind, size)
  values (a.id, a.school_id, me, p_path, left(btrim(p_name), 120), p_kind, p_size) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.remove_tutor_document(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.tutor_application_documents;
begin
  select * into d from public.tutor_application_documents where id = p_id and profile_id = auth.uid();
  if d.id is null then
    raise exception 'Document not found.';
  end if;
  if not exists (select 1 from public.tutor_applications where id = d.application_id and status in ('draft', 'rejected', 'approved')) then
    raise exception 'You cannot change documents while your application is under review.';
  end if;
  delete from public.tutor_application_documents where id = d.id;
end;
$$;

-- Turn "show on my tutor profile" on or off for one of my documents.
create function public.set_tutor_doc_public(p_id uuid, p_public boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.tutor_profiles where profile_id = auth.uid() and approved_at is not null) then
    raise exception 'Only approved tutors can share documents on their profile.';
  end if;
  update public.tutor_application_documents set public_on_profile = coalesce(p_public, false) where id = p_id and profile_id = auth.uid();
  if not found then raise exception 'Document not found.'; end if;
end;
$$;

do $$ declare f text; begin
  foreach f in array array['tutor_is_listed(uuid)', 'tutor_doc_shared(text)', 'set_tutor_doc_public(uuid, boolean)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
