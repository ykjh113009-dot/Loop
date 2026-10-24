-- =============================================================================
-- Pbs Go: security rules (Row Level Security), file storage, live updates,
-- scheduled jobs, and starter data.
-- =============================================================================

-- Nobody who is signed out can touch any table.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- These run inside the database only, never called directly by the app.
revoke execute on function public.notify(uuid, text, text, text, text) from authenticated;
revoke execute on function public.log_action(uuid, text, text, uuid, text) from authenticated;
revoke execute on function public.notify_club_about_event(uuid) from authenticated;
revoke execute on function public.send_event_reminders() from authenticated;
revoke execute on function public.claim_push_batch(int) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.roster enable row level security;
alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.posts enable row level security;
alter table public.announcements enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reports enable row level security;
alter table public.blocked_words enable row level security;
alter table public.moderation_log enable row level security;

-- schools ---------------------------------------------------------------
create policy "see own school" on public.schools for select to authenticated
  using (id = public.my_school_id());
create policy "admins edit school" on public.schools for update to authenticated
  using (id = public.my_school_id() and public.is_admin())
  with check (id = public.my_school_id());
revoke update on public.schools from authenticated;
grant update (name, grades, roster_required) on public.schools to authenticated;

-- profiles --------------------------------------------------------------
create policy "see classmates" on public.profiles for select to authenticated
  using (id = auth.uid() or (school_id = public.my_school_id() and public.is_reader()));
-- Students may only change their own avatar and bio. Grade, role and
-- suspension are changed through the admin actions.
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_reader()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from authenticated;
grant update (avatar, bio) on public.profiles to authenticated;

create policy "own email or admin" on public.private_profiles for select to authenticated
  using (
    id = auth.uid()
    or (public.is_admin() and exists (
      select 1 from public.profiles p where p.id = private_profiles.id and p.school_id = public.my_school_id()
    ))
  );
revoke insert, update, delete on public.private_profiles from authenticated;

create policy "admins manage roster" on public.roster for all to authenticated
  using (school_id = public.my_school_id() and public.is_admin())
  with check (school_id = public.my_school_id() and public.is_admin());

-- interests -------------------------------------------------------------
create policy "anyone signed in sees interests" on public.interests for select to authenticated
  using (true);
revoke insert, update, delete on public.interests from authenticated;

create policy "see interests of classmates" on public.profile_interests for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = profile_interests.profile_id and p.school_id = public.my_school_id()
  ));
revoke insert, update, delete on public.profile_interests from authenticated;

-- clubs -----------------------------------------------------------------
create policy "see clubs" on public.clubs for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (status = 'approved' or requested_by = auth.uid() or public.is_staff())
  );
create policy "request a club" on public.clubs for insert to authenticated
  with check (
    public.is_active() and school_id = public.my_school_id()
    and requested_by = auth.uid() and status = 'pending'
  );
revoke update, delete on public.clubs from authenticated;

create policy "see club members" on public.club_members for select to authenticated
  using (exists (
    select 1 from public.clubs c where c.id = club_members.club_id and c.school_id = public.my_school_id()
  ) and public.is_reader());
create policy "join a club" on public.club_members for insert to authenticated
  with check (
    profile_id = auth.uid() and role = 'member' and public.is_active()
    and exists (
      select 1 from public.clubs c
      where c.id = club_members.club_id and c.school_id = public.my_school_id() and c.status = 'approved'
    )
  );
create policy "leave a club" on public.club_members for delete to authenticated
  using (profile_id = auth.uid());
revoke update on public.club_members from authenticated;

-- posts -----------------------------------------------------------------
create policy "see posts" on public.posts for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (status = 'visible' or author_id = auth.uid())
    and exists (select 1 from public.clubs c where c.id = posts.club_id and c.status = 'approved')
  );
create policy "club members post" on public.posts for insert to authenticated
  with check (
    author_id = auth.uid() and public.is_active() and school_id = public.my_school_id()
    and public.is_club_member(club_id)
    and (image_path is null or image_path like public.my_school_id()::text || '/' || auth.uid()::text || '/%')
  );
create policy "delete own posts" on public.posts for delete to authenticated
  using (author_id = auth.uid());
revoke update on public.posts from authenticated;

-- announcements ---------------------------------------------------------
create policy "see announcements" on public.announcements for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "admins post announcements" on public.announcements for insert to authenticated
  with check (school_id = public.my_school_id() and public.is_admin() and author_id = auth.uid());
create policy "admins delete announcements" on public.announcements for delete to authenticated
  using (school_id = public.my_school_id() and public.is_admin());
revoke update on public.announcements from authenticated;

-- chats -----------------------------------------------------------------
create policy "see own chats" on public.conversations for select to authenticated
  using (public.is_conversation_member(id) and public.is_reader());
revoke insert, update, delete on public.conversations from authenticated;

create policy "see chat members" on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy "mark chat as read" on public.conversation_members for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
revoke insert, update, delete on public.conversation_members from authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

-- Moderators never read private chats directly. They only see the copy of a
-- message that someone reported (and only admins see reported private messages).
create policy "see messages in own chats" on public.messages for select to authenticated
  using (
    public.is_conversation_member(conversation_id) and public.is_reader()
    and (status = 'visible' or sender_id = auth.uid())
  );
create policy "send messages" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid() and public.is_active() and school_id = public.my_school_id()
    and public.is_conversation_member(conversation_id)
    -- In a private chat, nobody can message someone who blocked them.
    and not exists (
      select 1 from public.conversation_members other
      join public.conversations c on c.id = other.conversation_id
      where other.conversation_id = messages.conversation_id and c.kind = 'direct'
        and other.profile_id <> auth.uid()
        and public.is_blocked_between(auth.uid(), other.profile_id)
    )
  );
revoke update, delete on public.messages from authenticated;

create policy "own blocks" on public.blocks for select to authenticated
  using (blocker_id = auth.uid());
create policy "block someone" on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid() and exists (
    select 1 from public.profiles p where p.id = blocks.blocked_id and p.school_id = public.my_school_id()
  ));
create policy "unblock someone" on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- events ----------------------------------------------------------------
create policy "see events" on public.events for select to authenticated
  using (
    school_id = public.my_school_id() and public.is_reader()
    and (status in ('approved', 'cancelled') or created_by = auth.uid() or public.is_staff()
         or (club_id is not null and public.is_club_leader(club_id)))
  );
-- Club leaders suggest events for their club (a moderator approves them).
-- Moderators and admins can also add school-wide events.
create policy "create events" on public.events for insert to authenticated
  with check (
    public.is_active() and school_id = public.my_school_id() and created_by = auth.uid()
    and ((club_id is null and public.is_staff()) or (club_id is not null and public.is_club_leader(club_id)))
  );
revoke update, delete on public.events from authenticated;

create policy "see who is going" on public.event_rsvps for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
create policy "rsvp" on public.event_rsvps for insert to authenticated
  with check (
    profile_id = auth.uid() and public.is_active()
    and exists (
      select 1 from public.events e
      where e.id = event_rsvps.event_id and e.school_id = public.my_school_id()
        and e.status = 'approved' and e.starts_at > now()
    )
  );
create policy "cancel rsvp" on public.event_rsvps for delete to authenticated
  using (profile_id = auth.uid());
revoke update on public.event_rsvps from authenticated;

-- notifications ---------------------------------------------------------
create policy "own notifications" on public.notifications for select to authenticated
  using (recipient_id = auth.uid());
create policy "mark notifications read" on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "delete own notifications" on public.notifications for delete to authenticated
  using (recipient_id = auth.uid());
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- reports ---------------------------------------------------------------
create policy "send reports" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_reader());
create policy "see reports" on public.reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or (school_id = public.my_school_id() and public.is_staff() and (not admin_only or public.is_admin()))
  );
revoke update, delete on public.reports from authenticated;

-- blocked words ---------------------------------------------------------
create policy "staff see word list" on public.blocked_words for select to authenticated
  using (public.is_staff() and (school_id is null or school_id = public.my_school_id()));
create policy "admins add words" on public.blocked_words for insert to authenticated
  with check (public.is_admin() and school_id = public.my_school_id());
create policy "admins remove words" on public.blocked_words for delete to authenticated
  using (public.is_admin() and school_id = public.my_school_id());
revoke update on public.blocked_words from authenticated;

create policy "staff see moderation log" on public.moderation_log for select to authenticated
  using (school_id = public.my_school_id() and public.is_staff());
revoke insert, update, delete on public.moderation_log from authenticated;

-- ---------------------------------------------------------------------------
-- File storage for post photos. Files live in "<school id>/<user id>/..."
-- and only students of the same school can open them.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "upload own post photos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-images' and public.is_active()
    and (storage.foldername(name))[1] = public.my_school_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy "see school post photos" on storage.objects for select to authenticated
  using (
    bucket_id = 'post-images' and public.is_reader()
    and (storage.foldername(name))[1] = public.my_school_id()::text
  );
create policy "delete own post photos" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[2] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Live updates (chat messages, RSVP counts, notification badge)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.event_rsvps, public.notifications;

-- ---------------------------------------------------------------------------
-- Scheduled job: event reminders every 10 minutes
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
select cron.schedule('event-reminders', '*/10 * * * *', 'select public.send_event_reminders()');

-- ---------------------------------------------------------------------------
-- Starter data shared by every school
-- ---------------------------------------------------------------------------
insert into public.interests (slug, name, emoji) values
  ('football', 'Football', '⚽'),
  ('basketball', 'Basketball', '🏀'),
  ('volleyball', 'Volleyball', '🏐'),
  ('running', 'Running', '🏃'),
  ('chess', 'Chess', '♟️'),
  ('coding', 'Coding', '💻'),
  ('robotics', 'Robotics', '🤖'),
  ('science', 'Science', '🔬'),
  ('math', 'Math puzzles', '🧮'),
  ('reading', 'Reading', '📚'),
  ('writing', 'Writing & poetry', '✍️'),
  ('debate', 'Debate', '🎤'),
  ('languages', 'Languages', '🗣️'),
  ('drawing', 'Drawing', '🎨'),
  ('photography', 'Photography', '📷'),
  ('film', 'Film & video', '🎬'),
  ('music', 'Music', '🎵'),
  ('singing', 'Singing', '🎙️'),
  ('dabke', 'Dabke & dance', '💃'),
  ('theatre', 'Theatre', '🎭'),
  ('cooking', 'Cooking', '🍳'),
  ('gaming', 'Gaming', '🎮'),
  ('volunteering', 'Volunteering', '🤝'),
  ('environment', 'Environment', '🌱'),
  ('entrepreneurship', 'Business ideas', '💡'),
  ('history', 'History & heritage', '🏛️'),
  ('embroidery', 'Tatreez & crafts', '🧵'),
  ('fitness', 'Fitness', '💪');

-- A starter list of blocked words in English, Arabic and Arabizi (Arabic typed
-- in English letters). Admins can add more from the dashboard.
insert into public.blocked_words (school_id, word) values
  (null, 'fuck'), (null, 'fck'), (null, 'fuk'), (null, 'shit'), (null, 'bitch'),
  (null, 'bastard'), (null, 'asshole'), (null, 'ass'), (null, 'dick'), (null, 'pussy'),
  (null, 'cunt'), (null, 'slut'), (null, 'whore'), (null, 'porn'), (null, 'nude'),
  (null, 'nudes'), (null, 'retard'), (null, 'faggot'), (null, 'nigger'), (null, 'nigga'),
  (null, 'kill yourself'), (null, 'kys'),
  (null, 'شرموط'), (null, 'شرموطة'), (null, 'شرموطه'), (null, 'عرص'), (null, 'منيك'),
  (null, 'منيوك'), (null, 'نيك'), (null, 'كس'), (null, 'كسمك'), (null, 'كس امك'),
  (null, 'زب'), (null, 'قحبة'), (null, 'قحبه'), (null, 'خول'), (null, 'طيز'),
  (null, 'ابن الكلب'), (null, 'يلعن ابوك'), (null, 'متناك'), (null, 'لوطي'),
  (null, 'sharmoot'), (null, 'sharmota'), (null, 'sharmouta'), (null, 'sharmuta'),
  (null, '3ars'), (null, 'manyak'), (null, 'manyok'), (null, 'kos omak'), (null, 'kosomak'),
  (null, 'kusomak'), (null, 'ksomak'), (null, 'zeb'), (null, 'zib'), (null, 'ka7ba'),
  (null, 'a7a'), (null, 'teez'), (null, 'khawal'), (null, 'ibn el kalb'), (null, 'yel3an');
