-- A student's uploaded profile photo now shows everywhere their avatar shows. The illustrated avatar they picked is kept
-- (avatar_icon) and comes back if they remove the photo. "avatar" is always derived by the database, so nobody can make
-- their avatar point at someone else's photo.
alter table public.profiles add column avatar_icon text not null default 'a01' check (avatar_icon ~ '^a[0-9]{2}$');
update public.profiles set avatar_icon = avatar where avatar ~ '^a[0-9]{2}$';
alter table public.profiles drop constraint profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check check (avatar ~ '^a[0-9]{2}$' or avatar ~ '^u:[0-9a-f-]{36}:[0-9]+$');

create function public.profiles_sync_avatar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Picking an illustration changes the illustration (what shows when there is no photo).
  if new.avatar ~ '^a[0-9]{2}$' and (tg_op = 'INSERT' or new.avatar is distinct from old.avatar) and new.avatar_icon is not distinct from (case when tg_op = 'INSERT' then 'a01' else old.avatar_icon end) then
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
revoke execute on function public.profiles_sync_avatar() from public, anon, authenticated;
create trigger sync_avatar before insert or update on public.profiles for each row execute function public.profiles_sync_avatar();

-- Existing photos start showing too.
update public.profiles set photo_path = photo_path where photo_path is not null;
