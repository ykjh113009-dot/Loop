-- Reward Shop and Top 10 Prizes redesign: reward categories, prize pictures and values, a monthly competition and its countdown.
alter table public.rewards add column category text not null default 'other'
  check (category in ('gift_cards', 'technology', 'study', 'experiences', 'other'));
grant update (category) on public.rewards to authenticated;

alter table public.top10_prizes
  add column image_path text,
  add column value text not null default '' check (char_length(value) <= 40),
  add column special boolean not null default false;

alter table public.top10_settings drop constraint top10_settings_period_check;
alter table public.top10_settings add constraint top10_settings_period_check check (period in ('week', 'month', 'all'));
alter table public.top10_settings alter column period set default 'month';
update public.top10_settings set period = 'month' where period = 'week';

-- Start of this month and the end of the current competition period (null when it never ends), in school time.
create function public.month_start() returns timestamptz
language sql stable set search_path = '' as $$
  select (date_trunc('month', now() at time zone 'Asia/Hebron')) at time zone 'Asia/Hebron'
$$;
create function public.top10_period_end(p_period text) returns timestamptz
language sql stable set search_path = '' as $$
  select case p_period
    when 'month' then public.month_start() + interval '1 month'
    when 'week' then public.week_start() + interval '7 days'
    else null end
$$;
grant execute on function public.month_start() to authenticated;
grant execute on function public.top10_period_end(text) to authenticated;
revoke execute on function public.month_start() from public, anon;
revoke execute on function public.top10_period_end(text) from public, anon;

-- The ranking now understands "month" as well as "week" and "all".
create or replace function public.individual_leaderboard(p_period text, p_grade int default null, p_limit int default 20)
returns table (profile_id uuid, full_name text, avatar text, grade int, section text, points bigint, level int)
language sql stable security definer set search_path = '' as $$
  with pts as (
    select l.profile_id, sum(l.points) as points from public.points_ledger l
    where l.school_id = public.my_school_id()
      and (p_period = 'all' or l.created_at >= case when p_period = 'month' then public.month_start() else public.week_start() end)
    group by l.profile_id
  ), xp as (
    select l.profile_id, sum(l.points) as xp from public.points_ledger l
    where l.school_id = public.my_school_id() group by l.profile_id
  )
  select p.id, p.full_name, p.avatar, p.grade, p.section, pts.points::bigint, public.level_for_xp(coalesce(xp.xp, 0))
  from public.profiles p
  join pts on pts.profile_id = p.id
  left join xp on xp.profile_id = p.id
  where p.school_id = public.my_school_id() and public.is_reader()
    and p.onboarded_at is not null and p.deactivated_at is null and p.alumni_year is null and p.role <> 'counselor'
    and (p_grade is null or p.grade = p_grade)
    and coalesce((select s.show_on_leaderboard from public.profile_settings s where s.profile_id = p.id), true)
  order by pts.points desc, p.full_name
  limit least(greatest(p_limit, 1), 50)
$$;

create or replace function public.set_top10_settings(p_period text, p_rules text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_points() then
    raise exception 'Only admins and school staff can change this.';
  end if;
  if p_period not in ('week', 'month', 'all') then raise exception 'Choose weekly, monthly or all time.'; end if;
  perform public.reject_blocked(public.my_school_id(), coalesce(p_rules, ''));
  insert into public.top10_settings (school_id, period, rules) values (public.my_school_id(), p_period, left(btrim(coalesce(p_rules, '')), 500))
  on conflict (school_id) do update set period = excluded.period, rules = excluded.rules, updated_at = now();
end;
$$;

drop function public.set_top10_prize(int, text, text);
create function public.set_top10_prize(p_place int, p_title text, p_description text, p_value text default '', p_image text default null, p_special boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid := public.my_school_id();
  v_title text := left(btrim(coalesce(p_title, '')), 80);
begin
  if not public.can_manage_points() then
    raise exception 'Only admins and school staff can set the Top 10 prizes.';
  end if;
  if p_place not between 1 and 10 then raise exception 'Choose a place from 1 to 10.'; end if;
  if v_title = '' then
    delete from public.top10_prizes where school_id = v_school and place = p_place;
    return;
  end if;
  if p_image is not null and p_image <> '' and p_image not like v_school::text || '/' || auth.uid()::text || '/%' then
    raise exception 'That image is not yours.';
  end if;
  perform public.reject_blocked(v_school, v_title || ' ' || coalesce(p_description, '') || ' ' || coalesce(p_value, ''));
  insert into public.top10_prizes (school_id, place, title, description, value, image_path, special)
  values (v_school, p_place, v_title, left(btrim(coalesce(p_description, '')), 200), left(btrim(coalesce(p_value, '')), 40), nullif(p_image, ''), coalesce(p_special, false))
  on conflict (school_id, place) do update set title = excluded.title, description = excluded.description, value = excluded.value,
    image_path = coalesce(excluded.image_path, public.top10_prizes.image_path), special = excluded.special;
end;
$$;
revoke execute on function public.set_top10_prize(int, text, text, text, text, boolean) from public, anon;
grant execute on function public.set_top10_prize(int, text, text, text, text, boolean) to authenticated;

-- Remove a prize picture (keeps the prize).
create function public.clear_top10_image(p_place int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_points() then raise exception 'Only admins and school staff can do this.'; end if;
  update public.top10_prizes set image_path = null where school_id = public.my_school_id() and place = p_place;
end;
$$;
revoke execute on function public.clear_top10_image(int) from public, anon;
grant execute on function public.clear_top10_image(int) to authenticated;

-- The ten starting prizes. Admins can change every one of them; new schools get them automatically.
create function public.seed_top10_prizes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.top10_prizes (school_id, place, title, description, special) values
    (new.id, 1, 'MacBook Air', 'The grand prize for the student with the most points.', false),
    (new.id, 2, 'AirPods Pro', 'Wireless earbuds with noise cancellation.', false),
    (new.id, 3, '$100 Gift Card', 'A gift card to spend on whatever you like.', false),
    (new.id, 4, 'iPad', 'A tablet for study, notes and creativity.', false),
    (new.id, 5, '$50 Gift Card', 'A gift card to spend on whatever you like.', false),
    (new.id, 6, '$50 Spotify or Gaming Gift Card', 'Pick music or games.', false),
    (new.id, 7, '1-Year Premium Subscription', 'A year of premium access to a learning or music app.', false),
    (new.id, 8, '$50 PlayStation Gift Card', 'Credit for games on PlayStation.', false),
    (new.id, 9, 'SAT Refund', 'Your SAT registration fee paid back.', true),
    (new.id, 10, 'Four Cinema Tickets', 'A trip to the cinema with three friends.', false)
  on conflict do nothing;
  return new;
end;
$$;
create trigger seed_top10_prizes after insert on public.schools for each row execute function public.seed_top10_prizes();
revoke execute on function public.seed_top10_prizes() from public, anon, authenticated;

insert into public.top10_prizes (school_id, place, title, description, special)
select s.id, v.place, v.title, v.description, v.special from public.schools s,
  (values (1, 'MacBook Air', 'The grand prize for the student with the most points.', false),
          (2, 'AirPods Pro', 'Wireless earbuds with noise cancellation.', false),
          (3, '$100 Gift Card', 'A gift card to spend on whatever you like.', false),
          (4, 'iPad', 'A tablet for study, notes and creativity.', false),
          (5, '$50 Gift Card', 'A gift card to spend on whatever you like.', false),
          (6, '$50 Spotify or Gaming Gift Card', 'Pick music or games.', false),
          (7, '1-Year Premium Subscription', 'A year of premium access to a learning or music app.', false),
          (8, '$50 PlayStation Gift Card', 'Credit for games on PlayStation.', false),
          (9, 'SAT Refund', 'Your SAT registration fee paid back.', true),
          (10, 'Four Cinema Tickets', 'A trip to the cinema with three friends.', false)) as v(place, title, description, special)
where not exists (select 1 from public.top10_prizes p where p.school_id = s.id)
on conflict do nothing;
