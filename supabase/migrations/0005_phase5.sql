-- Phase 5: the Us page, pinned messages and fast message search.

-- Trigram index makes "contains" search fast.
create extension if not exists pg_trgm with schema extensions;
create index if not exists messages_body_trgm_idx on public.messages using gin (body extensions.gin_trgm_ops);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Tables ----------
create table public.shared_space (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  anniversary_date date,
  updated_at timestamptz not null default now()
);
create trigger shared_space_touch before update on public.shared_space
  for each row execute function public.touch_updated_at();

create table public.us_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger us_notes_touch before update on public.us_notes
  for each row execute function public.touch_updated_at();

create table public.us_countdowns (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  target_date date not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.us_bucket_items (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.us_photos (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  media_path text not null,
  media_width int,
  media_height int,
  caption text,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.pinned_messages (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid references auth.users(id) on delete set null default auth.uid(),
  pinned_at timestamptz not null default now(),
  primary key (conversation_id, message_id)
);

create index us_notes_conv_idx on public.us_notes (conversation_id, updated_at desc);
create index us_countdowns_conv_idx on public.us_countdowns (conversation_id, target_date);
create index us_bucket_conv_idx on public.us_bucket_items (conversation_id, created_at);
create index us_photos_conv_idx on public.us_photos (conversation_id, created_at desc);

-- ---------- Row Level Security: only the two members can touch any of it ----------
do $$
declare t text;
begin
  foreach t in array array['shared_space', 'us_notes', 'us_countdowns', 'us_bucket_items', 'us_photos', 'pinned_messages']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(conversation_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member(conversation_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member(conversation_id)) with check (public.is_member(conversation_id))', t || '_update', t);
  end loop;
end;
$$;

-- Deleting: shared lists are open to both of you; photos only by whoever added them.
create policy "us_notes_delete" on public.us_notes for delete to authenticated using (public.is_member(conversation_id));
create policy "us_countdowns_delete" on public.us_countdowns for delete to authenticated using (public.is_member(conversation_id));
create policy "us_bucket_items_delete" on public.us_bucket_items for delete to authenticated using (public.is_member(conversation_id));
create policy "pinned_messages_delete" on public.pinned_messages for delete to authenticated using (public.is_member(conversation_id));
create policy "us_photos_delete" on public.us_photos for delete to authenticated
  using (public.is_member(conversation_id) and uploaded_by = auth.uid());

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.shared_space;
alter publication supabase_realtime add table public.us_notes;
alter publication supabase_realtime add table public.us_countdowns;
alter publication supabase_realtime add table public.us_bucket_items;
alter publication supabase_realtime add table public.us_photos;
alter publication supabase_realtime add table public.pinned_messages;
