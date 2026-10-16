-- 0004_functions.sql
-- US data layer: security-definer RPCs backing the Edge Functions.
-- These run with the caller's JWT (auth.uid()) but bypass RLS so the
-- constraint-protected writes can happen atomically.

-- =============================================================================
-- create_couple: creator becomes partner_a; settings + pet_state seeded.
-- =============================================================================

create or replace function public.create_couple(
  p_start_date date,
  p_invite_code text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_couple_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from public.couple_members where user_id = v_user) then
    raise exception 'already in a couple';
  end if;

  insert into public.couples (relationship_start_date, invite_code, invite_code_expires_at, status, created_by)
  values (p_start_date, p_invite_code, p_expires_at, 'pending', v_user)
  returning id into v_couple_id;

  insert into public.couple_members (couple_id, user_id, role)
  values (v_couple_id, v_user, 'partner_a');

  insert into public.couple_settings (couple_id) values (v_couple_id);
  insert into public.pet_state (couple_id) values (v_couple_id);

  return v_couple_id;
end;
$$;

-- =============================================================================
-- join_couple: atomic invite-code redemption.
-- Expiry check, not-null checks, pending-status check, own-couple check, and
-- code consumption all happen in ONE row-locked UPDATE ... WHERE ... RETURNING.
-- Two concurrent joins against the same code cannot both succeed: the second
-- UPDATE blocks on the first's row lock; when the first commits, the blocked
-- UPDATE re-evaluates the WHERE clause against the committed row version
-- (invite_code now null, status now 'active'), matches nothing, and returns
-- no row. UNIQUE(couple_id, role) and UNIQUE(user_id) remain the final
-- backstop — a unique_violation aborts the entire transaction, rolling back
-- the code consumption with it.
-- =============================================================================

create or replace function public.join_couple(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_couple_id uuid;
  v_constraint_name text;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  -- Friendly pre-check only; UNIQUE(user_id) is the real source of truth.
  if exists (select 1 from public.couple_members where user_id = v_user) then
    raise exception 'already in a couple';
  end if;

  -- Atomic redemption: every guard condition lives in the WHERE clause and
  -- consumption (null the code, flip status) happens in the same statement.
  update public.couples
     set status = 'active',
         invite_code = null,
         invite_code_expires_at = null
   where invite_code = upper(trim(p_code))
     and invite_code is not null
     and invite_code_expires_at is not null
     and invite_code_expires_at > now()
     and status = 'pending'
     and created_by <> v_user
  returning id into v_couple_id;

  if v_couple_id is null then
    -- Redemption failed. Distinguish "you created this couple" purely for a
    -- friendlier error; this read plays no role in the redemption itself.
    select id into v_couple_id
    from public.couples
    where invite_code = upper(trim(p_code))
      and created_by = v_user;

    if v_couple_id is not null then
      raise exception 'cannot_join_own_couple';
    end if;

    raise exception 'invalid_or_expired_code';
  end if;

  begin
    insert into public.couple_members (couple_id, user_id, role)
    values (v_couple_id, v_user, 'partner_b');
  exception
    when unique_violation then
      -- Distinguish WHICH unique constraint fired:
      --   couple_members_role_unique (couple_id, role) -> the couple is full
      --   couple_members_user_unique (user_id)          -> this user is
      --     already in another couple
      get stacked diagnostics
        v_constraint_name = CONSTRAINT_NAME;
      if v_constraint_name = 'couple_members_role_unique' then
        raise exception 'couple_already_full';
      elsif v_constraint_name = 'couple_members_user_unique' then
        raise exception 'already_in_couple';
      else
        -- Defensive: an unexpected unique violation on this insert.
        raise exception 'join_constraint_violation: %', v_constraint_name;
      end if;
  end;

  return v_couple_id;
end;
$$;

-- =============================================================================
-- regenerate_invite_code: creator-only, only before a partner has joined.
-- =============================================================================

create or replace function public.regenerate_invite_code(
  p_new_code text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_couple_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select id into v_couple_id
  from public.couples
  where created_by = v_user
    and status = 'pending'
  for update;

  if v_couple_id is null then
    raise exception 'no_pending_couple';
  end if;

  update public.couples
     set invite_code = p_new_code,
         invite_code_expires_at = p_expires_at
   where id = v_couple_id;

  return v_couple_id;
end;
$$;

-- =============================================================================
-- issue_daily_question: per couple per recipient.
-- Eligible when >= 48h since the recipient's last issued instance.
-- Picks a random question from the recipient's incoming pool that has never
-- been issued within this couple (unanswered questions stay available — no
-- forced rotation). Returns the new instance id, or null when not eligible
-- or the pool is exhausted.
-- Callable by the service role (scheduled runs, auth.uid() is null) or by a
-- member of the couple (membership enforced).
-- =============================================================================

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

-- =============================================================================
-- issue_scheduled_questions: run for every member of every active couple.
-- Intended for pg_cron or a scheduled Edge Function invocation.
-- Returns the number of new instances issued.
-- =============================================================================

create or replace function public.issue_scheduled_questions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  v_instance uuid;
  v_issued integer := 0;
begin
  for m in
    select cm.couple_id, cm.user_id
    from public.couple_members cm
    join public.couples c on c.id = cm.couple_id
    where c.status = 'active'
  loop
    v_instance := public.issue_daily_question(m.couple_id, m.user_id);
    if v_instance is not null then
      v_issued := v_issued + 1;
    end if;
  end loop;

  return v_issued;
end;
$$;

-- =============================================================================
-- Grants: authenticated-only for user-facing RPCs; service-only for the
-- scheduled sweep; trigger function has no direct execute.
-- =============================================================================

revoke execute on function public.create_couple(date, text, timestamptz) from public, anon;
grant execute on function public.create_couple(date, text, timestamptz) to authenticated;

revoke execute on function public.join_couple(text) from public, anon;
grant execute on function public.join_couple(text) to authenticated;

revoke execute on function public.regenerate_invite_code(text, timestamptz) from public, anon;
grant execute on function public.regenerate_invite_code(text, timestamptz) to authenticated;

revoke execute on function public.issue_daily_question(uuid, uuid) from public, anon;
grant execute on function public.issue_daily_question(uuid, uuid) to authenticated;

revoke execute on function public.issue_scheduled_questions() from public, anon, authenticated;
grant execute on function public.issue_scheduled_questions() to service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
