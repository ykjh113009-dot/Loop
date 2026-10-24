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

-- Mark older notifications as read so the demo shows a realistic mix.
update public.notifications set read_at = now() where created_at < now() - interval '2 days';
update public.notifications set pushed_at = now();
