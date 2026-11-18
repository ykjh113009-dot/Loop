-- Clubs get a category so students can filter the club list (Sports, Academics, Tech, Culture, Charity).
alter table public.clubs
  add column category text not null default 'other' check (category in ('sports', 'academics', 'tech', 'culture', 'charity', 'other'));

-- Sort the clubs that already exist by what their name and description say.
update public.clubs set category = case
  when lower(name || ' ' || description) ~ '(robot|coding|code |programm|tech|comput|engineer|arduino|3d)' then 'tech'
  when lower(name || ' ' || description) ~ '(volunt|charit|green|environment|recycl|donat)' then 'charity'
  when lower(name || ' ' || description) ~ '(football|soccer|basket|volley|swim|tennis|sport|athlet|run|gym|team)' then 'sports'
  when lower(name || ' ' || description) ~ '(book|debate|math|science|chess|read|writ|journal|model un|quiz|study)' then 'academics'
  when lower(name || ' ' || description) ~ '(art|drama|dabke|music|theat|photo|danc|film|craft|culture|language|choir)' then 'culture'
  else 'other' end;
