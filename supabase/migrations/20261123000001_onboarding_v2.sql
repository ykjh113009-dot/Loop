-- First-time setup v2: new illustrated avatars (b01–b12), class letter and photo saved with setup,
-- and new students may upload their profile photo before setup is finished.

-- Avatars: the old set (a01–a12) stays valid for existing students; the new set is b01–b12.
alter table public.profiles drop constraint profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check check (avatar ~ '^[ab][0-9]{2}$' or avatar ~ '^u:[0-9a-f-]{36}:[0-9]+$');
alter table public.profiles drop constraint profiles_avatar_icon_check;
alter table public.profiles add constraint profiles_avatar_icon_check check (avatar_icon ~ '^[ab][0-9]{2}$');

create or replace function public.profiles_sync_avatar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.avatar ~ '^[ab][0-9]{2}$' and (tg_op = 'INSERT' or new.avatar is distinct from old.avatar) and new.avatar_icon is not distinct from (case when tg_op = 'INSERT' then 'a01' else old.avatar_icon end) then
    new.avatar_icon := new.avatar;
  end if;
  if new.photo_path is not null and auth.uid() is not null and (tg_op = 'INSERT' or new.photo_path is distinct from old.photo_path)
     and new.photo_path not like new.school_id::text || '/' || new.id::text || '/%' then
    raise exception 'That photo is not yours.';
  end if;
  if new.photo_path is null then
    new.avatar := new.avatar_icon;
  elsif tg_op = 'INSERT' or new.photo_path is distinct from old.photo_path or old.avatar !~ '^u:' then
    new.avatar := 'u:' || new.id::text || ':' || floor(extract(epoch from clock_timestamp()))::bigint::text;
  else
    new.avatar := old.avatar;
  end if;
  return new;
end;
$$;

-- Someone who has not finished setup can already upload into their own folder (their profile photo).
create policy "upload own photo during setup" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = public.my_school_id()::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (select 1 from public.profiles where id = (select auth.uid()) and deactivated_at is null and onboarded_at is null)
  );

-- Setup now also saves the class letter (students) and an optional photo.
drop function public.complete_onboarding(int, text, text, bigint[]);
create function public.complete_onboarding(
  p_grade int, p_avatar text, p_bio text, p_interests bigint[], p_section text default null, p_photo text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  v_grades int[];
  v_no_grade boolean;
  v_section text := upper(btrim(coalesce(p_section, '')));
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
  if not v_no_grade and me.section is null and v_section !~ '^[A-F]$' then
    raise exception 'Please choose your class letter.';
  end if;
  if p_avatar !~ '^[ab][0-9]{2}$' then
    raise exception 'Please choose an avatar.';
  end if;
  if coalesce(array_length(p_interests, 1), 0) > 10 then
    raise exception 'Choose up to 10 interests.';
  end if;
  perform public.reject_blocked(me.school_id, coalesce(p_bio, ''));

  update public.profiles
  set grade = case when v_no_grade then null else coalesce(me.grade, p_grade) end,
      section = case when v_no_grade then null else coalesce(me.section, nullif(v_section, '')) end,
      avatar = p_avatar,
      photo_path = coalesce(nullif(p_photo, ''), me.photo_path),
      bio = left(btrim(coalesce(p_bio, '')), 200),
      onboarded_at = coalesce(onboarded_at, now())
  where id = me.id;

  delete from public.profile_interests where profile_id = me.id;
  insert into public.profile_interests (profile_id, interest_id)
  select me.id, unnest(coalesce(p_interests, '{}'));
end;
$$;
revoke execute on function public.complete_onboarding(int, text, text, bigint[], text, text) from public, anon;
grant execute on function public.complete_onboarding(int, text, text, bigint[], text, text) to authenticated;
