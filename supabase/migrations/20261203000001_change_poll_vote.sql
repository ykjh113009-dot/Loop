-- Lets a student change their answer while a poll is still open. Same rules as voting; no extra points are given.
create function public.change_poll_vote(p_poll uuid, p_option int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.polls;
begin
  if not (public.is_active() and public.is_current_student(auth.uid())) then
    raise exception 'You can''t vote right now.';
  end if;
  select * into p from public.polls where id = p_poll and school_id = public.my_school_id();
  if p.id is null or p.closes_at <= now() then
    raise exception 'This poll is closed.';
  end if;
  if p.club_id is not null and not public.is_club_member(p.club_id) then
    raise exception 'Only club members can vote in this poll.';
  end if;
  if p_option < 0 or p_option >= array_length(p.options, 1) then
    raise exception 'Choose one of the answers.';
  end if;
  update public.poll_votes set option_index = p_option where poll_id = p_poll and profile_id = auth.uid();
  if not found then
    raise exception 'Vote first, then you can change your answer.';
  end if;
end;
$$;
revoke all on function public.change_poll_vote(uuid, int) from public, anon;
grant execute on function public.change_poll_vote(uuid, int) to authenticated;
