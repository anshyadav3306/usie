-- Phase 3: photos, reactions, online status.

-- Photos live directly on the message (one photo per message).
alter table public.messages
  add column if not exists media_path text,
  add column if not exists media_width int,
  add column if not exists media_height int;

-- Reactions: one emoji per person per message.
create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index message_reactions_conversation_idx on public.message_reactions (conversation_id);

alter table public.message_reactions enable row level security;

create policy "reactions_read" on public.message_reactions for select to authenticated
  using (public.is_member(conversation_id));
create policy "reactions_insert" on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(conversation_id));
create policy "reactions_update_own" on public.message_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(conversation_id));
create policy "reactions_delete_own" on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

alter table public.message_reactions replica identity full;
alter publication supabase_realtime add table public.message_reactions;

-- "Last seen" updates reach the other person live.
alter publication supabase_realtime add table public.profiles;

-- Private photo storage. Folder name = conversation id, so only its members can touch the files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "chat_media_read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "chat_media_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "chat_media_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and public.is_member(((storage.foldername(name))[1])::uuid));
