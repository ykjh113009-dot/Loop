-- =============================================================================
-- Pbs Go: DEMO data (fake students, clubs, events and chats)
--
-- Only use this on a local or demo database, never on the real school one.
-- Every demo account can sign in with the password: pbsgo-demo
-- =============================================================================

insert into public.schools (id, name, email_domain, grades)
values ('00000000-0000-0000-0000-00000000a001', 'Pioneers School', 'pioneers.edu.ps', '{9,10,11,12}');

-- Creates a demo login (email + password). Real students use Google instead.
create function pg_temp.demo_user(p_id uuid, p_email text, p_name text) returns void
language sql as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('pbsgo-demo', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', json_build_object('full_name', p_name)::jsonb,
    now() - interval '30 days', now(), '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_id::text, p_id, json_build_object('sub', p_id::text, 'email', p_email)::jsonb, 'email', now(), now(), now());
$$;

-- The accounts shown on the demo sign-in screen (see lib/demo.ts).
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000a1', 'demo.rania@pioneers.edu.ps', 'Rania Haddad');
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000a2', 'demo.omar@pioneers.edu.ps', 'Omar Khalil');
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000a3', 'demo.layla@pioneers.edu.ps', 'Layla Nasser');
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000a4', 'demo.yousef@pioneers.edu.ps', 'Yousef Saleh');
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000a5', 'demo.maya@pioneers.edu.ps', 'Maya Odeh');

update public.profiles set role = 'admin', grade = 12, avatar = 'a07',
  bio = 'Student council president. Ask me anything about school activities!'
  where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'moderator', grade = 11, avatar = 'a03',
  bio = 'Football, coding, and keeping Pbs Go friendly.'
  where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set grade = 10, avatar = 'a05', bio = 'I love robots and drawing. Building a line-following car this term.'
  where id = '00000000-0000-0000-0000-0000000000a3';
update public.profiles set grade = 11, avatar = 'a02', bio = 'Striker 🔥 Also into chess.'
  where id = '00000000-0000-0000-0000-0000000000a4';
update public.profiles set grade = 9, avatar = 'a09', bio = 'New here! Looking for people who like books and music.'
  where id = '00000000-0000-0000-0000-0000000000a5';

-- 40 more fake students with random grades and avatars.
do $$
declare
  first_names text[] := array['Ahmad','Sara','Mohammad','Lina','Khaled','Noor','Adam','Jana','Hamza','Dana',
    'Tariq','Hala','Sami','Rama','Ibrahim','Aya','Karim','Salma','Zaid','Tala',
    'Majd','Leen','Fadi','Yara','Amir','Mira','Bilal','Reem','Nadim','Lama',
    'Hadi','Joud','Rami','Farah','Issa','Ruba','Wael','Haneen','Jad','Malak'];
  last_names text[] := array['Barghouti','Shaheen','Awad','Hamdan','Mansour','Qasem','Darwish','Zayed','Khoury','Hijazi',
    'Abu Ali','Sabbah','Taha','Jaber','Masri','Nabulsi','Yassin','Rantisi','Kanaan','Halabi'];
  bios text[] := array['', 'Football every break ⚽', 'Coffee, books, repeat.', 'Future engineer.',
    'I draw a lot.', 'Ask me about chess openings.', 'Love dabke and music.', 'Science nerd 🔬', '', 'Photography and long walks.'];
  i int;
  v_id uuid;
begin
  perform setseed(0.42);
  for i in 1..40 loop
    v_id := ('00000000-0000-0000-0000-' || lpad(to_hex(4096 + i), 12, '0'))::uuid;
    perform pg_temp.demo_user(v_id, 'demo.student' || i || '@pioneers.edu.ps',
      first_names[i] || ' ' || last_names[1 + (i * 7) % 20]);
    update public.profiles
    set grade = (array[9,10,11,12])[1 + (i % 4)],
        avatar = 'a' || lpad((1 + (i * 5) % 12)::text, 2, '0'),
        bio = bios[1 + (i % 10)]
    where id = v_id;
  end loop;
end $$;

update public.profiles set onboarded_at = now() - interval '25 days';

-- Everyone picks 2–5 interests.
insert into public.profile_interests (profile_id, interest_id)
select p.id, i.id
from public.profiles p
cross join lateral (
  select id from public.interests order by md5(p.id::text || id::text) limit 2 + (abs(hashtext(p.id::text)) % 4)
) i;

-- ---------------------------------------------------------------------------
-- Clubs
-- ---------------------------------------------------------------------------
insert into public.clubs (id, school_id, name, description, emoji, status, requested_by, reviewed_by, reviewed_at, created_at) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a001', 'Robotics Club',
   'We build robots from Arduino kits and recycled parts. Beginners welcome — no experience needed!', '🤖', 'approved',
   '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a2', now() - interval '20 days', now() - interval '21 days'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000a001', 'Football Team',
   'Training on Tuesdays and Thursdays after school. Friendly matches against other schools.', '⚽', 'approved',
   '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a1', now() - interval '20 days', now() - interval '21 days'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000a001', 'Debate Society',
   'Practice public speaking in English and Arabic. We prepare for the national debate competition.', '🎤', 'approved',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', now() - interval '19 days', now() - interval '20 days'),
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-00000000a001', 'Art & Tatreez',
   'Drawing, painting and traditional Palestinian embroidery. Materials provided.', '🎨', 'approved',
   '00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-0000000000a1', now() - interval '18 days', now() - interval '19 days'),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-00000000a001', 'Coding Club',
   'Learn Python and make websites and games together. Weekly mini-challenges.', '💻', 'approved',
   '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', now() - interval '17 days', now() - interval '18 days'),
  ('00000000-0000-0000-0000-00000000c006', '00000000-0000-0000-0000-00000000a001', 'Dabke Troupe',
   'Rehearsals for the heritage day show. Come dance with us!', '💃', 'approved',
   '00000000-0000-0000-0000-000000001006', '00000000-0000-0000-0000-0000000000a2', now() - interval '15 days', now() - interval '16 days'),
  ('00000000-0000-0000-0000-00000000c007', '00000000-0000-0000-0000-00000000a001', 'Book Club',
   'One book a month, one cozy discussion. This month: "Men in the Sun" by Ghassan Kanafani.', '📚', 'approved',
   '00000000-0000-0000-0000-000000001010', '00000000-0000-0000-0000-0000000000a1', now() - interval '12 days', now() - interval '13 days'),
  ('00000000-0000-0000-0000-00000000c008', '00000000-0000-0000-0000-00000000a001', 'Green School',
   'Recycling, planting trees and keeping our school clean.', '🌱', 'approved',
   '00000000-0000-0000-0000-000000001014', '00000000-0000-0000-0000-0000000000a2', now() - interval '10 days', now() - interval '11 days'),
  ('00000000-0000-0000-0000-00000000c009', '00000000-0000-0000-0000-00000000a001', 'Photography Club',
   'Learning to take great photos with just our phones.', '📷', 'pending',
   '00000000-0000-0000-0000-0000000000a5', null, null, now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000c010', '00000000-0000-0000-0000-00000000a001', 'Chess Club',
   'Weekly games and a school tournament at the end of term.', '♟️', 'pending',
   '00000000-0000-0000-0000-0000000000a4', null, null, now() - interval '3 hours');

insert into public.conversations (school_id, kind, club_id)
select school_id, 'club', id from public.clubs where status = 'approved';

-- Club leaders
insert into public.club_members (club_id, profile_id, role, joined_at)
select id, requested_by, 'leader', reviewed_at from public.clubs where status = 'approved';

-- About 70% of students join 1–3 clubs (so the dashboard has a nice number).
insert into public.club_members (club_id, profile_id, role, joined_at)
select c.id, p.id, 'member', now() - interval '9 days'
from public.profiles p
cross join lateral (
  select id from public.clubs
  where status = 'approved'
  order by md5(p.id::text || id::text)
  limit case when abs(hashtext(p.id::text)) % 10 < 3 then 0 else 1 + abs(hashtext(p.id::text)) % 3 end
) c
on conflict do nothing;

-- Make sure the demo accounts are in the clubs the walkthrough uses.
insert into public.club_members (club_id, profile_id, joined_at) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a5', now() - interval '8 days'),
  ('00000000-0000-0000-0000-00000000c007', '00000000-0000-0000-0000-0000000000a5', now() - interval '8 days'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a3', now() - interval '8 days'),
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-0000000000a3', now() - interval '8 days'),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-0000000000a4', now() - interval '8 days'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a2', now() - interval '8 days')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Club posts
-- ---------------------------------------------------------------------------
insert into public.posts (club_id, author_id, body, created_at) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a3',
   'Our line-following robot finally works! 🎉 Thanks everyone who stayed after school on Monday. Next goal: obstacle avoidance.', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a2',
   'Reminder: bring your old phone chargers and toy motors on Thursday, we can reuse the parts.', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a5',
   'Hi, I''m new to the club. Is it OK if I have never coded before?', now() - interval '5 hours'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a4',
   'Great win today 3–1! Training moves to Wednesday this week because of exams.', now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000001005',
   'Who has an extra pair of shin guards? Mine broke 😅', now() - interval '20 hours'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-0000000000a1',
   'This week''s motion: "This house believes social media does more good than harm for teenagers." Pick your side!', now() - interval '4 days'),
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-000000001003',
   'We finished the first tatreez pattern — the cypress tree. Photos at the next meeting!', now() - interval '6 days'),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-0000000000a2',
   'Mini-challenge: write a program that prints the multiplication table of any number. Share your code in the chat 💻', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000c006', '00000000-0000-0000-0000-000000001006',
   'Rehearsal is in the sports hall today at 2 PM. Wear comfortable shoes!', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000c007', '00000000-0000-0000-0000-000000001010',
   'Next month we are reading "Mornings in Jenin". Who wants to lead the discussion?', now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000000c008', '00000000-0000-0000-0000-000000001014',
   'We collected 120 plastic bottles this week ♻️ Let''s reach 200 by the end of the month!', now() - interval '2 days');

-- This post contains a blocked word, so the filter hides it and sends it to
-- the moderator queue automatically.
insert into public.posts (club_id, author_id, body, created_at) values
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000001009',
   'The referee was a total bitch today, we got robbed', now() - interval '6 hours');

-- ---------------------------------------------------------------------------
-- Chats
-- ---------------------------------------------------------------------------
insert into public.messages (conversation_id, sender_id, body, created_at)
select c.id, m.sender::uuid, m.body, now() - m.ago::interval
from public.conversations c
join (values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a3', 'Who is coming on Thursday?', '26 hours'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a2', 'Me! I''ll bring the soldering kit.', '25 hours'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a5', 'Can I come just to watch the first time?', '5 hours'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a3', 'Of course Maya, everyone starts somewhere 😊', '4 hours'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a4', 'Wednesday training at 2:30, don''t be late!', '10 hours'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000001005', '👍', '9 hours'),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-0000000000a2', 'for i in range(1, 11): print(i * 7)', '30 hours'),
  ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-0000000000a4', 'Nice, mine also asks the user for the number', '29 hours')
) as m(club, sender, body, ago) on c.club_id = m.club::uuid;

-- Private chats between demo students
insert into public.conversations (id, school_id, kind) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000a001', 'direct'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000a001', 'direct');
insert into public.conversation_members (conversation_id, profile_id, last_read_at) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a3', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a5', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000000a5', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-000000001021', now() - interval '1 day');
insert into public.messages (conversation_id, sender_id, body, created_at) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a5', 'Hi Layla! Thanks for welcoming me in the robotics chat 🙏', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a3', 'Anytime! Want to sit together at the workshop?', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a5', 'Yes please! See you there', now() - interval '90 minutes'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-000000001021', 'hey new girl, nobody wants you in book club lol', now() - interval '20 hours'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-000000001021', 'just stay away', now() - interval '19 hours');

-- ---------------------------------------------------------------------------
-- Events (times are relative to today, so the demo always looks fresh)
-- ---------------------------------------------------------------------------
create function pg_temp.at_local(days int, hhmm text) returns timestamptz
language sql as $$
  select ((date_trunc('day', now() at time zone 'Asia/Hebron') + make_interval(days => days)) + hhmm::time)
         at time zone 'Asia/Hebron'
$$;

insert into public.events (id, school_id, club_id, title, description, location, starts_at, ends_at, status, created_by, reviewed_by, reviewed_at, cancel_reason) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000a001', null,
   'Clubs Fair', 'Visit every club''s table, try activities and sign up. Free knafeh for the first 100 students!',
   'Main courtyard', pg_temp.at_local(3, '10:00'), pg_temp.at_local(3, '13:00'), 'approved',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', now() - interval '5 days', null),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001',
   'Arduino Workshop for Beginners', 'Learn to make an LED blink and read a sensor. Laptops provided.',
   'Computer lab 2', pg_temp.at_local(2, '14:00'), pg_temp.at_local(2, '15:30'), 'approved',
   '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a2', now() - interval '4 days', null),
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c002',
   'Friendly Match vs Al-Nahda School', 'Come cheer for our team! Wear the school colours.',
   'School football field', pg_temp.at_local(1, '15:00'), pg_temp.at_local(1, '16:30'), 'approved',
   '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a1', now() - interval '6 days', null),
  ('00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c003',
   'Debate Practice: Social Media', 'Two teams, one motion. Spectators welcome.',
   'Library', pg_temp.at_local(5, '13:30'), pg_temp.at_local(5, '14:30'), 'approved',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', now() - interval '2 days', null),
  ('00000000-0000-0000-0000-00000000e005', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c006',
   'Heritage Day Dabke Show', 'Our troupe performs for the whole school and parents.',
   'Sports hall', pg_temp.at_local(12, '11:00'), pg_temp.at_local(12, '12:00'), 'approved',
   '00000000-0000-0000-0000-000000001006', '00000000-0000-0000-0000-0000000000a1', now() - interval '3 days', null),
  ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000a001', null,
   'Science Fair', 'Show your experiments and projects. Prizes for the best class project.',
   'Main hall', pg_temp.at_local(18, '09:00'), pg_temp.at_local(18, '13:00'), 'approved',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', now() - interval '7 days', null),
  ('00000000-0000-0000-0000-00000000e007', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c008',
   'Tree Planting Morning', 'We plant 30 olive trees around the school.',
   'Back garden', pg_temp.at_local(-4, '08:30'), pg_temp.at_local(-4, '10:00'), 'approved',
   '00000000-0000-0000-0000-000000001014', '00000000-0000-0000-0000-0000000000a2', now() - interval '12 days', null),
  ('00000000-0000-0000-0000-00000000e008', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c007',
   'Book Club Movie Night', 'Watching the film version of this month''s book.',
   'Room 14', pg_temp.at_local(4, '16:00'), null, 'cancelled',
   '00000000-0000-0000-0000-000000001010', '00000000-0000-0000-0000-0000000000a1', now() - interval '6 days', 'The projector is being repaired. We will choose a new date soon.'),
  ('00000000-0000-0000-0000-00000000e009', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c005',
   'After-school Hackathon', 'Build a small app in teams of three in 6 hours. Snacks included.',
   'Computer lab 1', pg_temp.at_local(9, '09:00'), pg_temp.at_local(9, '15:00'), 'pending',
   '00000000-0000-0000-0000-0000000000a2', null, null, null);

-- RSVPs: club members go to their club's events, plus random students for school events.
insert into public.event_rsvps (event_id, profile_id, reminded_day, reminded_hour, created_at)
select e.id, cm.profile_id, false, false, now() - interval '2 days'
from public.events e
join public.club_members cm on cm.club_id = e.club_id
where e.status in ('approved', 'cancelled') and abs(hashtext(cm.profile_id::text || e.id::text)) % 10 < 7;

insert into public.event_rsvps (event_id, profile_id, created_at)
select e.id, p.id, now() - interval '1 day'
from public.events e cross join public.profiles p
where e.club_id is null and e.status = 'approved' and abs(hashtext(p.id::text || e.id::text)) % 10 < 5
on conflict do nothing;

-- Past events should not send reminders.
update public.event_rsvps r set reminded_day = true, reminded_hour = true
from public.events e where e.id = r.event_id and e.starts_at < now();

-- ---------------------------------------------------------------------------
-- Announcements (each one also creates a notification for every student)
-- ---------------------------------------------------------------------------
insert into public.announcements (school_id, author_id, title, body, created_at) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1',
   'Welcome to Pbs Go! 👋',
   'This is our school''s own space to find clubs, events and friends who like the same things as you. Be kind, use your real name, and report anything that makes you uncomfortable.',
   now() - interval '20 days'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1',
   'Clubs Fair this week',
   'Every club will have a table in the courtyard. Come and discover something new. Want to start your own club? Tap "Request a club" on the Clubs page.',
   now() - interval '1 day');

-- ---------------------------------------------------------------------------
-- Reports sent by students (we pretend to be each reporter while inserting)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', false);
insert into public.reports (reporter_id, target_type, target_id, reason, details)
select '00000000-0000-0000-0000-0000000000a5', 'message', id, 'bullying', 'This person keeps sending me mean messages.'
from public.messages where body = 'hey new girl, nobody wants you in book club lol';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001002","role":"authenticated"}', false);
insert into public.reports (reporter_id, target_type, target_id, reason, details)
select '00000000-0000-0000-0000-000000001002', 'post', id, 'spam', 'Off-topic'
from public.posts where body like 'Who has an extra pair%';

select set_config('request.jwt.claims', '', false);

-- A few moderation history entries for the log page.
insert into public.moderation_log (school_id, actor_id, action, target_type, target_id, details, created_at)
select school_id, reviewed_by, 'approve_club', 'club', id, name, reviewed_at
from public.clubs where status = 'approved';

-- =============================================================================
-- PHASE 2 demo data
-- =============================================================================

-- A school counselor (adult staff) and two alumni mentors.
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000b1', 'demo.counselor@pioneers.edu.ps', 'Hiba Saadeh');
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000b2', 'demo.khalil@pioneers.edu.ps', 'Khalil Mansour');
select pg_temp.demo_user('00000000-0000-0000-0000-0000000000b3', 'demo.dina@pioneers.edu.ps', 'Dina Awad');
update public.profiles set role = 'counselor', grade = null, avatar = 'a10', onboarded_at = now() - interval '25 days',
  bio = 'School counselor. My door (and inbox) is always open.'
  where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set alumni_year = 2024, grade = null, avatar = 'a08', onboarded_at = now() - interval '20 days',
  university = 'Birzeit University', major = 'Computer Engineering',
  bio = 'Tawjihi scientific stream 2024. Happy to help with math and physics!'
  where id = '00000000-0000-0000-0000-0000000000b2';
update public.profiles set alumni_year = 2023, grade = null, avatar = 'a04', onboarded_at = now() - interval '20 days',
  university = 'An-Najah National University', major = 'Medicine',
  bio = 'Ask me about biology, chemistry and how to plan your study time.'
  where id = '00000000-0000-0000-0000-0000000000b3';

-- ---------------------------------------------------------------------------
-- Tutors, tutoring and study buddies
-- ---------------------------------------------------------------------------
insert into public.tutor_profiles (profile_id, school_id, subjects, about, availability) values
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000a001', '{Math,Physics}',
   'I explain step by step and I''m patient. Got 98 in math last term.', 'Mon & Wed after school, library'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000a001', '{English,Arabic}',
   'Essay writing, grammar and speaking practice.', 'Break time, any day'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000a001', '{Technology,Math}',
   'Python, Scratch and basic algebra.', 'Tuesdays after football'),
  ('00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-00000000a001', '{Chemistry,Biology}',
   'I make flashcards for everything — happy to share them.', 'Thursday break'),
  ('00000000-0000-0000-0000-000000001007', '00000000-0000-0000-0000-00000000a001', '{History,Geography}',
   'Maps, dates and tricks to remember them.', 'Sunday after school'),
  ('00000000-0000-0000-0000-00000000100b', '00000000-0000-0000-0000-00000000a001', '{Islamic Education,Arabic}',
   'Tajweed and Arabic grammar.', 'Mon break');

insert into public.tutoring_requests (school_id, learner_id, tutor_id, subject, message, status, created_at, responded_at, completed_at) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a3',
   'Math', 'Can you help me with fractions and percentages? I have a quiz next week.', 'accepted', now() - interval '2 days', now() - interval '1 day', null),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a1',
   'English', 'I need help with my English essay about my hometown.', 'completed', now() - interval '9 days', now() - interval '8 days', now() - interval '6 days'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001004', '00000000-0000-0000-0000-0000000000a3',
   'Physics', 'Newton''s laws are confusing me 😅', 'pending', now() - interval '3 hours', null, null);
select public.award_points('00000000-0000-0000-0000-0000000000a1', 15, 'tutoring', id, completed_at)
from public.tutoring_requests where status = 'completed';

insert into public.study_buddy_posts (school_id, author_id, subject, note, created_at) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001003', 'Physics',
   'Tawjihi physics — looking for 2 people to solve past exams together, Tuesdays after school.', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a5', 'English',
   'Anyone in grade 9 want to practise English speaking at break? 🙂', now() - interval '5 hours'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001006', 'Math',
   'Preparing for the math olympiad. Who''s in?', now() - interval '3 days');

-- ---------------------------------------------------------------------------
-- Marketplace
-- ---------------------------------------------------------------------------
insert into public.listings (id, school_id, seller_id, title, description, category, kind, price, condition, created_at) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001003',
   'Grade 12 physics book + solved exams', 'Clean copy, a few notes in pencil. Includes 5 years of solved Tawjihi exams.', 'books', 'sell', 25, 'good', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a4',
   'Football boots, size 42', 'Worn one season. Great grip on the school field.', 'sports', 'sell', 60, 'used', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001008',
   'Scientific calculator (Casio fx-991)', 'Works perfectly, new batteries.', 'electronics', 'sell', 40, 'like_new', now() - interval '4 days'),
  ('00000000-0000-0000-0000-00000000f004', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000100c',
   'School uniform shirts (2), size M', 'Too small for me now. Free to anyone who needs them.', 'uniform', 'free', null, 'good', now() - interval '6 hours'),
  ('00000000-0000-0000-0000-00000000f005', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001003',
   'Swap: watercolour set for sketchbooks', 'I have a 24-colour watercolour set and would love some sketchbooks.', 'art', 'swap', null, 'like_new', now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000000f006', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001012',
   'Oud for beginners', 'Small oud, good for learning. Case included.', 'music', 'sell', 300, 'good', now() - interval '8 days'),
  ('00000000-0000-0000-0000-00000000f007', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001016',
   'Arabic novels bundle', 'Five novels including "Returning to Haifa".', 'books', 'sell', 30, 'good', now() - interval '10 days');
update public.listings set status = 'reserved' where id = '00000000-0000-0000-0000-00000000f003';
update public.listings set status = 'sold' where id = '00000000-0000-0000-0000-00000000f007';

-- ---------------------------------------------------------------------------
-- Weekly challenges (this week's and last week's)
-- ---------------------------------------------------------------------------
insert into public.challenges (id, school_id, title, description, emoji, points, starts_at, ends_at, created_by, created_at) values
  ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-00000000a001', 'Read for 20 minutes a day',
   'Any book, any language. Tell us what you read and one thing you liked about it.', '📚', 20,
   public.week_start(), public.week_start() + interval '7 days', '00000000-0000-0000-0000-0000000000a2', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-00000000a001', 'Plastic-free lunch',
   'Bring your lunch without any plastic for 3 days. Share a photo of your lunch box!', '🌱', 15,
   public.week_start(), public.week_start() + interval '7 days', '00000000-0000-0000-0000-0000000000a1', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-000000000c03', '00000000-0000-0000-0000-00000000a001', 'Thank a school worker',
   'Write a thank-you card for a cleaner, guard or canteen worker.', '💐', 15,
   public.week_start() - interval '7 days', public.week_start(), '00000000-0000-0000-0000-0000000000a1', now() - interval '8 days');

-- Last week's challenge: many approved entries (points dated last week).
insert into public.challenge_submissions (school_id, challenge_id, profile_id, note, status, reviewed_by, reviewed_at, created_at)
select '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000c03', p.id,
       'I wrote a card for the school guard and he smiled all day.', 'approved',
       '00000000-0000-0000-0000-0000000000a2', public.week_start() - interval '2 days', public.week_start() - interval '3 days'
from public.profiles p
where p.grade is not null and abs(hashtext(p.id::text || 'c03')) % 10 < 5;
select public.award_points(profile_id, 15, 'challenge', challenge_id, reviewed_at)
from public.challenge_submissions where challenge_id = '00000000-0000-0000-0000-000000000c03';

-- This week: some approved already, some waiting for a moderator.
insert into public.challenge_submissions (school_id, challenge_id, profile_id, note, status, reviewed_by, reviewed_at, created_at)
select '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000c01', p.id,
       'I read two chapters of "Men in the Sun" every evening.',
       case when abs(hashtext(p.id::text)) % 3 = 0 then 'pending' else 'approved' end,
       case when abs(hashtext(p.id::text)) % 3 = 0 then null else '00000000-0000-0000-0000-0000000000a2'::uuid end,
       case when abs(hashtext(p.id::text)) % 3 = 0 then null else now() - interval '20 minutes' end,
       now() - interval '40 minutes'
from public.profiles p
where p.grade is not null and p.id <> '00000000-0000-0000-0000-0000000000a5' and abs(hashtext(p.id::text || 'c01')) % 10 < 4;
select public.award_points(profile_id, 20, 'challenge', challenge_id, reviewed_at)
from public.challenge_submissions where challenge_id = '00000000-0000-0000-0000-000000000c01' and status = 'approved';

-- ---------------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------------
insert into public.polls (id, school_id, club_id, question, options, closes_at, created_by, created_at) values
  ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-00000000a001', null,
   'Where should the spring school trip go?', '{"Jericho & the Dead Sea","Sebastia ruins","Jenin nature reserve","Bethlehem old city"}',
   now() + interval '5 days', '00000000-0000-0000-0000-0000000000a1', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-00000000a001', null,
   'Best time for club meetings?', '{"Morning break","Lunch break","Right after school"}',
   now() - interval '2 days', '00000000-0000-0000-0000-0000000000a2', now() - interval '9 days'),
  ('00000000-0000-0000-0000-000000000d03', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001',
   'What should our next robot be?', '{"Line follower 2.0","Robotic arm","Mini drone"}',
   now() + interval '3 days', '00000000-0000-0000-0000-0000000000a3', now() - interval '6 hours');

insert into public.poll_votes (poll_id, profile_id, school_id, option_index, created_at)
select '00000000-0000-0000-0000-000000000d01', p.id, p.school_id, abs(hashtext(p.id::text || 'd01')) % 4, now() - interval '3 hours'
from public.profiles p
where p.grade is not null and p.id <> '00000000-0000-0000-0000-0000000000a5' and abs(hashtext(p.id::text)) % 10 < 7;
insert into public.poll_votes (poll_id, profile_id, school_id, option_index, created_at)
select '00000000-0000-0000-0000-000000000d02', p.id, p.school_id, abs(hashtext(p.id::text || 'd02')) % 3, now() - interval '8 days'
from public.profiles p
where p.grade is not null and abs(hashtext(p.id::text)) % 10 < 8;
insert into public.poll_votes (poll_id, profile_id, school_id, option_index, created_at)
select '00000000-0000-0000-0000-000000000d03', cm.profile_id, '00000000-0000-0000-0000-00000000a001', abs(hashtext(cm.profile_id::text)) % 3, now() - interval '2 hours'
from public.club_members cm
where cm.club_id = '00000000-0000-0000-0000-00000000c001' and cm.profile_id <> '00000000-0000-0000-0000-0000000000a5';

-- ---------------------------------------------------------------------------
-- Volunteering hours
-- ---------------------------------------------------------------------------
insert into public.volunteer_entries (school_id, profile_id, organization, description, activity_date, hours, supervisor_name, status, reviewed_by, reviewed_at, created_at) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a5', 'Ramallah Public Library',
   'Helped sort children''s books and read stories to kids.', current_date - 20, 4, 'Mrs. Nadia Khoury', 'approved',
   '00000000-0000-0000-0000-0000000000a2', now() - interval '18 days', now() - interval '19 days'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a5', 'Green School club',
   'Olive tree planting morning at school.', current_date - 4, 1.5, 'Ahmad Barghouti', 'approved',
   '00000000-0000-0000-0000-0000000000a2', now() - interval '3 days', now() - interval '4 days'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a5', 'Neighbourhood clean-up',
   'Cleaning the park near my house with my cousins.', current_date - 1, 2, 'Mr. Sami Taha', 'pending', null, null, now() - interval '20 hours'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1', 'Red Crescent first-aid day',
   'Helped run the first-aid training stand.', current_date - 30, 6, 'Dr. Lina Hamdan', 'approved',
   '00000000-0000-0000-0000-0000000000a2', now() - interval '28 days', now() - interval '29 days'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1', 'Ramadan food baskets',
   'Packing and delivering food baskets.', current_date - 12, 5, 'Mr. Issa Jaber', 'approved',
   '00000000-0000-0000-0000-0000000000a2', now() - interval '10 days', now() - interval '11 days'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001014', 'Green School club',
   'Recycling drive: collected and sorted bottles.', current_date - 2, 3, 'Ms. Haneen Qasem', 'pending', null, null, now() - interval '1 day');
select public.award_points(profile_id, greatest(1, round(hours * 10)::int), 'volunteer', id, reviewed_at)
from public.volunteer_entries where status = 'approved';

-- ---------------------------------------------------------------------------
-- Tawjihi corner
-- ---------------------------------------------------------------------------
insert into public.tawjihi_questions (id, school_id, author_id, subject, title, body, created_at) values
  ('00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001003',
   'Physics', 'How many past exams should I solve before Tawjihi?', 'I have 6 months left. Is solving past papers better than reading the book again?', now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000e02', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1',
   'Study tips', 'How did you manage stress in the last month?', 'Any routine that helped you sleep and stay focused?', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000e03', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001007',
   'University', 'Scientific or literary stream for engineering?', 'I''m in grade 11. Which stream do I need for engineering at Birzeit?', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000e04', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000100b',
   'Chemistry', 'Best way to memorise organic chemistry reactions?', '', now() - interval '4 hours');

insert into public.tawjihi_answers (school_id, question_id, author_id, body, created_at) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-0000000000b2',
   'Past papers! I solved the last 10 years for physics, twice. First month: understand each chapter, then 2 papers a week, then 1 paper a day in the last month. Mark yourself honestly.', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-0000000000a3',
   'My brother did the same and got 97. Also keep a notebook of every mistake you make.', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000e02', '00000000-0000-0000-0000-0000000000b3',
   'Sleep is part of studying, not a waste of time. I studied in 50-minute blocks with 10-minute walks, and stopped phones at 10 pm. And talk to someone when it feels heavy — the school counselor helped me a lot.', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000e03', '00000000-0000-0000-0000-0000000000b2',
   'You need the scientific stream for engineering at Birzeit (and most universities). Check the minimum average each year — it changes.', now() - interval '20 hours');

-- ---------------------------------------------------------------------------
-- Student council, elections and the suggestion box
-- ---------------------------------------------------------------------------
insert into public.council_members (school_id, profile_id, position, sort) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1', 'President', 1),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a2', 'Vice president', 2),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001007', 'Secretary', 3),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000100b', 'Events officer', 4);

insert into public.elections (id, school_id, title, description, opens_at, closes_at, eligible_grades, created_by, created_at) values
  ('00000000-0000-0000-0000-000000000a11', '00000000-0000-0000-0000-00000000a001', 'Grade 10 representative',
   'Choose who will speak for grade 10 in the student council this year. Only grade 10 students can vote.',
   now() - interval '1 day', now() + interval '3 days', '{10}', '00000000-0000-0000-0000-0000000000a1', now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000a12', '00000000-0000-0000-0000-00000000a001', 'Sports officer',
   'Organises tournaments and sports day. All grades vote.',
   now() - interval '10 days', now() - interval '5 days', null, '00000000-0000-0000-0000-0000000000a1', now() - interval '12 days');

insert into public.election_candidates (id, election_id, profile_id, statement) values
  ('00000000-0000-0000-0000-000000000a21', '00000000-0000-0000-0000-000000000a11', '00000000-0000-0000-0000-0000000000a3',
   'I''ll push for a robotics corner in the library and more after-school clubs.'),
  ('00000000-0000-0000-0000-000000000a22', '00000000-0000-0000-0000-000000000a11', '00000000-0000-0000-0000-000000001001',
   'Water fountains on every floor and a suggestion meeting every month.'),
  ('00000000-0000-0000-0000-000000000a23', '00000000-0000-0000-0000-000000000a11', '00000000-0000-0000-0000-000000001005',
   'More trips and a grade 10 football league!'),
  ('00000000-0000-0000-0000-000000000a24', '00000000-0000-0000-0000-000000000a12', '00000000-0000-0000-0000-0000000000a4',
   'A school-wide football and volleyball tournament every term.'),
  ('00000000-0000-0000-0000-000000000a25', '00000000-0000-0000-0000-000000000a12', '00000000-0000-0000-0000-000000001010',
   'New equipment and a girls'' basketball team.');

insert into public.election_votes (election_id, voter_id, candidate_id, school_id, created_at)
select '00000000-0000-0000-0000-000000000a11', p.id,
       (array['00000000-0000-0000-0000-000000000a21','00000000-0000-0000-0000-000000000a22','00000000-0000-0000-0000-000000000a23']::uuid[])[1 + abs(hashtext(p.id::text)) % 3],
       p.school_id, now() - interval '10 hours'
from public.profiles p where p.grade = 10 and p.id not in ('00000000-0000-0000-0000-0000000000a3') and abs(hashtext(p.id::text || 'v')) % 10 < 6;
insert into public.election_votes (election_id, voter_id, candidate_id, school_id, created_at)
select '00000000-0000-0000-0000-000000000a12', p.id,
       (array['00000000-0000-0000-0000-000000000a24','00000000-0000-0000-0000-000000000a25']::uuid[])[1 + abs(hashtext(p.id::text || 's')) % 2],
       p.school_id, now() - interval '7 days'
from public.profiles p where p.grade is not null and abs(hashtext(p.id::text || 'w')) % 10 < 8;

insert into public.suggestions (school_id, author_id, category, title, body, status, response, responded_by, responded_at, created_at) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a5', 'facilities',
   'More benches in the courtyard', 'There are not enough places to sit at break, especially for grade 9.', 'planned',
   'Great idea — the principal agreed to add 6 benches before winter.', '00000000-0000-0000-0000-0000000000a1', now() - interval '2 days', now() - interval '6 days'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001004', 'activities',
   'A movie afternoon every month', 'We could watch a film in the hall and discuss it.', 'new', null, null, null, now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000001008', 'app',
   'Dark mode for Pbs Go', 'It would be easier on the eyes at night.', 'reviewing', null, '00000000-0000-0000-0000-0000000000a1', now() - interval '1 day', now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000100d', 'clubs',
   'A chess club', 'Lots of us play at break already.', 'done', 'The Chess Club request is waiting for approval now!', '00000000-0000-0000-0000-0000000000a2', now() - interval '3 hours', now() - interval '8 days');

-- ---------------------------------------------------------------------------
-- One private counselor conversation (only the student and counselor see it)
-- ---------------------------------------------------------------------------
insert into public.counselor_requests (id, school_id, student_id, topic, urgent, status, created_at, last_message_at) values
  ('00000000-0000-0000-0000-000000000cc1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a4',
   'stress', false, 'in_progress', now() - interval '2 days', now() - interval '1 day');
insert into public.counselor_messages (request_id, school_id, sender_id, body, created_at) values
  ('00000000-0000-0000-0000-000000000cc1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a4',
   'Hi Ms. Hiba, I''ve been really stressed about exams and football at the same time and I can''t sleep well.', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000cc1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000b1',
   'Thank you for telling me, Yousef. That sounds like a lot. Would you like to come to my office on Tuesday at 10:00 so we can make a plan together?', now() - interval '1 day');

-- Mark older notifications as read so the demo shows a realistic mix.
update public.notifications set read_at = now() where created_at < now() - interval '2 days';
update public.notifications set pushed_at = now();
