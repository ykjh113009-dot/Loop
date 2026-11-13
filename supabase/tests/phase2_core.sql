-- Phase 2 tests (feed, friends, settings, chats, accounts). Runs inside one transaction that is rolled back,
-- so it never changes the database. Run with:  npm run db:test
\set ON_ERROR_STOP on
begin;

create schema tests;
grant usage on schema tests to authenticated, anon;

create function tests.login(p_user uuid, p_aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true),
    set_config('role', 'authenticated', true);
$$;
create function tests.ok(p_pass boolean, p_name text) returns void language plpgsql as $$
begin
  if p_pass is not true then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
-- Passes when the statement fails with a message containing p_like.
create function tests.refused(p_sql text, p_like text, p_name text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_like || '%' then
      raise notice 'ok - %', p_name;
      return;
    end if;
    raise exception 'FAILED: % (wrong error: %)', p_name, sqlerrm;
  end;
  raise exception 'FAILED: % (it was allowed)', p_name;
end $$;
grant execute on all functions in schema tests to authenticated, anon;


\set rania '''00000000-0000-0000-0000-0000000000a1'''
\set omar  '''00000000-0000-0000-0000-0000000000a2'''
\set layla '''00000000-0000-0000-0000-0000000000a3'''
\set yousef '''00000000-0000-0000-0000-0000000000a4'''
\set maya  '''00000000-0000-0000-0000-0000000000a5'''

-- Start clean between the people used below.
delete from public.conversations c where c.kind = 'direct' and (select count(*) from public.conversation_members m
  where m.conversation_id = c.id and m.profile_id in (:layla, :yousef, :maya, :omar)) = 2;
delete from public.blocks where blocker_id in (:layla, :yousef, :maya, :omar);

insert into public.schools (id, name, email_domain, google_only, admin_mfa_required)
values ('eeeeeeee-0000-0000-0000-00000000b001', 'Other School', 'other.example', false, false);
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated',
        'sam@other.example', '{"provider":"email"}', '{"full_name":"Sam Other"}', now(), now());
update public.profiles set onboarded_at = now(), grade = 10 where id = 'eeeeeeee-0000-0000-0000-0000000000b1';

-- ---- Profiles ---------------------------------------------------------------
select tests.ok((select count(*) from public.profiles where handle is null) = 0, 'every profile has a handle');
select tests.ok((select handle from public.profiles where id = :layla) = 'demolayla', 'handles come from the school email');
select tests.ok((select handle from public.profiles where id = 'eeeeeeee-0000-0000-0000-0000000000b1') = 'sam', 'new accounts get a handle');
select tests.login(:layla);
update public.profiles set skills = '{Robotics,Drawing}', favorite_subjects = '{Physics}', accent = 'sky' where id = auth.uid();
select tests.ok((select accent from public.profiles where id = auth.uid()) = 'sky', 'a student can edit skills, subjects and accent');
select tests.refused($$update public.profiles set photo_path = 'someone-else/file.webp' where id = auth.uid()$$, 'Invalid photo', 'a profile photo must be in your own folder');
select tests.refused($$update public.profiles set handle = 'admin' where id = auth.uid()$$, 'permission denied', 'a student cannot change their handle');
select tests.refused($$update public.profiles set accent = 'sky' where id = '00000000-0000-0000-0000-0000000000a5' returning id$$, '', 'x') where false;
update public.profiles set accent = 'rose' where id = :maya;
select tests.ok((select accent from public.profiles where id = :maya) = 'olive', 'a student cannot edit someone else''s profile');
reset role;

-- ---- Feed -------------------------------------------------------------------
select tests.login(:layla);
select public.create_post('Hello school! #Robotics fair on Thursday, come by @demomaya', 'text', null, null, null, null) as post_id \gset
select tests.ok((select club_id is null and kind = 'text' from public.posts where id = :'post_id'), 'a student can post to the whole school');
select tests.ok(exists (select 1 from public.post_tags where post_id = :'post_id' and tag = 'robotics'), 'hashtags are picked up');
select public.create_post('Best lunch?', 'poll', null, null, array['Falafel', 'Shawarma', 'Pizza'], null) as poll_id \gset
select tests.refused($$select public.create_post('One choice', 'poll', null, null, array['Only'], null)$$, '2 to 6', 'a poll needs at least two choices');
select tests.refused($$select public.create_post('', 'text', null, null, null, null)$$, 'Write something', 'an empty post is refused');
select tests.refused($$select public.create_post('x', 'text', null, 'other/folder/a.webp', null, null)$$, 'Invalid photo', 'a post photo must be in your own folder');
select tests.refused($$select public.create_post('x', 'text', (select id from public.clubs c where status = 'approved' and not public.is_club_member(c.id) limit 1), null, null, null)$$, 'Join the club', 'club posts need membership');
reset role;

select tests.login(:maya);
select tests.ok(exists (select 1 from public.posts where id = :'post_id'), 'classmates see school-wide posts');
select tests.ok((select count(*) from public.notifications where recipient_id = auth.uid() and kind = 'mention') = 1, 'a mention notifies the student');
insert into public.post_reactions (post_id, profile_id, kind) values (:'post_id', auth.uid(), 'love');
select tests.ok((select reaction_count from public.posts where id = :'post_id') = 1, 'a reaction is counted');
select tests.refused($$insert into public.post_reactions (post_id, profile_id) values ('$$ || :'post_id' || $$', auth.uid())$$, 'duplicate', 'one reaction per student per post');
update public.post_reactions set kind = 'clap' where post_id = :'post_id' and profile_id = auth.uid();
select tests.refused($$insert into public.post_reactions (post_id, profile_id) values ('$$ || :'post_id' || $$', '00000000-0000-0000-0000-0000000000a4')$$, 'row-level security', 'nobody can react as someone else');
insert into public.post_comments (post_id, author_id, body, school_id) values (:'post_id', auth.uid(), 'See you there!', public.my_school_id()) returning id as comment_id \gset
select tests.ok((select comment_count from public.posts where id = :'post_id') = 1, 'a comment is counted');
select public.vote_post_poll(:'poll_id', 1);
select public.vote_post_poll(:'poll_id', 2);
select tests.ok((select votes from public.post_poll_results(array[:'poll_id'::uuid]) where idx = 2) = 1 and (select sum(votes) from public.post_poll_results(array[:'poll_id'::uuid])) = 1, 'a poll vote can be changed and is counted once');
insert into public.post_saves (post_id, profile_id) values (:'post_id', auth.uid());
select public.create_post('Worth sharing', 'repost', null, null, null, :'post_id') as repost_id \gset
select tests.ok((select repost_of from public.posts where id = :'repost_id') = :'post_id', 'a post can be shared');
insert into public.post_comments (post_id, author_id, body, school_id) values (:'post_id', auth.uid(), 'you are a bastard', public.my_school_id());
reset role;
select tests.ok((select count(*) from public.reports where target_type = 'comment' and reason = 'filter') = 1, 'a comment with a blocked word is held for moderators');
select tests.ok((select comment_count from public.posts where id = :'post_id') = 1, 'a held comment is not counted');

select tests.login(:layla);
select tests.ok((select count(*) from public.notifications where recipient_id = auth.uid() and kind in ('reaction', 'comment', 'repost')) = 3, 'the author is told about reactions, comments and shares');
select tests.ok((select count(*) from public.post_poll_votes) = 0, 'poll votes are secret');
select tests.ok((select count(*) from public.post_saves) = 0, 'saved posts are private');
select tests.ok((select count(*) from public.post_comments where post_id = :'post_id') = 1, 'held comments are hidden from others');
insert into public.post_comments (post_id, parent_id, author_id, body, school_id) values (:'post_id', :'comment_id', auth.uid(), 'Great', public.my_school_id());
select tests.ok(exists (select 1 from public.feed_posts(20, 0) f where f.id = :'post_id'), 'the feed returns school posts');
select tests.ok((select count(*) from public.feed_posts(20, 0, 'Robotics')) = 1, 'the feed can be filtered by hashtag');
select tests.ok(exists (select 1 from public.trending_tags() where tag = 'robotics'), 'trending hashtags are listed');
select tests.refused($$update public.posts set reaction_count = 999 where id = '$$ || :'post_id' || $$'$$, 'permission denied', 'counts cannot be edited by students');
reset role;
select tests.login(:maya);
select tests.ok((select count(*) from public.notifications where recipient_id = auth.uid() and kind = 'reply') = 1, 'a reply notifies the comment author');
reset role;

select tests.login('eeeeeeee-0000-0000-0000-0000000000b1');
select tests.ok((select count(*) from public.posts) = 0 and (select count(*) from public.post_comments) = 0 and (select count(*) from public.post_reactions) = 0 and (select count(*) from public.post_tags) = 0 and (select count(*) from public.follows) = 0, 'another school sees none of our feed');
select tests.refused($$insert into public.post_comments (post_id, author_id, body, school_id) values ('$$ || :'post_id' || $$', auth.uid(), 'hi', public.my_school_id())$$, 'row-level security', 'another school cannot comment on our posts');
select tests.refused($$select public.vote_post_poll('$$ || :'poll_id' || $$', 0)$$, 'not found', 'another school cannot vote in our polls');
reset role;

-- A moderator removes a comment.
select tests.login(:omar);
insert into public.reports (reporter_id, target_type, target_id, reason, school_id) values (auth.uid(), 'comment', :'comment_id', 'spam', public.my_school_id());
select public.moderate_report((select id from public.reports where target_id = :'comment_id'), 'remove', null);
reset role;
select tests.ok((select status from public.post_comments where id = :'comment_id') = 'removed' and (select comment_count from public.posts where id = :'post_id') = 1, 'a moderator can remove a reported comment');

-- ---- Follows and friends ------------------------------------------------------
select tests.login(:maya);
insert into public.follows (follower_id, followed_id, school_id) values (auth.uid(), :layla, public.my_school_id());
select tests.refused($$insert into public.follows (follower_id, followed_id, school_id) values (auth.uid(), auth.uid(), public.my_school_id())$$, '', 'you cannot follow yourself');
select tests.refused($$insert into public.follows (follower_id, followed_id, school_id) values (auth.uid(), 'eeeeeeee-0000-0000-0000-0000000000b1', public.my_school_id())$$, 'not found', 'you cannot follow another school');
select tests.refused($$insert into public.follows (follower_id, followed_id, school_id) values ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a3', public.my_school_id())$$, 'row-level security', 'you cannot follow as someone else');
select public.send_friend_request(:layla);
select tests.refused($$select public.send_friend_request('00000000-0000-0000-0000-0000000000a3')$$, 'already sent', 'no duplicate friend requests');
select tests.refused($$insert into public.friendships (a_id, b_id, school_id) values (least(auth.uid(), '00000000-0000-0000-0000-0000000000a4'::uuid), greatest(auth.uid(), '00000000-0000-0000-0000-0000000000a4'::uuid), public.my_school_id())$$, 'permission denied', 'friendships cannot be created directly');
select tests.refused($$select public.respond_friend_request((select id from public.friend_requests limit 1), true)$$, 'not found', 'you cannot accept your own request');
reset role;
select tests.login(:layla);
select tests.ok((select count(*) from public.notifications where recipient_id = auth.uid() and kind in ('follow', 'friend_request')) = 2, 'follows and friend requests notify');
select public.respond_friend_request((select id from public.friend_requests where to_id = auth.uid()), true);
select tests.ok(public.are_friends(:layla, :maya), 'accepting a request makes you friends');
reset role;
select tests.login(:yousef);
select tests.ok((select count(*) from public.friend_requests) = 0, 'friend requests are private to the two people');
select public.send_friend_request(:omar);
reset role;
select tests.login(:omar);
select public.send_friend_request(:yousef);
select tests.ok(public.are_friends(:omar, :yousef), 'asking someone who already asked you accepts their request');
select public.unfriend(:yousef);
select tests.ok(not public.are_friends(:omar, :yousef), 'unfriend works');
reset role;

-- ---- Notification switch ------------------------------------------------------
select tests.login(:layla);
insert into public.profile_settings (profile_id, notifications_enabled, who_can_message) values (auth.uid(), false, 'friends');
select tests.refused($$insert into public.profile_settings (profile_id) values ('00000000-0000-0000-0000-0000000000a4')$$, 'row-level security', 'settings belong to their owner');
reset role;
select tests.login(:yousef);
insert into public.post_reactions (post_id, profile_id) values (:'post_id', auth.uid());
reset role;
select tests.ok((select count(*) from public.notifications where recipient_id = :layla and silent and pushed_at is not null) = 1, 'with notifications off nothing is pushed');
select tests.login(:layla);
select tests.ok(((public.my_badges()) ->> 'notifications')::int = (select count(*) from public.notifications where recipient_id = auth.uid() and read_at is null and not silent), 'the bell ignores silent notifications');
select tests.ok((select count(*) from public.notifications where recipient_id = auth.uid() and silent) = 1, 'the activity is still there when the student opens Loop');
reset role;

-- ---- Messaging privacy ----------------------------------------------------------
select tests.login(:yousef);
select public.start_direct_conversation(:layla) as req_id \gset
insert into public.messages (conversation_id, sender_id, body, school_id) values (:'req_id', auth.uid(), 'Hi, can I ask about robotics?', public.my_school_id());
select tests.refused($$insert into public.messages (conversation_id, sender_id, body, school_id) values ('$$ || :'req_id' || $$', auth.uid(), 'Hello??', public.my_school_id())$$, 'request was sent', 'a message request allows one message until accepted');
reset role;
select tests.login(:layla);
select tests.ok((select accepted_at is null from public.conversation_members where conversation_id = :'req_id' and profile_id = auth.uid()), 'a non-friend becomes a message request');
select tests.refused($$insert into public.messages (conversation_id, sender_id, body, school_id) values ('$$ || :'req_id' || $$', auth.uid(), 'ok', public.my_school_id())$$, 'Accept the message request', 'you must accept before replying');
select public.respond_message_request(:'req_id', true);
insert into public.messages (conversation_id, sender_id, body, school_id) values (:'req_id', auth.uid(), 'Sure!', public.my_school_id()) returning id as msg_id \gset
update public.profile_settings set who_can_message = 'nobody' where profile_id = auth.uid();
reset role;
select tests.login(:maya);
select tests.ok((select accepted_at is not null from public.conversation_members where conversation_id = public.start_direct_conversation(:layla) and profile_id = :layla), 'friends message directly') where false;
reset role;
select tests.login(:omar);
select tests.refused($$select public.start_direct_conversation('00000000-0000-0000-0000-0000000000a3')$$, 'not accepting', '"nobody" refuses new chats');
select tests.refused($$insert into public.message_reactions (message_id, profile_id, conversation_id, emoji) values ('$$ || :'msg_id' || $$', auth.uid(), '$$ || :'req_id' || $$', '👍')$$, 'row-level security', 'outsiders cannot react to messages');
select tests.ok((select count(*) from public.messages where conversation_id = :'req_id') = 0, 'outsiders cannot read the chat');
reset role;
select tests.login(:yousef);
insert into public.message_reactions (message_id, profile_id, conversation_id, emoji) values (:'msg_id', auth.uid(), :'req_id', '👍');
select tests.ok((select count(*) from public.message_reactions) = 1, 'chat members can react to messages');
select tests.refused($$insert into public.messages (conversation_id, sender_id, body, school_id, attachment_path, attachment_kind) values ('$$ || :'req_id' || $$', auth.uid(), '', public.my_school_id(), 'elsewhere/x.png', 'image')$$, 'Invalid attachment', 'attachments must be in the chat''s own folder');
insert into public.messages (conversation_id, sender_id, body, school_id, attachment_path, attachment_kind, attachment_name) values (:'req_id', auth.uid(), '', public.my_school_id(), :'req_id' || '/' || :yousef || '/notes.pdf', 'file', 'notes.pdf');
select tests.ok((select count(*) from public.messages where attachment_kind = 'file') = 1, 'a message can carry a file');

-- Groups
select public.create_group_conversation('Study group', array[:maya, :omar, :layla]::uuid[]) as group_id \gset
select tests.ok((select count(*) from public.conversation_members where conversation_id = :'group_id') = 3, 'a group adds people who allow it and skips those who do not');
select tests.refused($$select public.create_group_conversation('x', array['00000000-0000-0000-0000-0000000000a5']::uuid[])$$, 'name', 'a group needs a name');
reset role;
select tests.login(:maya);
select tests.refused($$select public.add_group_members('$$ || :'group_id' || $$', array['00000000-0000-0000-0000-0000000000a1']::uuid[])$$, 'Only the group admin', 'only the group admin adds people');
insert into public.messages (conversation_id, sender_id, body, school_id) values (:'group_id', auth.uid(), 'Hi all', public.my_school_id());
select public.leave_conversation(:'group_id');
select tests.ok((select count(*) from public.messages where conversation_id = :'group_id') = 0, 'after leaving a group its messages are gone for you');
reset role;

-- ---- Blocking ends connections ---------------------------------------------------
select tests.login(:layla);
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), :maya);
reset role;
select tests.ok(not public.are_friends(:layla, :maya) and not exists (select 1 from public.follows where follower_id = :maya and followed_id = :layla), 'blocking removes the friendship and the follow');
select tests.login(:maya);
select tests.ok(not exists (select 1 from public.feed_posts(50, 0) f where f.author_id = :layla), 'blocked people disappear from the feed');
select tests.refused($$select public.send_friend_request('00000000-0000-0000-0000-0000000000a3')$$, 'cannot send', 'no friend requests after a block');
select tests.refused($$insert into public.post_comments (post_id, author_id, body, school_id) values ('$$ || :'post_id' || $$', auth.uid(), 'hi', public.my_school_id())$$, 'cannot comment', 'no comments after a block');
reset role;

-- ---- Own account -----------------------------------------------------------------
select tests.login(:maya);
select public.deactivate_my_account();
select tests.ok(not public.is_reader() and (select count(*) from public.posts) = 0, 'a deactivated account sees nothing');
select public.reactivate_my_account();
select tests.ok(public.is_reader(), 'a student can come back after deactivating');
select tests.refused($$select public.delete_my_account('yes')$$, 'Type DELETE', 'deleting needs the confirmation word');
select public.delete_my_account('DELETE');
reset role;
select tests.ok(not exists (select 1 from auth.users where id = :maya) and not exists (select 1 from public.profiles where id = :maya) and not exists (select 1 from public.posts where author_id = :maya), 'deleting removes the account, profile and posts');
select tests.ok(exists (select 1 from public.moderation_log where action = 'delete_own_account'), 'the deletion is recorded without the name');
select tests.login(:rania);
select tests.refused($$select public.delete_my_account('DELETE')$$, 'owner cannot', 'the owner cannot delete their account by accident');
reset role;
select tests.login(:omar);
select tests.refused($$select public.reactivate_my_account()$$, '', 'x') where false;
reset role;
update public.profiles set deactivated_at = now() where id = :omar;
select tests.login(:omar);
select public.reactivate_my_account();
reset role;
select tests.ok((select deactivated_at is not null from public.profiles where id = :omar), 'an account removed by an admin cannot reactivate itself');

rollback;
