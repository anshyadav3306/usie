-- Phase 6: voice notes, privacy settings, avatars, disappearing messages, and a security hardening pass.

-- =====================================================================
-- Voice notes
-- =====================================================================
alter table public.messages
  add column if not exists media_duration_ms int check (media_duration_ms is null or media_duration_ms between 0 and 600000),
  add column if not exists media_waveform int[] check (media_waveform is null or array_length(media_waveform, 1) <= 100);

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a'
]
where id = 'chat-media';

-- =====================================================================
-- Profile privacy + avatars
-- =====================================================================
alter table public.profiles
  add column if not exists show_last_seen boolean not null default true,
  add column if not exists read_receipts boolean not null default true;

-- An avatar can only point at a file in this project's avatars bucket (no tracking pixels from elsewhere).
alter table public.profiles
  add constraint profiles_avatar_url_check
  check (avatar_url is null or avatar_url ~ '^https?://[^/]+/storage/v1/object/public/avatars/');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- Disappearing messages
-- =====================================================================
alter table public.conversations
  add column if not exists disappear_after int check (disappear_after is null or disappear_after between 60 and 31536000);

create or replace function public.set_message_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare secs int;
begin
  select disappear_after into secs from public.conversations where id = new.conversation_id;
  if secs is not null then
    new.expires_at := new.created_at + make_interval(secs => secs);
  else
    new.expires_at := null;
  end if;
  return new;
end;
$$;

create trigger on_message_set_expiry
before insert on public.messages
for each row execute function public.set_message_expiry();

-- Expired messages vanish at the database level, not just on screen.
drop policy "messages_read" on public.messages;
create policy "messages_read" on public.messages for select to authenticated
  using (public.is_member(conversation_id) and (expires_at is null or expires_at > now()));

-- =====================================================================
-- Security hardening
-- =====================================================================

-- 1. A reaction or pin must point at a message in the same conversation.
create or replace function public.message_in_conversation(msg uuid, conv uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.messages where id = msg and conversation_id = conv);
$$;

drop policy "reactions_insert" on public.message_reactions;
drop policy "reactions_update_own" on public.message_reactions;
create policy "reactions_insert" on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(conversation_id) and public.message_in_conversation(message_id, conversation_id));
create policy "reactions_update_own" on public.message_reactions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member(conversation_id) and public.message_in_conversation(message_id, conversation_id));

drop policy "pinned_messages_insert" on public.pinned_messages;
drop policy "pinned_messages_update" on public.pinned_messages;
create policy "pinned_messages_insert" on public.pinned_messages for insert to authenticated
  with check (pinned_by = auth.uid() and public.is_member(conversation_id) and public.message_in_conversation(message_id, conversation_id));
create policy "pinned_messages_update" on public.pinned_messages for update to authenticated
  using (public.is_member(conversation_id))
  with check (pinned_by = auth.uid() and public.is_member(conversation_id) and public.message_in_conversation(message_id, conversation_id));

-- 2. Column-level permissions: the app can only touch the columns it needs.
revoke insert, update on public.messages from authenticated;
grant insert (id, conversation_id, sender_id, type, body, reply_to, media_path, media_width, media_height, media_duration_ms, media_waveform)
  on public.messages to authenticated;
grant update (body, edited_at, deleted_at, media_path, media_width, media_height, media_duration_ms, media_waveform)
  on public.messages to authenticated;

revoke insert, update, delete on public.profiles from authenticated;
grant update (username, display_name, avatar_url, about, theme, last_seen_at, show_last_seen, read_receipts)
  on public.profiles to authenticated;

revoke insert, update, delete on public.conversations from authenticated;
grant update (wallpaper, disappear_after) on public.conversations to authenticated;

revoke insert, update, delete on public.conversation_members from authenticated;
grant update (last_read_at, muted, pinned) on public.conversation_members to authenticated;

-- 3. Logged-out visitors get nothing, and invite codes are never readable from the app.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
revoke all on public.invites from authenticated;

-- 4. Only the person who uploaded a file can delete it.
drop policy if exists "chat_media_delete" on storage.objects;
create policy "chat_media_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and public.is_member(((storage.foldername(name))[1])::uuid)
    and owner_id = auth.uid()::text
  );
