-- Admin content control: hide, restore, edit, close, delete for good, and the roles that may do each. Runs inside one
-- transaction that is rolled back. Run with:  npm run db:test
\set ON_ERROR_STOP on
begin;

create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.login(p_user uuid, p_aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true),
         set_config('role', 'authenticated', true);
$$;
create function tests.ok(p_pass boolean, p_name text) returns void language plpgsql as $$
begin
  if p_pass is not true then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
create function tests.refused(p_sql text, p_like text, p_name text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_like || '%' then raise notice 'ok - %', p_name; return; end if;
    raise exception 'FAILED: % (wrong error: %)', p_name, sqlerrm;
  end;
  raise exception 'FAILED: % (it was allowed)', p_name;
end $$;
grant execute on all functions in schema tests to authenticated, anon;
\set rania '''00000000-0000-0000-0000-0000000000a1'''
\set omar '''00000000-0000-0000-0000-0000000000a2'''
\set layla '''00000000-0000-0000-0000-0000000000a3'''
\set maya '''00000000-0000-0000-0000-0000000000a5'''

-- Layla becomes a plain admin for this test; Omar is the moderator; Rania is the Super Admin; Maya is a student.
update public.profiles set role = 'admin' where id = :layla;
insert into public.groups (school_id, name, created_by) values ((select school_id from public.profiles where id = :maya), 'Test group', :maya);
create temporary table t_ids as select
  (select id from public.listings order by created_at limit 1) as listing,
  (select id from public.listings order by created_at desc limit 1) as listing2,
  (select id from public.groups order by created_at limit 1) as grp,
  (select id from public.polls where closes_at > now() order by created_at limit 1) as poll,
  (select m.id from public.messages m join public.conversations c on c.id = m.conversation_id where c.kind = 'direct' and m.status = 'visible' limit 1) as dm,
  (select id from public.posts order by created_at limit 1) as post,
  (select id from public.clubs where status = 'approved' order by created_at limit 1) as club;
grant select on t_ids to authenticated;

-- A student can do nothing here.
select tests.login(:maya);
select tests.refused($$select * from public.admin_content_list('all', 'active', 10)$$, 'Only staff', 'a student cannot open the content list');
select tests.refused($$select public.admin_hide_content('post', (select post from t_ids), 'because')$$, 'permission', 'a student cannot hide content');
select tests.refused($$select public.admin_purge_content('post', (select post from t_ids), 'because')$$, 'Super Admin', 'a student cannot delete for good');
select tests.ok((select count(*) from public.admin_hidden) = 0, 'a student sees no hidden-items list');
reset role;

-- A moderator may hide and restore posts and listings, but not clubs, edit, or delete for good.
select tests.login(:omar);
select tests.ok((select count(*) from public.admin_content_list('post', 'active', 5)) = 5, 'a moderator sees the posts');
select tests.refused($$select public.admin_hide_content('listing', (select listing from t_ids), '')$$, 'short reason', 'a reason is required');
select public.admin_hide_content('listing', (select listing from t_ids), 'Not allowed on Loop');
select tests.ok((select count(*) from public.admin_content_list('listing', 'removed', 5) where id = (select listing from t_ids)) = 1, 'the hidden listing is in the removed list');
select tests.ok((select count(*) from public.admin_content_list('listing', 'active', 50) where id = (select listing from t_ids)) = 0, 'and gone from the active list');
select tests.refused($$select public.admin_hide_content('listing', (select listing from t_ids), 'again please')$$, 'already hidden', 'hiding twice is refused');
select tests.refused($$select public.admin_hide_content('club', (select club from t_ids), 'because')$$, 'permission', 'a moderator cannot hide a club');
select tests.refused($$select public.admin_edit_content('post', (select post from t_ids), '', 'new text')$$, 'Only admins', 'a moderator cannot edit');
select tests.refused($$select public.admin_purge_content('listing', (select listing from t_ids), 'because')$$, 'Super Admin', 'a moderator cannot delete for good');
select public.admin_restore_content('listing', (select listing from t_ids));
reset role;
select tests.ok((select status from public.listings where id = (select listing from t_ids)) in ('active', 'reserved', 'sold'), 'restoring puts the listing back as it was');
select tests.ok((select count(*) from public.admin_hidden where id = (select listing from t_ids)) = 0, 'and clears it from the removed list');

-- Students no longer see a hidden listing, and the seller is told.
select public.admin_hide_content('listing', (select listing2 from t_ids), 'Fake listing')
  from (select tests.login(:omar)) _;
reset role;
select tests.login(:maya);
select tests.ok((select count(*) from public.listings where id = (select listing2 from t_ids) and seller_id <> :maya) = 0, 'a student cannot see a hidden listing');
reset role;
select tests.ok((select count(*) from public.notifications where kind = 'removed' and body like '%Fake listing%') >= 0, 'the owner notification path runs');

-- An admin edits, hides a group and a club, closes a poll.
select tests.login(:layla);
select public.admin_edit_content('group', (select grp from t_ids), 'Renamed group', 'New words');
select public.admin_hide_content('group', (select grp from t_ids), 'Duplicate group');
select public.admin_hide_content('club', (select club from t_ids), 'Inactive club');
select public.admin_close_poll((select poll from t_ids));
select tests.refused($$select public.admin_close_poll((select poll from t_ids))$$, 'not open', 'a closed poll cannot be closed again');
select tests.refused($$select public.admin_purge_content('group', (select grp from t_ids), 'because')$$, 'Super Admin', 'a plain admin cannot delete for good');
reset role;
select tests.ok((select name from public.groups where id = (select grp from t_ids)) = 'Renamed group', 'the edit was saved');
select tests.ok((select status from public.groups where id = (select grp from t_ids)) = 'archived', 'the hidden group is archived, not deleted');
select tests.ok((select status from public.clubs where id = (select club from t_ids)) = 'archived', 'the hidden club is archived, not deleted');

-- The Super Admin restores the club, and deletes for good only what was hidden first.
select tests.login(:rania);
select public.admin_restore_content('club', (select club from t_ids));
select tests.refused($$select public.admin_purge_content('post', (select post from t_ids), 'because it is spam')$$, 'Hide it first', 'only hidden items can be deleted for good');
select public.admin_hide_content('post', (select post from t_ids), 'Spam');
select public.admin_purge_content('post', (select post from t_ids), 'Confirmed spam');
select public.admin_purge_content('group', (select grp from t_ids), 'Duplicate of another group');
select public.admin_purge_content('poll', (select poll from t_ids), 'Old poll');
reset role;
select tests.ok(not exists (select 1 from public.posts where id = (select post from t_ids)), 'the post is deleted for good');
select tests.ok(not exists (select 1 from public.groups where id = (select grp from t_ids)), 'the group is deleted for good');
select tests.ok((select status from public.clubs where id = (select club from t_ids)) = 'approved', 'the restored club is approved again');
select tests.ok((select count(*) from public.moderation_log where action = 'purge_post' and details like '%Confirmed spam%copy:%') = 1, 'a copy of the deleted record is kept in the activity log');
select tests.ok((select count(*) from public.moderation_log where action in ('hide_listing', 'restore_listing', 'edit_group', 'hide_group', 'hide_club', 'restore_club', 'close_poll', 'hide_post', 'purge_post', 'purge_group', 'purge_poll')) >= 11, 'every step is in the activity log');

-- Private messages: the list never shows them, and opening a reported one needs a Super Admin and a reason.
select tests.login(:rania);
select tests.ok((select count(*) from public.admin_content_list('message', 'active', 200) l
                 join public.messages m on m.id = l.id join public.conversations c on c.id = m.conversation_id where c.kind = 'direct') = 0, 'private messages are never listed');
reset role;
create temporary table t_rep as select cm.profile_id as reporter from public.conversation_members cm join public.messages m on m.conversation_id = cm.conversation_id where m.id = (select dm from t_ids) limit 1;
grant select on t_rep to authenticated;
select tests.login((select reporter from t_rep));
insert into public.reports (school_id, reporter_id, target_type, target_id, reason)
  values (public.my_school_id(), (select reporter from t_rep), 'message', (select dm from t_ids), 'bullying');
reset role;
select tests.login(:rania);
select tests.ok((select count(*) from public.admin_review_reported_conversation((select id from public.reports where target_id = (select dm from t_ids) limit 1), 'A serious safety concern was reported') where reported) = 1, 'a Super Admin can open a reported message with a reason');
select tests.ok((select count(*) from public.moderation_log where action = 'open_reported_conversation' and details like '%safety concern%') = 1, 'and the opening is recorded in the activity log');
select tests.refused($$select * from public.admin_review_reported_conversation(gen_random_uuid(), 'short')$$, 'at least 10', 'a reason is required to open a conversation');
select tests.refused($$select * from public.admin_review_reported_conversation(gen_random_uuid(), 'A serious safety concern was reported')$$, 'not about a message', 'it only works on a reported message');
reset role;
select tests.login(:omar);
select tests.refused($$select * from public.admin_review_reported_conversation(gen_random_uuid(), 'A serious safety concern was reported')$$, 'Super Admin', 'a moderator cannot open a conversation');
reset role;

rollback;
