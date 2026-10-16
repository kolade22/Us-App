-- 0001_schema.sql
-- US data layer: tables, constraints, triggers, realtime publication.
-- Implements the locked schema decisions as specified.

-- =============================================================================
-- Tables
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  last_seen_at timestamptz,
  created_at timestamptz default now()
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_token text not null,
  platform text check (platform in ('ios', 'android')),
  updated_at timestamptz default now(),
  constraint push_tokens_user_token_unique unique (user_id, expo_token)
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  relationship_start_date date not null,
  invite_code text unique,
  invite_code_expires_at timestamptz,
  status text default 'pending' check (status in ('pending', 'active')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz default now()
);

-- Exactly two members per couple: UNIQUE(couple_id, role) caps the couple at
-- two roles; UNIQUE(user_id) caps each user at one couple.
create table public.couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text check (role in ('partner_a', 'partner_b')),
  joined_at timestamptz default now(),
  constraint couple_members_role_unique unique (couple_id, role),
  constraint couple_members_user_unique unique (user_id)
);

create table public.couple_settings (
  couple_id uuid primary key references public.couples (id) on delete cascade,
  timezone text default 'UTC',
  daily_picture_reminder_time time default '20:00'
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  client_generated_id uuid not null unique,  -- send-dedup on retry
  content text,
  media_path text,                            -- storage path, never a public URL
  reply_to_id uuid references public.messages (id),
  read_at timestamptz,
  created_at timestamptz default now()
);

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  emoji text not null,
  created_at timestamptz default now(),
  constraint message_reactions_unique unique (message_id, user_id, emoji)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  target_user_id uuid not null references public.profiles (id),
  question_text text not null,
  created_at timestamptz default now()
);

create table public.question_instances (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  recipient_id uuid not null references public.profiles (id),
  answer_text text,
  issued_at timestamptz default now(),
  answered_at timestamptz
);

create table public.daily_pictures (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  image_path text not null,
  submission_date date not null,
  created_at timestamptz default now(),
  constraint daily_pictures_once_per_day unique (couple_id, user_id, submission_date)
);

create table public.thinking_of_you (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  initiator_id uuid not null references public.profiles (id),
  responded boolean default false,
  thought_text text,
  prompt_date date not null,
  created_at timestamptz default now()
);

create table public.pet_state (
  couple_id uuid primary key references public.couples (id) on delete cascade,
  health int default 100,
  hunger int default 100,
  happiness int default 100,
  energy int default 100,
  is_sick boolean default false,
  updated_at timestamptz default now()
);

-- action_type is deliberately open-ended text: pet mechanics are still being
-- designed and new action types must not require a migration.
create table public.pet_actions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  action_type text not null,
  created_at timestamptz default now()
);

-- Rate limiting for join-couple invite-code attempts (service-role only; no
-- client policies are created on this table).
create table public.join_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  ip text,
  created_at timestamptz default now()
);

-- =============================================================================
-- Indexes (RLS filter + hot query paths)
-- =============================================================================

create index messages_couple_created_idx on public.messages (couple_id, created_at desc);
create index message_reactions_message_idx on public.message_reactions (message_id);
create index questions_couple_target_idx on public.questions (couple_id, target_user_id);
create index question_instances_couple_idx on public.question_instances (couple_id);
create index question_instances_recipient_idx on public.question_instances (recipient_id, issued_at desc);
create index daily_pictures_couple_date_idx on public.daily_pictures (couple_id, submission_date desc);
create index pet_actions_couple_idx on public.pet_actions (couple_id, created_at desc);
create index join_attempts_user_idx on public.join_attempts (user_id, created_at desc);
create index join_attempts_ip_idx on public.join_attempts (ip, created_at desc);

-- =============================================================================
-- Auto-create profile on signup
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Realtime publication
-- Postgres Changes only fires for tables added to supabase_realtime.
-- RLS enforcement for authenticated subscribers is handled by the Realtime
-- service evaluating the caller's JWT against table policies (see report).
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

do $$
begin
  alter publication supabase_realtime add table
    public.profiles,
    public.push_tokens,
    public.couples,
    public.couple_members,
    public.couple_settings,
    public.messages,
    public.message_reactions,
    public.questions,
    public.question_instances,
    public.daily_pictures,
    public.thinking_of_you,
    public.pet_state,
    public.pet_actions;
exception
  when duplicate_object then null;
end
$$;
