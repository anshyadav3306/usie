-- usie database check. Paste into the Supabase SQL Editor and run. It only reads, never changes anything.
-- Rows with ok = false are listed first. If any are false, run the migration named in "fix".

select check_name, ok, fix
from (values
  ('messages.media_duration_ms (voice notes)',      exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'media_duration_ms'), '0006_phase6.sql'),
  ('messages.media_waveform (voice notes)',         exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'media_waveform'), '0006_phase6.sql'),
  ('profiles.show_last_seen (privacy)',             exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'show_last_seen'), '0006_phase6.sql'),
  ('profiles.read_receipts (privacy)',              exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'read_receipts'), '0006_phase6.sql'),
  ('conversations.disappear_after',                 exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'conversations' and column_name = 'disappear_after'), '0006_phase6.sql'),
  ('trigger: messages expire on schedule',          exists (select 1 from pg_trigger where tgname = 'on_message_set_expiry'), '0006_phase6.sql'),
  ('function: message_in_conversation',             exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'message_in_conversation'), '0006_phase6.sql'),
  ('policy: expired messages hidden',               exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'messages' and policyname = 'messages_read' and qual like '%expires_at%'), '0006_phase6.sql'),
  ('policy: only uploader can delete a file',       exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'chat_media_delete' and qual like '%owner_id%'), '0006_phase6.sql'),
  ('bucket: avatars',                               exists (select 1 from storage.buckets where id = 'avatars'), '0006_phase6.sql'),
  ('logged-out visitors blocked from messages',     not has_table_privilege('anon', 'public.messages', 'select'), '0006_phase6.sql'),
  ('app cannot backdate messages',                  not has_column_privilege('authenticated', 'public.messages', 'created_at', 'insert'), '0006_phase6.sql'),

  ('table: push_subscriptions',                     exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'push_subscriptions'), '0004_phase4.sql'),
  ('function: save_push_subscription',              exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'save_push_subscription'), '0004_phase4.sql'),
  ('function: mark_read',                           exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'mark_read'), '0002_phase2.sql'),
  ('table: message_reactions',                      exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'message_reactions'), '0003_phase3.sql'),
  ('table: pinned_messages',                        exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'pinned_messages'), '0005_phase5.sql'),
  ('table: us_notes',                               exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'us_notes'), '0005_phase5.sql'),

  ('trigger: only two people can sign up',          exists (select 1 from pg_trigger where tgname = 'on_auth_user_created'), '0001_foundation.sql'),
  ('table: invites',                                exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'invites'), '0001_foundation.sql'),
  ('bucket: chat-media exists and is private',      exists (select 1 from storage.buckets where id = 'chat-media' and public = false), '0003_phase3.sql'),
  ('realtime: messages',                            exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages'), '0001_foundation.sql'),
  ('realtime: profiles (last seen)',                exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'profiles'), '0003_phase3.sql'),
  ('realtime: message_reactions',                   exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'message_reactions'), '0003_phase3.sql'),
  ('realtime: pinned_messages',                     exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pinned_messages'), '0005_phase5.sql')
) as t (check_name, ok, fix)
order by ok, fix, check_name;
