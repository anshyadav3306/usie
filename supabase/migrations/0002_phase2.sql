-- Phase 2: server-side read marker (uses the database clock, not the phone's).
create or replace function public.mark_read(conv uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.conversation_members
  set last_read_at = now()
  where conversation_id = conv and user_id = auth.uid();
$$;
