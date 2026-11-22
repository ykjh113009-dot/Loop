-- Defence in depth. Loop has no public pages that read data, so the signed-out ("anon") role needs no access to the
-- public schema at all. Row Level Security already blocks it; this removes the grants as well, so a future policy
-- mistake cannot expose data to signed-out visitors.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
-- Functions: take them away from signed-out visitors and from PUBLIC, then give signed-in people back exactly what they
-- could already run (nothing new is opened up).
create temporary table _authed_fns as
  select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p') and has_function_privilege('authenticated', p.oid, 'execute');
revoke execute on all functions in schema public from anon, public;
do $$
declare r record;
begin
  for r in select fn from _authed_fns loop
    execute format('grant execute on function %s to authenticated', r.fn);
  end loop;
end $$;
drop table _authed_fns;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- Internal helper functions. They are only ever called from other database functions (which run as the owner) or by the
-- server with the service key, never by a signed-in person. Left callable they let any student do things like award
-- themselves points, make themselves a club leader or council member, or send anyone a notification with any text.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'grant_leadership', 'award_points', 'notify', 'claim_push_batch', 'send_event_reminders', 'promote_waitlist',
        'ensure_event_chat', 'event_chat_sync', 'notify_club_about_event', 'library_notify_reviewers', 'mark_active',
        'refresh_streak', 'award_badges', 'library_refresh_rating', 'profile_check_complete', 'notify_mentions',
        'make_handle', 'contains_blocked_word', 'reject_blocked', 'points_for', 'points_today', 'rule_points',
        'streak_now', 'achievement_metric', 'event_audience'
      )
  loop
    execute format('revoke execute on function %s from authenticated', r.fn);
  end loop;
end $$;
