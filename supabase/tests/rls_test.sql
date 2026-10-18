-- Security tests for usie. Safe to run on a real project: everything happens in one transaction
-- that is rolled back at the end. Paste into the Supabase SQL Editor and run.
-- Expected last result: "ALL RLS TESTS PASSED". Any failure stops with "TEST FAILED: ...".

begin;

create function public._t_assert(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'TEST FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Runs a statement as a given database role and user. Returns 'OK:<rows>' or 'ERR:<sqlstate>'.
create function public._t_run(uid uuid, r text, q text) returns text language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', r)::text, true);
  perform set_config('role', r, true);
  begin
    execute q;
    get diagnostics n = row_count;
    execute 'reset role';
    return 'OK:' || n;
  exception when others then
    execute 'reset role';
    return 'ERR:' || sqlstate;
  end;
end $$;

-- Runs a statement as the admin and reports 'OK' or 'ERR:<sqlstate>'.
create function public._t_try(q text) returns text language plpgsql as $$
begin
  execute q;
  return 'OK';
exception when others then
  return 'ERR:' || sqlstate;
end $$;

do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  o uuid := '00000000-0000-0000-0000-00000000000f';  -- an outsider who is not in the couple's chat
  conv uuid;
  conv2 uuid;
  m_a uuid;
  m_b uuid;
  m_o uuid;
  note uuid;
  photo uuid;
begin
  -- Free the two-person cap for testing (this is rolled back).
  delete from public.profiles;
  insert into public.invites (code) values ('T-A'), ('T-B'), ('T-O'), ('T-D');

  -- ---------- Signup guard ----------
  perform public._t_assert(
    public._t_try($q$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'bad@t.test', '{"invite_code":"WRONG","username":"bad_t"}')$q$) like 'ERR:%',
    'signup with a wrong invite code is rejected');

  insert into auth.users (id, email, raw_user_meta_data) values (o, 'o@t.test', '{"invite_code":"T-O","display_name":"Outsider","username":"outsider_t"}');
  delete from public.profiles where id = o;  -- the outsider exists, but is in nobody's chat

  insert into auth.users (id, email, raw_user_meta_data) values (a, 'a@t.test', '{"invite_code":"T-A","display_name":"Alice","username":"alice_t"}');
  perform public._t_assert(
    public._t_try($q$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'x@t.test', '{"invite_code":"T-A","username":"x_t"}')$q$) like 'ERR:%',
    'an invite code cannot be used twice');

  insert into auth.users (id, email, raw_user_meta_data) values (b, 'b@t.test', '{"invite_code":"T-B","display_name":"Bob","username":"bob_t"}');
  perform public._t_assert(
    public._t_try($q$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'd@t.test', '{"invite_code":"T-D","username":"d_t"}')$q$) like 'ERR:%',
    'a third person cannot sign up');

  select conversation_id into conv from public.conversation_members where user_id = a limit 1;
  perform public._t_assert(conv is not null and exists (select 1 from public.conversation_members where conversation_id = conv and user_id = b),
    'joining creates the one chat between the two of them');

  -- A separate chat that only the outsider belongs to.
  insert into public.conversations (type, created_by) values ('direct', o) returning id into conv2;
  insert into public.conversation_members (conversation_id, user_id) values (conv2, o);

  -- Seed messages as the admin.
  insert into public.messages (conversation_id, sender_id, body) values (conv, a, 'from alice') returning id into m_a;
  insert into public.messages (conversation_id, sender_id, body) values (conv, b, 'from bob') returning id into m_b;
  insert into public.messages (conversation_id, sender_id, body) values (conv2, o, 'secret') returning id into m_o;
  insert into public.messages (conversation_id, sender_id, body) values (conv, b, 'already expired');
  update public.messages set expires_at = now() - interval '1 hour' where body = 'already expired';  -- the insert trigger sets expiry itself, so expire it afterwards

  -- ---------- Reading ----------
  perform public._t_assert(public._t_run(a, 'authenticated', format('select 1 from public.messages where conversation_id = %L', conv)) = 'OK:2',
    'a member sees their messages, and expired ones are hidden');
  perform public._t_assert(public._t_run(a, 'authenticated', format('select 1 from public.messages where conversation_id = %L', conv2)) = 'OK:0',
    'a member cannot see another conversation');
  perform public._t_assert(public._t_run(o, 'authenticated', format('select 1 from public.messages where conversation_id = %L', conv)) = 'OK:0',
    'an outsider cannot read the couple''s messages');
  perform public._t_assert(public._t_run(o, 'authenticated', format('select 1 from public.conversation_members where conversation_id = %L', conv)) = 'OK:0',
    'an outsider cannot see who is in the chat');
  perform public._t_assert(public._t_run(o, 'authenticated', format('select 1 from public.conversations where id = %L', conv)) = 'OK:0',
    'an outsider cannot see the conversation');

  -- ---------- Sending, editing, deleting ----------
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into public.messages (conversation_id, sender_id, body) values (%L, %L, %L)', conv, a, 'hi')) = 'OK:1',
    'a member can send a message');
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into public.messages (conversation_id, sender_id, body) values (%L, %L, %L)', conv, b, 'pretending')) = 'ERR:42501',
    'a member cannot send as the other person');
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into public.messages (conversation_id, sender_id, body) values (%L, %L, %L)', conv2, a, 'intruding')) = 'ERR:42501',
    'a member cannot post into someone else''s conversation');
  perform public._t_assert(public._t_run(o, 'authenticated', format('insert into public.messages (conversation_id, sender_id, body) values (%L, %L, %L)', conv, o, 'intruding')) = 'ERR:42501',
    'an outsider cannot post into the couple''s chat');
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into public.messages (conversation_id, sender_id, body, created_at) values (%L, %L, %L, %L)', conv, a, 'backdated', '2000-01-01')) = 'ERR:42501',
    'a member cannot backdate a message');
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.messages set body = %L where id = %L', 'edited', m_b)) = 'OK:0',
    'a member cannot edit the other person''s message');
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.messages set body = %L where id = %L', 'edited', m_a)) = 'OK:1',
    'a member can edit their own message');
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.messages set sender_id = %L where id = %L', b, m_a)) = 'ERR:42501',
    'a message''s sender cannot be changed');
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.messages set conversation_id = %L where id = %L', conv2, m_a)) = 'ERR:42501',
    'a message cannot be moved to another conversation');

  -- ---------- Disappearing messages ----------
  update public.conversations set disappear_after = 3600 where id = conv;
  perform public._t_run(a, 'authenticated', format('insert into public.messages (conversation_id, sender_id, body) values (%L, %L, %L)', conv, a, 'ttl'));
  perform public._t_assert((select expires_at is not null from public.messages where body = 'ttl'),
    'new messages get an expiry when disappearing messages are on');
  update public.conversations set disappear_after = null where id = conv;

  -- ---------- Reactions ----------
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into public.message_reactions (message_id, user_id, conversation_id, emoji) values (%L, %L, %L, %L)', m_b, a, conv, '❤️')) = 'OK:1',
    'a member can react to a message in their chat');
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into public.message_reactions (message_id, user_id, conversation_id, emoji) values (%L, %L, %L, %L)', m_a, b, conv, '👍')) = 'ERR:42501',
    'a member cannot react as the other person');
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into public.message_reactions (message_id, user_id, conversation_id, emoji) values (%L, %L, %L, %L)', m_o, a, conv, '👍')) = 'ERR:42501',
    'a reaction cannot point at a message from another conversation');
  perform public._t_assert(public._t_run(o, 'authenticated', format('select 1 from public.message_reactions where conversation_id = %L', conv)) = 'OK:0',
    'an outsider cannot see reactions');

  -- ---------- Pins ----------
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into public.pinned_messages (conversation_id, message_id, pinned_by) values (%L, %L, %L)', conv, m_a, a)) = 'OK:1',
    'a member can pin a message');
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into public.pinned_messages (conversation_id, message_id, pinned_by) values (%L, %L, %L)', conv, m_o, a)) = 'ERR:42501',
    'a pin cannot point at a message from another conversation');

  -- ---------- Us page ----------
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into public.us_photos (conversation_id, media_path) values (%L, %L)', conv, conv || '/us/p.jpg')) = 'OK:1',
    'a member can add a photo');
  select id into photo from public.us_photos where conversation_id = conv limit 1;
  perform public._t_assert(public._t_run(b, 'authenticated', format('delete from public.us_photos where id = %L', photo)) = 'OK:0',
    'only the uploader can delete a photo');
  perform public._t_assert(public._t_run(o, 'authenticated', format('select 1 from public.us_photos where conversation_id = %L', conv)) = 'OK:0',
    'an outsider cannot see the photo wall');
  perform public._t_assert(public._t_run(a, 'authenticated', format('delete from public.us_photos where id = %L', photo)) = 'OK:1',
    'the uploader can delete their photo');

  perform public._t_run(a, 'authenticated', format('insert into public.us_notes (conversation_id, title, body) values (%L, %L, %L)', conv, 'plan', 'x'));
  select id into note from public.us_notes where conversation_id = conv limit 1;
  perform public._t_assert(public._t_run(b, 'authenticated', format('update public.us_notes set body = %L where id = %L', 'edited by bob', note)) = 'OK:1',
    'both of them can edit a shared note');
  perform public._t_assert(public._t_run(o, 'authenticated', format('update public.us_notes set body = %L where id = %L', 'hacked', note)) = 'OK:0',
    'an outsider cannot edit a shared note');
  perform public._t_assert(public._t_run(o, 'authenticated', format('insert into public.us_countdowns (conversation_id, title, target_date) values (%L, %L, %L)', conv, 'x', '2030-01-01')) = 'ERR:42501',
    'an outsider cannot add a countdown');

  -- ---------- Profiles ----------
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.profiles set about = %L where id = %L', 'hello', a)) = 'OK:1',
    'a member can edit their own profile');
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.profiles set about = %L where id = %L', 'hacked', b)) = 'OK:0',
    'a member cannot edit the other person''s profile');
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.profiles set id = %L where id = %L', o, a)) = 'ERR:42501',
    'a profile''s id cannot be changed');
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.profiles set avatar_url = %L where id = %L', 'https://evil.example/pixel.png', a)) = 'ERR:23514',
    'an avatar cannot point at an outside website');
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.profiles set avatar_url = %L where id = %L', 'https://x.supabase.co/storage/v1/object/public/avatars/a/p.jpg', a)) = 'OK:1',
    'an avatar can point at the avatars bucket');

  -- ---------- Chat settings ----------
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.conversation_members set muted = true where conversation_id = %L and user_id = %L', conv, a)) = 'OK:1',
    'a member can mute their own notifications');
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.conversation_members set muted = true where conversation_id = %L and user_id = %L', conv, b)) = 'OK:0',
    'a member cannot change the other person''s settings');
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.conversation_members set role = %L where conversation_id = %L and user_id = %L', 'admin', conv, a)) = 'ERR:42501',
    'a member cannot change their own role');
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.conversations set wallpaper = %L where id = %L', 'stars', conv)) = 'OK:1',
    'a member can change the wallpaper');
  perform public._t_assert(public._t_run(a, 'authenticated', format('update public.conversations set created_by = %L where id = %L', o, conv)) = 'ERR:42501',
    'a conversation''s owner cannot be changed');
  perform public._t_assert(public._t_run(o, 'authenticated', format('update public.conversations set wallpaper = %L where id = %L', 'hacked', conv)) = 'OK:0',
    'an outsider cannot change the wallpaper');

  -- ---------- Logged-out visitors and invite codes ----------
  perform public._t_assert(public._t_run(a, 'anon', 'select 1 from public.messages') = 'ERR:42501', 'logged-out visitors cannot read messages');
  perform public._t_assert(public._t_run(a, 'anon', 'select 1 from public.profiles') = 'ERR:42501', 'logged-out visitors cannot read profiles');
  perform public._t_assert(public._t_run(a, 'authenticated', 'select 1 from public.invites') = 'ERR:42501', 'invite codes cannot be read from the app');

  -- ---------- Push subscriptions ----------
  perform public._t_assert(public._t_run(a, 'authenticated', $q$select public.save_push_subscription('https://push.example/1', 'k', 'a', 'ua')$q$) = 'OK:1',
    'a device can register for notifications');
  perform public._t_assert(public._t_run(a, 'authenticated', 'select 1 from public.push_subscriptions') = 'OK:1', 'a member sees their own device');
  perform public._t_assert(public._t_run(b, 'authenticated', 'select 1 from public.push_subscriptions') = 'OK:0', 'a member cannot see the other person''s devices');

  -- ---------- Files ----------
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)', 'chat-media', conv || '/photo.jpg', a)) = 'OK:1',
    'a member can upload into their conversation folder');
  perform public._t_assert(public._t_run(o, 'authenticated', format('insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)', 'chat-media', conv || '/evil.jpg', o)) = 'ERR:42501',
    'an outsider cannot upload into the couple''s folder');
  perform public._t_assert(public._t_run(o, 'authenticated', format('select 1 from storage.objects where bucket_id = %L', 'chat-media')) = 'OK:0',
    'an outsider cannot see the couple''s files');
  -- Supabase refuses plain-SQL deletes on its file table (deleting must go through the Storage API),
  -- so this checks the rule itself, and also that the other person's delete attempt gets nowhere.
  perform public._t_assert(
    exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'chat_media_delete' and qual like '%owner_id%'),
    'the file-delete rule requires being the uploader');
  perform public._t_assert(
    public._t_run(b, 'authenticated', format('delete from storage.objects where bucket_id = %L and name = %L', 'chat-media', conv || '/photo.jpg')) in ('OK:0') or
    public._t_run(b, 'authenticated', format('delete from storage.objects where bucket_id = %L and name = %L', 'chat-media', conv || '/photo.jpg')) like 'ERR:%',
    'the other person cannot delete someone else''s file');
  perform public._t_assert(exists (select 1 from storage.objects where bucket_id = 'chat-media' and name = conv || '/photo.jpg'),
    'the file is still there after that attempt');
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)', 'avatars', b || '/me.jpg', a)) = 'ERR:42501',
    'nobody can upload into someone else''s avatar folder');
  perform public._t_assert(public._t_run(a, 'authenticated', format('insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)', 'avatars', a || '/me.jpg', a)) = 'OK:1',
    'a member can upload their own avatar');
end $$;

rollback;
select 'ALL RLS TESTS PASSED' as result;