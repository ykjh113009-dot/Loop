-- Ratings and reviews for tutors. A student can review a tutor once per finished tutoring session.
create table public.tutor_reviews (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  request_id uuid not null unique references public.tutoring_requests (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index on public.tutor_reviews (tutor_id, created_at desc);

alter table public.tutor_reviews enable row level security;
create policy "see tutor reviews" on public.tutor_reviews for select to authenticated
  using (school_id = public.my_school_id() and public.is_reader());
revoke insert, update, delete on public.tutor_reviews from authenticated;

-- Only the student who had the session can review it, once, after it is marked as done.
create function public.submit_tutor_review(p_request uuid, p_rating int, p_comment text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.tutoring_requests;
begin
  if not public.is_active() then raise exception 'Not signed in'; end if;
  select * into r from public.tutoring_requests where id = p_request and learner_id = auth.uid() and status = 'completed';
  if r.id is null then
    raise exception 'You can review a tutor after a finished session.';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Choose 1 to 5 stars.';
  end if;
  perform public.check_rate('tutor_review', 10, 3600);
  insert into public.tutor_reviews (school_id, request_id, tutor_id, reviewer_id, rating, comment)
  values (r.school_id, r.id, r.tutor_id, auth.uid(), p_rating, left(coalesce(trim(p_comment), ''), 500))
  on conflict (request_id) do nothing;
  if not found then raise exception 'You already reviewed this session.'; end if;
  perform public.notify(r.tutor_id, 'tutor_review', 'You got a new review', p_rating || ' stars from a student you helped.', '/tutors/' || r.tutor_id);
end;
$$;
revoke all on function public.submit_tutor_review(uuid, int, text) from public, anon;
grant execute on function public.submit_tutor_review(uuid, int, text) to authenticated;

-- Average rating, number of reviews and finished sessions for a list of tutors.
create function public.tutor_stats(p_tutors uuid[]) returns table (tutor_id uuid, rating_avg numeric, reviews bigint, sessions bigint)
language sql stable security definer set search_path = '' as $$
  select t.id,
         (select round(avg(rating)::numeric, 1) from public.tutor_reviews v where v.tutor_id = t.id),
         (select count(*) from public.tutor_reviews v where v.tutor_id = t.id),
         (select count(*) from public.tutoring_requests q where q.tutor_id = t.id and q.status = 'completed')
  from unnest(p_tutors) as t(id)
  where public.is_reader()
    and exists (select 1 from public.profiles p where p.id = t.id and p.school_id = public.my_school_id())
$$;
grant execute on function public.tutor_stats(uuid[]) to authenticated;
