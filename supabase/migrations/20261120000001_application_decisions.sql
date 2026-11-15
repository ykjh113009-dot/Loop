-- Application decisions: remember whether the applicant has seen the decision, make a reason mandatory when an
-- application is rejected, and link the notification to the decision page. Existing applications count as seen.

alter table public.admin_applications add column decision_seen_at timestamptz;
alter table public.leadership_requests add column decision_seen_at timestamptz;
update public.admin_applications set decision_seen_at = coalesce(reviewed_at, now()) where status <> 'pending';
update public.leadership_requests set decision_seen_at = coalesce(reviewed_at, now()) where status <> 'pending';

create or replace function public.review_admin_application(p_application uuid, p_approve boolean, p_role text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.admin_applications;
  t public.profiles;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can review admin applications.';
  end if;
  select * into a from public.admin_applications
  where id = p_application and school_id = public.my_school_id() for update;
  if a.id is null then
    raise exception 'Application not found.';
  end if;
  if a.status <> 'pending' then
    raise exception 'This application was already reviewed.';
  end if;
  if not p_approve and char_length(coalesce(v_note, '')) < 3 then
    raise exception 'Please explain why, so the applicant knows what to improve.';
  end if;
  if not p_approve then perform public.reject_blocked(a.school_id, v_note); end if;
  select * into t from public.profiles where id = a.applicant_id;

  if p_approve then
    if p_role not in ('moderator', 'admin', 'super_admin') then
      raise exception 'Choose a role to give.';
    end if;
    if p_role = 'super_admin' and not public.is_owner() then
      raise exception 'Only the platform owner can appoint Super Admins.';
    end if;
    if t.deactivated_at is not null then
      raise exception 'This account was removed.';
    end if;
    if public.role_rank(t.role) < public.role_rank(p_role) then
      update public.profiles set role = p_role where id = t.id;
    end if;
  end if;

  update public.admin_applications
  set status = case when p_approve then 'approved' else 'rejected' end,
      assigned_role = case when p_approve then p_role end,
      reviewed_by = auth.uid(), reviewed_at = now(), decision_seen_at = null,
      review_note = v_note
  where id = a.id;

  perform public.log_action(a.school_id,
    case when p_approve then 'approve_admin_application' else 'reject_admin_application' end,
    'profile', t.id,
    t.full_name || ' · asked for ' || a.requested_role || case when p_approve then ' · given ' || p_role else '' end);
  perform public.notify(t.id, 'admin_application',
    case when p_approve then 'Your admin application was approved' else 'Your admin application was not approved' end,
    case when p_approve then 'Your role: ' || replace(p_role, '_', ' ') || '.' else coalesce(v_note, '') end,
    '/application-update?kind=admin&id=' || a.id::text);
end;
$$;

create or replace function public.review_leadership_request(p_request uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.leadership_requests;
  t public.profiles;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
  if not public.is_admin() then
    raise exception 'Only admins can review leadership requests.';
  end if;
  select * into r from public.leadership_requests
  where id = p_request and school_id = public.my_school_id() for update;
  if r.id is null then
    raise exception 'Request not found.';
  end if;
  if r.status <> 'pending' then
    raise exception 'This request was already reviewed.';
  end if;
  if r.profile_id = auth.uid() then
    raise exception 'You cannot review your own request.';
  end if;
  if not p_approve and char_length(coalesce(v_note, '')) < 3 then
    raise exception 'Please explain why, so the applicant knows what to improve.';
  end if;
  if not p_approve then perform public.reject_blocked(r.school_id, v_note); end if;
  select * into t from public.profiles where id = r.profile_id;

  if p_approve then
    perform public.grant_leadership(r.profile_id, r.kind, r.scope, r.club_id);
  end if;
  update public.leadership_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now(), decision_seen_at = null,
      review_note = v_note
  where id = r.id;

  perform public.log_action(r.school_id,
    case when p_approve then 'approve_leadership' else 'reject_leadership' end,
    'profile', t.id, t.full_name || ' · ' || r.kind || coalesce(' · ' || nullif(r.scope, ''), ''));
  perform public.notify(t.id, 'leadership',
    case when p_approve then 'Your leadership request was approved' else 'Your leadership request was not approved' end,
    replace(r.kind, '_', ' ') || coalesce(' · ' || v_note, ''), '/application-update?kind=leadership&id=' || r.id::text);
end;
$$;

-- The applicant has seen the full-screen decision. Only the applicant can mark their own.
create function public.ack_application_decision(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind = 'admin' then
    update public.admin_applications set decision_seen_at = now()
    where id = p_id and applicant_id = auth.uid() and status <> 'pending' and decision_seen_at is null;
  elsif p_kind = 'leadership' then
    update public.leadership_requests set decision_seen_at = now()
    where id = p_id and profile_id = auth.uid() and status <> 'pending' and decision_seen_at is null;
  else
    raise exception 'Unknown application type.';
  end if;
end;
$$;
revoke execute on function public.ack_application_decision(text, uuid) from public, anon;
grant execute on function public.ack_application_decision(text, uuid) to authenticated;
