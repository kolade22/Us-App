-- 0006_issue_daily_question_recipient_check.sql
-- Data-integrity guard: a daily question can only be issued to a member of
-- the couple it belongs to. Enforced for every caller — including the
-- service-role sweep — before any question selection or insertion.

create or replace function public.issue_daily_question(
  p_couple_id uuid,
  p_recipient_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_last_issued timestamptz;
  v_question_id uuid;
  v_instance_id uuid;
begin
  if v_user is not null then
    if not exists (
      select 1 from public.couple_members
      where couple_id = p_couple_id and user_id = v_user
    ) then
      raise exception 'not a couple member';
    end if;
  end if;

  if not exists (
    select 1 from public.couple_members
    where couple_id = p_couple_id and user_id = p_recipient_id
  ) then
    raise exception 'recipient_not_in_couple';
  end if;

  select max(issued_at) into v_last_issued
  from public.question_instances
  where couple_id = p_couple_id
    and recipient_id = p_recipient_id;

  if v_last_issued is not null and now() - v_last_issued < interval '48 hours' then
    return null;
  end if;

  select q.id into v_question_id
  from public.questions q
  where q.couple_id = p_couple_id
    and q.target_user_id = p_recipient_id
    and q.id not in (
      select qi.question_id
      from public.question_instances qi
      where qi.couple_id = p_couple_id
    )
  order by random()
  limit 1;

  if v_question_id is null then
    return null;
  end if;

  insert into public.question_instances (couple_id, question_id, recipient_id)
  values (p_couple_id, v_question_id, p_recipient_id)
  returning id into v_instance_id;

  return v_instance_id;
end;
$$;
