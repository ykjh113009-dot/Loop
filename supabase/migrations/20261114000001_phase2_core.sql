-- =============================================================================
-- Loop Phase 2: core platform
--
--   1. Profiles: handle, photo, cover, skills, favourite subjects, accent colour
--   2. Settings: privacy, notifications on/off, language, accessibility
--   3. Follows, friend requests and friendships
--   4. School-wide feed: post kinds, polls, reactions, comments, saves,
--      hashtags, mentions, reposts and a relevance ranking
--   5. Notifications that respect the on/off switch
--   6. Chats: group chats, message requests, attachments, reactions
--   7. Deactivating and deleting your own account
--
-- Everything here only ADDS to the database. No existing rows are deleted.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Profiles
-- ---------------------------------------------------------------------------

alter table public.profiles
  -- Short name used for @mentions, taken from the school email.
  add column handle text,
  add column photo_path text,
  add column cover_path text,
  add column skills text[] not null default '{}' check (coalesce(array_length(skills, 1), 0) <= 12),
  add column favorite_subjects text[] not null default '{}' check (coalesce(array_length(favorite_subjects, 1), 0) <= 8),
  add column accent text not null default 'olive' check (accent in ('olive', 'sage', 'sky', 'sand', 'rose', 'plum')),
  add column self_deactivated boolean not null default false;

create function public.make_handle(p_school uuid, p_email text, p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_base text := left(regexp_replace(lower(split_part(p_email, '@', 1)), '[^a-z0-9_]', '', 'g'), 24);
  v_try text;
  n int := 0;
begin
  if v_base = '' then v_base := 'student'; end if;
  v_try := v_base;
  while exists (select 1 from public.profiles where school_id = p_school and handle = v_try and id <> p_id) loop
    n := n + 1;
    v_try := v_base || n;
  end loop;
  return v_try;
end;
$$;

update public.profiles p
set handle = public.make_handle(p.school_id, pp.email, p.id)
from public.private_profiles pp where pp.id = p.id;
create unique index profiles_handle on public.profiles (school_id, handle);

create function public.set_handle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p set handle = public.make_handle(p.school_id, new.email, p.id)
  where p.id = new.id and p.handle is null;
  return null;
end;
$$;
create trigger set_handle after insert on public.private_profiles
  for each row execute function public.set_handle();

-- Photos must sit in the student's own folder, and words are filtered.
create function public.profiles_check_extras() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_prefix text := new.school_id::text || '/' || new.id::text || '/';
begin
  if new.photo_path is not null and new.photo_path not like v_prefix || '%' then
    raise exception 'Invalid photo';
  end if;
  if new.cover_path is not null and new.cover_path not like v_prefix || '%' then
    raise exception 'Invalid photo';
  end if;
  perform public.reject_blocked(new.school_id,
    array_to_string(new.skills, ' ') || ' ' || array_to_string(new.favorite_subjects, ' '));
  return new;
end;
$$;
create trigger check_extras before update of photo_path, cover_path, skills, favorite_subjects on public.profiles
  for each row execute function public.profiles_check_extras();

grant update (photo_path, cover_path, skills, favorite_subjects, accent) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Settings (one row per student, created the first time they save)
-- ---------------------------------------------------------------------------

create table public.profile_settings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  who_can_message text not null default 'everyone' check (who_can_message in ('everyone', 'friends', 'nobody')),
  notifications_enabled boolean not null default true,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  reduce_motion boolean not null default false,
  large_text boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.profile_settings enable row level security;
create policy "own settings" on public.profile_settings for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "create own settings" on public.profile_settings for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy "change own settings" on public.profile_settings for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
revoke delete on public.profile_settings from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Follows and friends
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followed_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index on public.follows (followed_id);
alter table public.follows enable row level security;
create policy "school sees follows" on public.follows for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "follow someone" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and public.is_active());
create policy "unfollow" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()));
revoke update on public.follows from authenticated;

create function public.follows_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t public.profiles;
begin
  select * into t from public.profiles where id = new.followed_id;
  if t.id is null or t.school_id <> public.my_school_id() or t.deactivated_at is not null then
    raise exception 'Student not found.';
  end if;
  if public.is_blocked_between(new.follower_id, new.followed_id) then
    raise exception 'You cannot follow this student.';
  end if;
  new.school_id := t.school_id;
  new.created_at := now();
  perform public.check_rate('follow', 100, 3600);
  perform public.notify(new.followed_id, 'follow', 'You have a new follower',
    (select full_name from public.profiles where id = new.follower_id) || ' started following you.',
    '/profile/' || new.follower_id);
  return new;
end;
$$;
create trigger before_insert before insert on public.follows
  for each row execute function public.follows_before_insert();

create table public.friendships (
  a_id uuid not null references public.profiles (id) on delete cascade,
  b_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  created_at timestamptz not null default now(),
  primary key (a_id, b_id),
  check (a_id < b_id)
);
create index on public.friendships (b_id);
alter table public.friendships enable row level security;
create policy "school sees friendships" on public.friendships for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.friendships from authenticated;

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_id <> to_id)
);
create unique index friend_requests_one_pending on public.friend_requests
  (least(from_id, to_id), greatest(from_id, to_id)) where status = 'pending';
create index on public.friend_requests (to_id, status);
alter table public.friend_requests enable row level security;
create policy "own friend requests" on public.friend_requests for select to authenticated
  using (from_id = (select auth.uid()) or to_id = (select auth.uid()));
revoke insert, update, delete on public.friend_requests from authenticated;

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships where a_id = least(a, b) and b_id = greatest(a, b))
$$;

create function public.send_friend_request(p_to uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  t public.profiles;
  v_existing public.friend_requests;
begin
  if not public.is_active() then
    raise exception 'Not allowed';
  end if;
  select * into me from public.profiles where id = auth.uid();
  select * into t from public.profiles where id = p_to and school_id = me.school_id
    and deactivated_at is null and onboarded_at is not null;
  if t.id is null or t.id = me.id then
    raise exception 'Student not found.';
  end if;
  if public.is_blocked_between(me.id, t.id) then
    raise exception 'You cannot send a request to this student.';
  end if;
  if public.are_friends(me.id, t.id) then
    raise exception 'You are already friends.';
  end if;
  select * into v_existing from public.friend_requests
  where status = 'pending' and least(from_id, to_id) = least(me.id, t.id) and greatest(from_id, to_id) = greatest(me.id, t.id);
  if v_existing.id is not null then
    if v_existing.from_id = me.id then
      raise exception 'You already sent a request. Please wait for an answer.';
    end if;
    -- They already asked you: sending one back accepts theirs.
    perform public.respond_friend_request(v_existing.id, true);
    return;
  end if;
  perform public.check_rate('friend_request', 30, 86400);
  insert into public.friend_requests (school_id, from_id, to_id) values (me.school_id, me.id, t.id);
  perform public.notify(t.id, 'friend_request', 'New friend request',
    me.full_name || ' wants to be friends.', '/friends');
end;
$$;

create function public.respond_friend_request(p_request uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.friend_requests;
begin
  if not public.is_active() then
    raise exception 'Not allowed';
  end if;
  select * into r from public.friend_requests where id = p_request and status = 'pending' for update;
  if r.id is null or r.to_id <> auth.uid() then
    raise exception 'Request not found.';
  end if;
  update public.friend_requests
  set status = case when p_accept then 'accepted' else 'rejected' end, responded_at = now()
  where id = r.id;
  if p_accept then
    insert into public.friendships (a_id, b_id, school_id)
    values (least(r.from_id, r.to_id), greatest(r.from_id, r.to_id), r.school_id)
    on conflict do nothing;
    perform public.notify(r.from_id, 'friend_accepted', 'Friend request accepted',
      (select full_name from public.profiles where id = r.to_id) || ' is now your friend.',
      '/profile/' || r.to_id);
  end if;
end;
$$;

create function public.cancel_friend_request(p_request uuid) returns void
language sql security definer set search_path = '' as $$
  update public.friend_requests set status = 'cancelled', responded_at = now()
  where id = p_request and from_id = auth.uid() and status = 'pending'
$$;

create function public.unfriend(p_other uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.friendships
  where a_id = least(auth.uid(), p_other) and b_id = greatest(auth.uid(), p_other)
$$;

-- Blocking someone ends every connection between the two of you.
create function public.blocks_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followed_id = new.blocked_id)
     or (follower_id = new.blocked_id and followed_id = new.blocker_id);
  delete from public.friendships
  where a_id = least(new.blocker_id, new.blocked_id) and b_id = greatest(new.blocker_id, new.blocked_id);
  update public.friend_requests set status = 'cancelled', responded_at = now()
  where status = 'pending' and least(from_id, to_id) = least(new.blocker_id, new.blocked_id)
    and greatest(from_id, to_id) = greatest(new.blocker_id, new.blocked_id);
  return null;
end;
$$;
create trigger after_insert after insert on public.blocks
  for each row execute function public.blocks_after_insert();

-- ---------------------------------------------------------------------------
-- 4. School-wide feed
-- ---------------------------------------------------------------------------

alter table public.posts alter column club_id drop not null;
alter table public.posts
  add column kind text not null default 'text' check (kind in ('text', 'photo', 'question', 'achievement', 'poll', 'repost')),
  add column repost_of uuid references public.posts (id) on delete set null,
  add column reaction_count int not null default 0,
  add column comment_count int not null default 0;
create index on public.posts (author_id, created_at desc);

-- A post with no club is for the whole school.
create or replace function public.posts_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.club_id is null then
    new.school_id := coalesce(public.my_school_id(), new.school_id);
  else
    select school_id into new.school_id from public.clubs where id = new.club_id;
  end if;
  new.status := case
    when public.contains_blocked_word(new.school_id, new.body) then 'held'
    else 'visible'
  end;
  new.reaction_count := 0;
  new.comment_count := 0;
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop policy "see posts" on public.posts;
create policy "see posts" on public.posts for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (status = 'visible' or author_id = (select auth.uid()))
    and (club_id is null or exists (select 1 from public.clubs c where c.id = posts.club_id and c.status = 'approved'))
  );
drop policy "club members post" on public.posts;
create policy "students post" on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid()) and public.is_active() and school_id = public.my_school_id()
    and (club_id is null or public.is_club_member(club_id))
    and (image_path is null or image_path like public.my_school_id()::text || '/' || (select auth.uid())::text || '/%')
  );

create table public.post_poll_options (
  post_id uuid not null references public.posts (id) on delete cascade,
  idx smallint not null check (idx between 0 and 5),
  label text not null check (char_length(label) between 1 and 80),
  primary key (post_id, idx)
);
alter table public.post_poll_options enable row level security;
create policy "see poll options" on public.post_poll_options for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
revoke insert, update, delete on public.post_poll_options from authenticated;

create table public.post_poll_votes (
  post_id uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  idx smallint not null,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id),
  foreign key (post_id, idx) references public.post_poll_options (post_id, idx) on delete cascade
);
alter table public.post_poll_votes enable row level security;
-- Votes are secret: you only see your own. Totals come from post_poll_results().
create policy "own poll votes" on public.post_poll_votes for select to authenticated
  using (profile_id = (select auth.uid()));
revoke insert, update, delete on public.post_poll_votes from authenticated;

-- Creates any kind of post in one step (poll options included).
create function public.create_post(
  p_body text, p_kind text, p_club uuid, p_image text, p_options text[], p_repost_of uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_school uuid := public.my_school_id();
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_opts text[];
  i int;
begin
  if not public.is_active() then
    raise exception 'Your account cannot post right now.';
  end if;
  if p_kind not in ('text', 'photo', 'question', 'achievement', 'poll', 'repost') then
    raise exception 'Unknown kind of post';
  end if;
  if p_club is not null and not public.is_club_member(p_club) then
    raise exception 'Join the club to post there.';
  end if;
  if p_image is not null and p_image not like v_school::text || '/' || v_me::text || '/%' then
    raise exception 'Invalid photo';
  end if;
  if p_kind = 'repost' then
    if not exists (select 1 from public.posts where id = p_repost_of and school_id = v_school and status = 'visible' and club_id is null) then
      raise exception 'That post cannot be shared.';
    end if;
    if v_body = '' then v_body := 'Shared a post'; end if;
  else
    p_repost_of := null;
  end if;
  if v_body = '' then
    raise exception 'Write something first.';
  end if;
  if p_kind = 'poll' then
    select array_agg(left(btrim(o), 80)) into v_opts from unnest(coalesce(p_options, '{}')) o where btrim(o) <> '';
    if coalesce(array_length(v_opts, 1), 0) < 2 or array_length(v_opts, 1) > 6 then
      raise exception 'A poll needs 2 to 6 choices.';
    end if;
    perform public.reject_blocked(v_school, array_to_string(v_opts, ' '));
  end if;

  insert into public.posts (school_id, club_id, author_id, body, image_path, kind, repost_of)
  values (v_school, p_club, v_me, left(v_body, 2000), p_image,
          case when p_kind = 'text' and p_image is not null then 'photo' else p_kind end, p_repost_of)
  returning id into v_id;

  if p_kind = 'poll' then
    for i in 1 .. array_length(v_opts, 1) loop
      insert into public.post_poll_options (post_id, idx, label) values (v_id, i - 1, v_opts[i]);
    end loop;
  end if;
  return v_id;
end;
$$;

create function public.vote_post_poll(p_post uuid, p_idx int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active() then
    raise exception 'Not allowed';
  end if;
  if not exists (select 1 from public.posts where id = p_post and school_id = public.my_school_id() and status = 'visible') then
    raise exception 'Poll not found.';
  end if;
  insert into public.post_poll_votes (post_id, profile_id, idx) values (p_post, auth.uid(), p_idx)
  on conflict (post_id, profile_id) do update set idx = excluded.idx, created_at = now();
end;
$$;

create function public.post_poll_results(p_posts uuid[])
returns table (post_id uuid, idx smallint, label text, votes bigint, mine boolean)
language sql stable security definer set search_path = '' as $$
  select o.post_id, o.idx, o.label,
         (select count(*) from public.post_poll_votes v where v.post_id = o.post_id and v.idx = o.idx),
         exists (select 1 from public.post_poll_votes v where v.post_id = o.post_id and v.idx = o.idx and v.profile_id = auth.uid())
  from public.post_poll_options o
  join public.posts p on p.id = o.post_id
  where o.post_id = any (p_posts) and p.school_id = public.my_school_id() and public.is_reader()
  order by o.post_id, o.idx
$$;

-- Reactions (one per student per post) -------------------------------------
create table public.post_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'like' check (kind in ('like', 'love', 'laugh', 'wow', 'sad', 'clap')),
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
alter table public.post_reactions enable row level security;
create policy "see reactions" on public.post_reactions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "react" on public.post_reactions for insert to authenticated
  with check (profile_id = (select auth.uid()) and public.is_active()
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'visible'));
create policy "change reaction" on public.post_reactions for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "remove reaction" on public.post_reactions for delete to authenticated
  using (profile_id = (select auth.uid()));
revoke update on public.post_reactions from authenticated;
grant update (kind) on public.post_reactions to authenticated;

create function public.post_reactions_count() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.posts;
begin
  if tg_op = 'INSERT' then
    perform public.check_rate('reaction', 200, 3600);
    update public.posts set reaction_count = reaction_count + 1 where id = new.post_id returning * into p;
    if p.author_id <> new.profile_id and not public.is_blocked_between(p.author_id, new.profile_id) then
      perform public.notify(p.author_id, 'reaction', 'Someone reacted to your post',
        (select full_name from public.profiles where id = new.profile_id) || ' reacted to your post.',
        '/post/' || p.id);
    end if;
    return new;
  end if;
  update public.posts set reaction_count = greatest(reaction_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;
create trigger count_insert before insert on public.post_reactions
  for each row execute function public.post_reactions_count();
create trigger count_delete after delete on public.post_reactions
  for each row execute function public.post_reactions_count();

-- Comments and replies -------------------------------------------------------
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  post_id uuid not null references public.posts (id) on delete cascade,
  parent_id uuid references public.post_comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'visible' check (status in ('visible', 'held', 'removed')),
  created_at timestamptz not null default now()
);
create index on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;
create policy "see comments" on public.post_comments for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (status = 'visible' or author_id = (select auth.uid()))
    and exists (select 1 from public.posts p where p.id = post_id)
  );
create policy "comment" on public.post_comments for insert to authenticated
  with check (
    author_id = (select auth.uid()) and public.is_active() and school_id = public.my_school_id()
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'visible')
  );
create policy "delete own comments" on public.post_comments for delete to authenticated
  using (author_id = (select auth.uid()));
revoke update on public.post_comments from authenticated;

create function public.post_comments_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.posts;
  v_parent public.post_comments;
begin
  select * into p from public.posts where id = new.post_id;
  new.school_id := p.school_id;
  if new.parent_id is not null then
    select * into v_parent from public.post_comments where id = new.parent_id;
    if v_parent.id is null or v_parent.post_id <> new.post_id then
      raise exception 'Comment not found.';
    end if;
    -- Replies stay one level deep.
    new.parent_id := coalesce(v_parent.parent_id, v_parent.id);
  end if;
  if public.is_blocked_between(p.author_id, new.author_id) then
    raise exception 'You cannot comment on this post.';
  end if;
  new.status := case when public.contains_blocked_word(new.school_id, new.body) then 'held' else 'visible' end;
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  return new;
end;
$$;
create trigger before_insert before insert on public.post_comments
  for each row execute function public.post_comments_before_insert();
create trigger guard before insert on public.post_comments for each row
  execute function public.guard_activity('comment', '30', '600', 'commenting');

create function public.post_comments_after_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.posts;
  v_name text;
  v_parent_author uuid;
begin
  if tg_op = 'DELETE' then
    if old.status = 'visible' then
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    end if;
    return old;
  end if;
  if new.status = 'held' then
    insert into public.reports (school_id, target_type, target_id, target_author_id, reason, snapshot)
    values (new.school_id, 'comment', new.id, new.author_id, 'filter', new.body);
    return new;
  end if;
  update public.posts set comment_count = comment_count + 1 where id = new.post_id returning * into p;
  select full_name into v_name from public.profiles where id = new.author_id;
  if new.parent_id is not null then
    select author_id into v_parent_author from public.post_comments where id = new.parent_id;
    if v_parent_author <> new.author_id and not public.is_blocked_between(v_parent_author, new.author_id) then
      perform public.notify(v_parent_author, 'reply', 'New reply to your comment',
        v_name || ': ' || left(new.body, 120), '/post/' || p.id);
    end if;
  end if;
  if p.author_id <> new.author_id and p.author_id is distinct from v_parent_author then
    perform public.notify(p.author_id, 'comment', 'New comment on your post',
      v_name || ': ' || left(new.body, 120), '/post/' || p.id);
  end if;
  return new;
end;
$$;
create trigger after_insert after insert on public.post_comments
  for each row execute function public.post_comments_after_change();
create trigger after_delete after delete on public.post_comments
  for each row execute function public.post_comments_after_change();

-- Saves (private bookmarks) --------------------------------------------------
create table public.post_saves (
  post_id uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
create index on public.post_saves (profile_id, created_at desc);
alter table public.post_saves enable row level security;
create policy "own saves" on public.post_saves for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "save a post" on public.post_saves for insert to authenticated
  with check (profile_id = (select auth.uid()) and public.is_reader()
    and exists (select 1 from public.posts p where p.id = post_id));
create policy "unsave" on public.post_saves for delete to authenticated
  using (profile_id = (select auth.uid()));
revoke update on public.post_saves from authenticated;

-- Hashtags and mentions ------------------------------------------------------
create table public.post_tags (
  post_id uuid not null references public.posts (id) on delete cascade,
  tag text not null check (char_length(tag) between 2 and 40),
  school_id uuid not null references public.schools (id),
  created_at timestamptz not null default now(),
  primary key (post_id, tag)
);
create index on public.post_tags (school_id, tag, created_at desc);
alter table public.post_tags enable row level security;
create policy "see tags" on public.post_tags for select to authenticated
  using (school_id = public.my_school_id() and exists (select 1 from public.posts p where p.id = post_id));
revoke insert, update, delete on public.post_tags from authenticated;

-- Tells every @handle in a text about it (at most 10, never yourself).
create function public.notify_mentions(p_school uuid, p_author uuid, p_text text, p_link text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_name text;
begin
  select full_name into v_name from public.profiles where id = p_author;
  for r in
    select distinct p.id from regexp_matches(lower(p_text), '@([a-z0-9_]{2,24})', 'g') m
    join public.profiles p on p.school_id = p_school and p.handle = m[1]
    where p.id <> p_author and p.deactivated_at is null
      and not public.is_blocked_between(p.id, p_author)
    limit 10
  loop
    perform public.notify(r.id, 'mention', v_name || ' mentioned you', left(p_text, 120), p_link);
  end loop;
end;
$$;

create function public.posts_extract() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'visible' then
    return new;
  end if;
  insert into public.post_tags (post_id, tag, school_id)
  select distinct new.id, left(m[1], 40), new.school_id
  from regexp_matches(lower(new.body), '#([[:alnum:]_]{2,40})', 'g') m
  limit 10
  on conflict do nothing;
  perform public.notify_mentions(new.school_id, new.author_id, new.body, '/post/' || new.id);
  if new.repost_of is not null then
    perform public.notify((select author_id from public.posts where id = new.repost_of and author_id <> new.author_id),
      'repost', 'Your post was shared',
      (select full_name from public.profiles where id = new.author_id) || ' shared your post.', '/post/' || new.id);
  end if;
  return new;
end;
$$;
create trigger extract after insert on public.posts
  for each row execute function public.posts_extract();

create function public.comments_mentions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'visible' then
    perform public.notify_mentions(new.school_id, new.author_id, new.body, '/post/' || new.post_id);
  end if;
  return new;
end;
$$;
create trigger mentions after insert on public.post_comments
  for each row execute function public.comments_mentions();

-- The feed: relevance first, but new posts always get a turn.
--   + engagement      2 x ln(1 + reactions + 2 x comments)
--   + people you know friend +4, someone you follow +3, your club +2, you +1
--   + fresh           +3 during the first 6 hours (so quiet new posts are seen)
--   - age             1 point per 12 hours
create function public.feed_posts(p_limit int, p_offset int, p_tag text default null)
returns setof public.posts
language sql stable set search_path = '' as $$
  select p.*
  from public.posts p
  where p.status = 'visible'
    and (p.club_id is null or public.is_club_member(p.club_id))
    and not public.is_blocked_between(p.author_id, (select auth.uid()))
    and (p_tag is null or exists (select 1 from public.post_tags t where t.post_id = p.id and t.tag = lower(p_tag)))
    and p.created_at > now() - interval '120 days'
  order by
    2 * ln(1 + p.reaction_count + 2 * p.comment_count)
    + case
        when p.author_id = (select auth.uid()) then 1
        when public.are_friends(p.author_id, (select auth.uid())) then 4
        when exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followed_id = p.author_id) then 3
        else 0
      end
    + case when p.club_id is not null then 2 else 0 end
    + case when p.created_at > now() - interval '6 hours' then 3 else 0 end
    - extract(epoch from now() - p.created_at) / 43200.0 desc,
    p.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

create function public.trending_tags(p_limit int default 8)
returns table (tag text, posts bigint)
language sql stable security definer set search_path = '' as $$
  select t.tag, count(*) from public.post_tags t
  where t.school_id = public.my_school_id() and public.is_reader()
    and t.created_at > now() - interval '14 days'
  group by t.tag order by count(*) desc, t.tag limit least(p_limit, 30)
$$;

-- ---------------------------------------------------------------------------
-- 5. Notifications respect the on/off switch
-- ---------------------------------------------------------------------------

alter table public.notifications add column silent boolean not null default false;

-- With notifications off, nothing is pushed to the phone and the bell stays
-- quiet. The entry is still kept, so it is there when the student opens Loop.
create function public.notifications_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profile_settings where profile_id = new.recipient_id and not notifications_enabled) then
    new.silent := true;
    new.pushed_at := now();
  end if;
  return new;
end;
$$;
create trigger before_insert before insert on public.notifications
  for each row execute function public.notifications_before_insert();

-- ---------------------------------------------------------------------------
-- 6. Chats: groups, message requests, attachments, reactions
-- ---------------------------------------------------------------------------

alter table public.conversations drop constraint conversations_kind_check;
alter table public.conversations add constraint conversations_kind_check check (kind in ('club', 'direct', 'group'));
alter table public.conversations
  add column title text check (char_length(title) between 1 and 60),
  add column created_by uuid references public.profiles (id) on delete set null;

alter table public.conversation_members
  add column role text not null default 'member' check (role in ('admin', 'member')),
  -- Null while a message request is waiting for this person's answer.
  add column accepted_at timestamptz default now();

alter table public.messages drop constraint messages_body_check;
alter table public.messages
  add column attachment_path text,
  add column attachment_kind text check (attachment_kind in ('image', 'video', 'audio', 'file')),
  add column attachment_name text check (char_length(attachment_name) <= 120),
  add constraint messages_body_check check (char_length(body) <= 2000 and (body <> '' or attachment_path is not null)),
  add constraint messages_attachment_check check ((attachment_path is null) = (attachment_kind is null));

-- Private bucket for chat files: "<conversation id>/<user id>/<file>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 10485760, array[
  'image/webp', 'image/jpeg', 'image/png', 'image/gif',
  'video/mp4', 'video/webm', 'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
  'application/pdf', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create policy "upload chat files" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-files' and public.is_active()
    and public.is_conversation_member(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
create policy "see chat files" on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-files' and public.is_reader()
    and public.is_conversation_member(((storage.foldername(name))[1])::uuid)
  );
create policy "delete own chat files" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-files' and (storage.foldername(name))[2] = (select auth.uid())::text);

create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kind text;
begin
  select school_id, kind into new.school_id, v_kind from public.conversations where id = new.conversation_id;
  if new.attachment_path is not null
     and new.attachment_path not like new.conversation_id::text || '/' || new.sender_id::text || '/%' then
    raise exception 'Invalid attachment';
  end if;
  -- A message request: one message, then wait for the answer.
  if v_kind = 'direct' and auth.uid() is not null then
    if exists (select 1 from public.conversation_members
               where conversation_id = new.conversation_id and profile_id = new.sender_id and accepted_at is null) then
      raise exception 'Accept the message request before you reply.';
    end if;
    if exists (select 1 from public.conversation_members
               where conversation_id = new.conversation_id and profile_id <> new.sender_id and accepted_at is null)
       and exists (select 1 from public.messages where conversation_id = new.conversation_id and sender_id = new.sender_id) then
      raise exception 'Your message request was sent. You can write again once it is accepted.';
    end if;
  end if;
  new.status := case
    when public.contains_blocked_word(new.school_id, new.body) then 'held'
    else 'visible'
  end;
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

-- Respects the other student's "who can message me" choice.
create or replace function public.start_direct_conversation(p_other uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_conversation uuid;
  v_who text;
  v_friends boolean;
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
  if v_conversation is not null then
    return v_conversation;
  end if;

  select coalesce((select who_can_message from public.profile_settings where profile_id = p_other), 'everyone') into v_who;
  v_friends := public.are_friends(auth.uid(), p_other);
  if v_who = 'nobody' then
    raise exception 'This student is not accepting new messages.';
  end if;
  perform public.check_rate('new_chat', 20, 86400);

  insert into public.conversations (school_id, kind, created_by) values (v_school, 'direct', auth.uid())
  returning id into v_conversation;
  insert into public.conversation_members (conversation_id, profile_id, accepted_at)
  values (v_conversation, auth.uid(), now()),
         (v_conversation, p_other, case when v_who = 'everyone' or v_friends then now() end);
  if v_who = 'friends' and not v_friends then
    perform public.notify(p_other, 'message_request', 'New message request',
      (select full_name from public.profiles where id = auth.uid()) || ' wants to message you.', '/messages');
  end if;
  return v_conversation;
end;
$$;

create function public.respond_message_request(p_conversation uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.conversation_members
                 where conversation_id = p_conversation and profile_id = auth.uid() and accepted_at is null) then
    raise exception 'Request not found.';
  end if;
  if p_accept then
    update public.conversation_members set accepted_at = now()
    where conversation_id = p_conversation and profile_id = auth.uid();
  else
    delete from public.conversations where id = p_conversation and kind = 'direct';
  end if;
end;
$$;

-- Group chats: only friends, or students who accept messages from everyone, can be added.
create function public.create_group_conversation(p_title text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_id uuid;
  v_title text := left(btrim(coalesce(p_title, '')), 60);
begin
  if not public.is_active() or not public.is_current_student(auth.uid()) then
    raise exception 'Your account cannot create group chats.';
  end if;
  if public.is_restricted('creating_groups') then
    raise exception 'RESTRICTED: An admin has paused this on your account for now.';
  end if;
  if char_length(v_title) < 2 then
    raise exception 'Give the group a name.';
  end if;
  if coalesce(array_length(p_members, 1), 0) < 1 or array_length(p_members, 1) > 30 then
    raise exception 'Choose 1 to 30 people.';
  end if;
  perform public.reject_blocked(v_school, v_title);
  perform public.check_rate('group_chat', 5, 86400);

  insert into public.conversations (school_id, kind, title, created_by) values (v_school, 'group', v_title, auth.uid())
  returning id into v_id;
  insert into public.conversation_members (conversation_id, profile_id, role) values (v_id, auth.uid(), 'admin');
  perform public.add_group_members(v_id, p_members);
  if (select count(*) from public.conversation_members where conversation_id = v_id) < 2 then
    raise exception 'None of these students can be added. You can add friends, or students who accept messages from everyone.';
  end if;
  return v_id;
end;
$$;

create function public.add_group_members(p_conversation uuid, p_members uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_added int;
begin
  if not public.is_active() or not exists (
    select 1 from public.conversation_members cm join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = p_conversation and cm.profile_id = auth.uid() and cm.role = 'admin' and c.kind = 'group'
  ) then
    raise exception 'Only the group admin can add people.';
  end if;
  if (select count(*) from public.conversation_members where conversation_id = p_conversation)
     + coalesce(array_length(p_members, 1), 0) > 50 then
    raise exception 'A group can have up to 50 people.';
  end if;
  with added as (
    insert into public.conversation_members (conversation_id, profile_id)
    select p_conversation, p.id
    from public.profiles p
    where p.id = any (p_members) and p.id <> auth.uid()
      and p.school_id = public.my_school_id() and p.deactivated_at is null and p.onboarded_at is not null
      and public.is_current_student(p.id)
      and not public.is_blocked_between(p.id, auth.uid())
      and (public.are_friends(p.id, auth.uid())
           or coalesce((select s.who_can_message from public.profile_settings s where s.profile_id = p.id), 'everyone') = 'everyone')
    on conflict do nothing
    returning profile_id
  )
  select count(*) into v_added from added;
  insert into public.notifications (school_id, recipient_id, kind, title, body, link)
  select public.my_school_id(), p.id, 'group_added', 'You were added to a group chat',
         (select title from public.conversations where id = p_conversation), '/messages/' || p_conversation
  from public.profiles p
  join public.conversation_members cm on cm.profile_id = p.id and cm.conversation_id = p_conversation
  where p.id = any (p_members) and cm.last_read_at > now() - interval '5 seconds';
  return v_added;
end;
$$;

create function public.leave_conversation(p_conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.conversations where id = p_conversation and kind = 'group') then
    raise exception 'You can only leave group chats.';
  end if;
  delete from public.conversation_members where conversation_id = p_conversation and profile_id = auth.uid();
  -- Keep one admin; an empty group is removed.
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation) then
    delete from public.conversations where id = p_conversation;
  elsif not exists (select 1 from public.conversation_members where conversation_id = p_conversation and role = 'admin') then
    update public.conversation_members set role = 'admin'
    where conversation_id = p_conversation
      and profile_id = (select profile_id from public.conversation_members where conversation_id = p_conversation order by last_read_at limit 1);
  end if;
end;
$$;

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '👏')),
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);
create index on public.message_reactions (conversation_id);
alter table public.message_reactions enable row level security;
create policy "see message reactions" on public.message_reactions for select to authenticated
  using (public.is_conversation_member(conversation_id) and public.is_reader());
create policy "react to messages" on public.message_reactions for insert to authenticated
  with check (profile_id = (select auth.uid()) and public.is_active() and public.is_conversation_member(conversation_id)
    and exists (select 1 from public.messages m where m.id = message_id and m.conversation_id = message_reactions.conversation_id));
create policy "change message reaction" on public.message_reactions for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "remove message reaction" on public.message_reactions for delete to authenticated
  using (profile_id = (select auth.uid()));
revoke update on public.message_reactions from authenticated;
grant update (emoji) on public.message_reactions to authenticated;
alter publication supabase_realtime add table public.message_reactions;

-- ---------------------------------------------------------------------------
-- 7. Your own account: pause it, come back, or delete it for good
-- ---------------------------------------------------------------------------

create function public.deactivate_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and is_owner) then
    raise exception 'The platform owner cannot deactivate their account.';
  end if;
  update public.profiles set deactivated_at = now(), self_deactivated = true
  where id = auth.uid() and deactivated_at is null;
end;
$$;

create function public.reactivate_my_account() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set deactivated_at = null, self_deactivated = false
  where id = auth.uid() and self_deactivated
$$;

-- Removes the account and everything it owns. Cannot be undone.
create function public.delete_my_account(p_confirm text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'Not signed in';
  end if;
  if p_confirm is distinct from 'DELETE' then
    raise exception 'Type DELETE to confirm.';
  end if;
  if me.is_owner then
    raise exception 'The platform owner cannot delete their account.';
  end if;
  insert into public.moderation_log (school_id, actor_id, action, target_type, target_id, details)
  values (me.school_id, null, 'delete_own_account', 'profile', me.id, 'A ' || me.role || ' deleted their own account');
  delete from auth.users where id = me.id;
end;
$$;


-- ---------------------------------------------------------------------------
-- 8. Reports can now be about comments; the bell ignores silent entries
-- ---------------------------------------------------------------------------

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'message', 'profile', 'club', 'event', 'listing', 'question', 'answer', 'comment'));

create or replace function public.my_badges() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'notifications', (
      select count(*) from public.notifications
      where recipient_id = auth.uid() and read_at is null and not silent
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
  elsif new.target_type = 'comment' then
    select school_id, author_id, body
      into v_school, new.target_author_id, new.snapshot
    from public.post_comments where id = new.target_id;
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
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'removed' where id = r.target_id and status = 'visible';
      if found then
        update public.posts set comment_count = greatest(comment_count - 1, 0)
        where id = (select post_id from public.post_comments where id = r.target_id);
      else
        update public.post_comments set status = 'removed' where id = r.target_id;
      end if;
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
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'visible' where id = r.target_id and status = 'held';
      if found then
        update public.posts set comment_count = comment_count + 1
        where id = (select post_id from public.post_comments where id = r.target_id);
      end if;
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
-- 9. Who may call what
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
do $$
declare f text;
begin
  -- Internal helpers and trigger functions: never callable from the website.
  foreach f in array array[
    'make_handle(uuid, text, uuid)', 'set_handle()', 'profiles_check_extras()', 'follows_before_insert()',
    'blocks_after_insert()', 'post_reactions_count()', 'post_comments_before_insert()', 'post_comments_after_change()',
    'notify_mentions(uuid, uuid, text, text)', 'posts_extract()', 'comments_mentions()', 'notifications_before_insert()'
  ] loop
    execute 'revoke execute on function public.' || f || ' from authenticated';
  end loop;
  foreach f in array array[
    'are_friends(uuid, uuid)', 'send_friend_request(uuid)', 'respond_friend_request(uuid, boolean)',
    'cancel_friend_request(uuid)', 'unfriend(uuid)',
    'create_post(text, text, uuid, text, text[], uuid)', 'vote_post_poll(uuid, int)', 'post_poll_results(uuid[])',
    'feed_posts(int, int, text)', 'trending_tags(int)',
    'respond_message_request(uuid, boolean)', 'create_group_conversation(text, uuid[])',
    'add_group_members(uuid, uuid[])', 'leave_conversation(uuid)',
    'deactivate_my_account()', 'reactivate_my_account()', 'delete_my_account(text)'
  ] loop
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
