# usie security notes

## What is enforced (in the database, not just the app)
- **Only two people.** Signup needs a one-time invite code, and a database trigger refuses a third account.
- **Only the two of you can read anything.** Every table has Row Level Security. A message, reaction, pin, note, photo, countdown or setting is visible only to members of that conversation.
- **No impersonation.** You can only send as yourself, react as yourself, and edit or delete your own messages.
- **Narrow permissions.** The app can only change the specific columns it needs. It cannot backdate messages, move a message to another chat, change a sender, or change anyone's role.
- **Logged-out visitors get nothing.** The public `anon` role has no access to any table. Invite codes cannot be read from the app at all.
- **Files are private.** Photos and voice notes are in a private bucket, shown through links that expire after 6 hours. Only the uploader can delete a file.
- **Disappearing messages are real.** Once a message expires the database stops returning it. A daily job then deletes the row and its file.
- **Webhooks and cron are locked.** `/api/push/notify` and `/api/cron/expire` reject any request without the exact secret.
- **Browser protections.** HTTPS-only (HSTS), no framing, microphone allowed only for this site, referrer trimmed.

## How it was tested
`supabase/tests/rls_test.sql` signs in as two users and an outsider and tries 55 things that must be blocked or allowed. It runs inside a transaction that is rolled back, so it is safe on your real project: paste it into the Supabase SQL Editor and expect `ALL RLS TESTS PASSED`. Run it again after any change to the database.
`npm test` runs the app's logic tests.

## Things you should know (honest trade-offs)
- **Not end-to-end encrypted.** Messages are protected by access rules and HTTPS, but they are stored readable in your Supabase project. Whoever controls that Supabase account (you) can read them. True end-to-end encryption is possible but would remove search and make losing a phone lose history.
- **Read receipts and last seen are courtesy settings.** They hide things in the app, but the underlying data is still visible to the other account if someone queries the API directly. Fine between two people who trust each other; not a defence against a determined attacker.
- **Profile photos are in a public bucket.** The links are long and unguessable, but anyone who has a link can open it. Chat photos and voice notes are private.
- **Notifications show message text on the lock screen.** Anyone holding an unlocked-notification phone can read the preview.
- **Disappearing messages cannot stop screenshots** or someone copying text.

## Your checklist
1. Use long, random invite codes (not words), and let each be used once. Delete unused ones after you both join.
2. Keep `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `WEBHOOK_SECRET` and `CRON_SECRET` only in Vercel. Never commit them or paste them in chat. If one leaks, rotate it.
3. In Supabase, Authentication, turn on leaked-password protection and keep the default rate limits.
4. Use strong, different passwords for each of you, and for Supabase and Vercel (turn on two-factor for both).
5. After signing up, set Authentication, Providers, Email, "Enable sign ups" to off so nobody new can register even with a code.
