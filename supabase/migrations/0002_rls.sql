-- 0002_rls.sql
-- US data layer: row level security.
-- Couple-scoped isolation is enforced here, never trusted to the frontend.
-- The service role (Edge Functions) bypasses RLS by design.

-- =============================================================================
-- Non-recursive couple resolution
-- SECURITY DEFINER + owner postgres: reads couple_members AS THE OWNER,
-- bypassing RLS on couple_members, so couple_members' own policies can call
-- this function without infinite recursion.
-- =============================================================================

create or replace function public.get_my_couple_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select couple_id
  from public.couple_members
  where user_id = auth.uid()
$$;

revoke execute on function public.get_my_couple_id() from public, anon;
grant execute on function public.get_my_couple_id() to authenticated;

-- =============================================================================
-- Enable RLS on every table
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.push_tokens enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_settings enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.questions enable row level security;
alter table public.question_instances enable row level security;
alter table public.daily_pictures enable row level security;
alter table public.thinking_of_you enable row level security;
alter table public.pet_state enable row level security;
alter table public.pet_actions enable row level security;
alter table public.join_attempts enable row level security;

-- =============================================================================
-- profiles: read own + partner, update own only
-- =============================================================================

create policy profiles_select_own_or_partner on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.couple_members cm
      where cm.couple_id = public.get_my_couple_id()
        and cm.user_id = profiles.id
    )
  );

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- =============================================================================
-- push_tokens: own rows only
-- =============================================================================

create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = auth.uid());

create policy push_tokens_insert_own on public.push_tokens
  for insert to authenticated
  with check (user_id = auth.uid());

create policy push_tokens_update_own on public.push_tokens
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- couples: members can read their couple; all writes go through
-- security-definer RPCs (create/join/regenerate) invoked with the user's JWT.
-- =============================================================================

create policy couples_select_members on public.couples
  for select to authenticated
  using (id = public.get_my_couple_id());

-- =============================================================================
-- couple_members: non-recursive — own row directly, partner row via the
-- security definer function (which bypasses RLS, so no recursion).
-- Inserts/updates/deletes happen only via the join RPC (service context).
-- =============================================================================

create policy couple_members_select on public.couple_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or couple_id = public.get_my_couple_id()
  );

-- =============================================================================
-- couple_settings
-- =============================================================================

create policy couple_settings_select_members on public.couple_settings
  for select to authenticated
  using (couple_id = public.get_my_couple_id());

create policy couple_settings_update_members on public.couple_settings
  for update to authenticated
  using (couple_id = public.get_my_couple_id())
  with check (couple_id = public.get_my_couple_id());

-- =============================================================================
-- messages
-- =============================================================================

create policy messages_select_members on public.messages
  for select to authenticated
  using (couple_id = public.get_my_couple_id());

create policy messages_insert_members on public.messages
  for insert to authenticated
  with check (
    couple_id = public.get_my_couple_id()
    and sender_id = auth.uid()
  );

create policy messages_update_members on public.messages
  for update to authenticated
  using (couple_id = public.get_my_couple_id())
  with check (couple_id = public.get_my_couple_id());

create policy messages_delete_own on public.messages
  for delete to authenticated
  using (
    couple_id = public.get_my_couple_id()
    and sender_id = auth.uid()
  );

-- =============================================================================
-- message_reactions (no couple_id column — scoped through the message)
-- =============================================================================

create policy message_reactions_select_members on public.message_reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and m.couple_id = public.get_my_couple_id()
    )
  );

create policy message_reactions_insert_own on public.message_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and m.couple_id = public.get_my_couple_id()
    )
  );

create policy message_reactions_delete_own on public.message_reactions
  for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and m.couple_id = public.get_my_couple_id()
    )
  );

-- =============================================================================
-- questions / question_instances
-- AMBIGUITY NOTE: the brief asks that an author not be able to re-read their
-- own unanswered question, but also says to implement the simpler
-- visible-to-both version if that felt ambiguous — it did (the author wrote
-- the text themselves, so "hiding" it is not meaningfully enforceable client
-- side or useful). Questions and instances are therefore readable by both
-- members of the couple. Flagged for a founder decision.
-- =============================================================================

create policy questions_select_members on public.questions
  for select to authenticated
  using (couple_id = public.get_my_couple_id());

create policy questions_insert_author on public.questions
  for insert to authenticated
  with check (
    couple_id = public.get_my_couple_id()
    and created_by = auth.uid()
    and target_user_id <> auth.uid()
    and exists (
      select 1 from public.couple_members cm
      where cm.couple_id = public.get_my_couple_id()
        and cm.user_id = questions.target_user_id
    )
  );

create policy questions_update_author on public.questions
  for update to authenticated
  using (
    couple_id = public.get_my_couple_id()
    and created_by = auth.uid()
  )
  with check (
    couple_id = public.get_my_couple_id()
    and created_by = auth.uid()
  );

create policy questions_delete_author on public.questions
  for delete to authenticated
  using (
    couple_id = public.get_my_couple_id()
    and created_by = auth.uid()
  );

-- question_instances: readable by the couple; answerable only by the
-- recipient; inserts happen only via the issue-daily-question RPC.
create policy question_instances_select_members on public.question_instances
  for select to authenticated
  using (couple_id = public.get_my_couple_id());

create policy question_instances_update_recipient on public.question_instances
  for update to authenticated
  using (
    couple_id = public.get_my_couple_id()
    and recipient_id = auth.uid()
  )
  with check (
    couple_id = public.get_my_couple_id()
    and recipient_id = auth.uid()
  );

-- =============================================================================
-- daily_pictures: selfie once per partner per calendar day (unique
-- constraint is the source of truth); submissions are immutable.
-- =============================================================================

create policy daily_pictures_select_members on public.daily_pictures
  for select to authenticated
  using (couple_id = public.get_my_couple_id());

create policy daily_pictures_insert_own on public.daily_pictures
  for insert to authenticated
  with check (
    couple_id = public.get_my_couple_id()
    and user_id = auth.uid()
  );

-- =============================================================================
-- thinking_of_you: either partner may update (the responder sets
-- responded/thought_text); inserts are initiator-only.
-- =============================================================================

create policy thinking_of_you_select_members on public.thinking_of_you
  for select to authenticated
  using (couple_id = public.get_my_couple_id());

create policy thinking_of_you_insert_initiator on public.thinking_of_you
  for insert to authenticated
  with check (
    couple_id = public.get_my_couple_id()
    and initiator_id = auth.uid()
  );

create policy thinking_of_you_update_members on public.thinking_of_you
  for update to authenticated
  using (couple_id = public.get_my_couple_id())
  with check (couple_id = public.get_my_couple_id());

-- =============================================================================
-- pet_state / pet_actions
-- No pet mechanics are encoded here: members may update pet_state (the
-- founders' eventual care-action logic will drive HOW it changes) and insert
-- pet_actions with free-form action_type.
-- =============================================================================

create policy pet_state_select_members on public.pet_state
  for select to authenticated
  using (couple_id = public.get_my_couple_id());

create policy pet_state_update_members on public.pet_state
  for update to authenticated
  using (couple_id = public.get_my_couple_id())
  with check (couple_id = public.get_my_couple_id());

create policy pet_actions_select_members on public.pet_actions
  for select to authenticated
  using (couple_id = public.get_my_couple_id());

create policy pet_actions_insert_own on public.pet_actions
  for insert to authenticated
  with check (
    couple_id = public.get_my_couple_id()
    and user_id = auth.uid()
  );

-- =============================================================================
-- join_attempts: RLS enabled, no policies — accessible to the service role
-- only (rate limiting happens inside the join-couple Edge Function).
-- =============================================================================
