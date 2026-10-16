-- Phase 1: foundation for a private two-person chat.
-- Run this once in Supabase: SQL Editor > New query > paste > Run.

create extension if not exists "pgcrypto";

-- ---------- Tables ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  about text,
  theme text not null default 'pastel',
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.invites (
  code text primary key,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'direct' check (type in ('direct', 'group')),
  name text,
  wallpaper text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  pinned boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'text' check (type in ('text', 'image', 'file', 'voice', 'gif', 'system')),
  body text,
  reply_to uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index conversation_members_user_idx on public.conversation_members (user_id);

-- ---------- Helper: membership check (avoids RLS recursion) ----------
create or replace function public.is_member(conv uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- profiles: any signed-in user can read (only two exist); you edit only your own
create policy "profiles_read" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- invites: no policies on purpose. Only the signup trigger and the SQL editor can touch it.

-- conversations
create policy "conversations_read" on public.conversations for select to authenticated
  using (public.is_member(id));
create policy "conversations_update" on public.conversations for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

-- conversation_members
create policy "members_read" on public.conversation_members for select to authenticated
  using (public.is_member(conversation_id));
create policy "members_update_own" on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messages
create policy "messages_read" on public.messages for select to authenticated
  using (public.is_member(conversation_id));
create policy "messages_insert" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_member(conversation_id));
create policy "messages_update_own" on public.messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- ---------- Keep conversation list sorted ----------
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_inserted
after insert on public.messages
for each row execute function public.touch_conversation();

-- ---------- Signup guard: invite code required, max 2 people ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := new.raw_user_meta_data->>'invite_code';
  v_count int;
  v_other uuid;
  v_conv uuid;
  v_name text := coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1));
  v_user text := lower(coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1)));
begin
  select count(*) into v_count from public.profiles;
  if v_count >= 2 then
    raise exception 'This space already has two people';
  end if;

  update public.invites set used_by = new.id, used_at = now()
  where code = v_code and used_by is null;
  if not found then
    raise exception 'Invalid or used invite code';
  end if;

  insert into public.profiles (id, username, display_name) values (new.id, v_user, v_name);

  -- When the second person joins, create their one private conversation.
  select id into v_other from public.profiles where id <> new.id limit 1;
  if v_other is not null then
    insert into public.conversations (type, created_by) values ('direct', v_other) returning id into v_conv;
    insert into public.conversation_members (conversation_id, user_id) values (v_conv, v_other), (v_conv, new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- Realtime (used from Phase 2) ----------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.conversations;
