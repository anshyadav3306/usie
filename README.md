# usie

Private two-person chat. Phase 1 gives you: invite-only auth, database + security rules, and a live Vercel deployment.

## 1. Run locally
```bash
npm install
cp .env.example .env.local   # fill in the two Supabase values
npm run dev
```

## 2. Supabase
1. Create a project at supabase.com.
2. SQL Editor: run `supabase/migrations/0001_foundation.sql`.
3. Edit `supabase/seed_invites.sql` with two secret codes and run it.
4. Authentication > Providers > Email: turn **Confirm email** OFF (only two users, simpler).
5. Project Settings > API: copy the Project URL and the anon public key into `.env.local`.

## 3. Deploy to Vercel
1. Push this folder to a GitHub repo.
2. Vercel > Add New Project > import the repo.
3. Add the same two environment variables.
4. Deploy. After the first deploy, in Supabase go to Authentication > URL Configuration and set Site URL to your Vercel URL.

## 4. Test
Sign up with code 1, sign out, sign up the second account with code 2. Both should land on the chats page and see each other's name. A third signup must fail.

---

## Phase 2 update (chat list + realtime conversation)

If you already did Phase 1:
1. Supabase SQL Editor: run `supabase/migrations/0002_phase2.sql`.
2. Replace your project files with this version (keep your `.env.local`), then `npm install` and `npm run dev`.
3. Open the app in two browsers (one normal window, one incognito), one per account.
4. Send a message from one. It should appear instantly in the other, with a double tick once the other person opens the chat.

If you are starting fresh, follow the Phase 1 steps above and also run `0002_phase2.sql`.

---

## Phase 3 update (photos, replies, reactions, edit/delete, typing, online)

1. Supabase SQL Editor: run `supabase/migrations/0003_phase3.sql` (adds reactions, the private `chat-media` photo bucket and online status).
2. Replace your project files with this version (keep `.env.local`), `npm install`, `npm run dev`.
3. Test in two windows:
   - Send a photo (the picture button in the message bar).
   - Press and hold a message on a phone, or right-click / hover and click the dots on a laptop. Try react, reply, copy, edit and delete.
   - Type in one window and watch "typing..." appear in the other.
   - Close one window and watch "Last seen" show in the other.

---

## Phase 4 update (installable app + push notifications)

### 1. Database
Supabase SQL Editor: run `supabase/migrations/0004_phase4.sql`.

### 2. Make your push keys (once, on your computer)
```bash
npx web-push generate-vapid-keys
```
Keep the private key secret. Also make a long random string to use as `WEBHOOK_SECRET`.

### 3. Vercel environment variables
Project Settings > Environment Variables, then redeploy:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key |
| `VAPID_SUBJECT` | `mailto:your-email@example.com` |
| `WEBHOOK_SECRET` | your random string |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API keys > service_role (secret, never share it) |

For local testing put the same values in `.env.local`.

### 4. Supabase database webhook (this is what sends the notification)
Supabase > Database > Webhooks > Create a new hook:
- Table: `messages`, Events: **Insert**
- Type: HTTP Request, Method: POST
- URL: `https://YOUR-APP.vercel.app/api/push/notify`
- HTTP Headers: add `x-webhook-secret` with your `WEBHOOK_SECRET` value (keep `Content-Type: application/json`)

### 5. Install and test
1. Open the live Vercel URL on each phone. Settings > Install app. On iPhone: Share > Add to Home Screen, then open usie from the Home Screen icon.
2. In Settings > Notifications tap **Turn on notifications**, allow, then **Send a test**.
3. Close the app on one phone and send a message from the other. A notification should arrive; tapping it opens the chat.

Notes: iPhone needs iOS 16.4 or later and the Home Screen install. Notifications need HTTPS (Vercel provides it). The unread count appears on the app icon on devices that support it.

---

## Phase 5 update (Us page, wallpapers, pinned messages, search)

1. Supabase SQL Editor: run `supabase/migrations/0005_phase5.sql`.
2. Replace your project files with this version (keep `.env.local`), `npm install`, `npm run dev`. Vercel redeploys when you push.
3. Try it with both accounts:
   - **Us** tab: set your date, add photos, write a note, tick a bucket-list item, add a countdown. Watch it appear on the other account.
   - **Pin**: press and hold (or right-click) a message > Pin. A banner appears at the top of the chat; tap it to jump to the message.
   - **Wallpaper and mute**: tap the (i) button in the chat header. The wallpaper is shared by both of you; mute is only for you.
   - **Search** tab: type a word. Tap a result to jump straight to that message.

---

## Phase 6 update (voice notes, profile, privacy, disappearing messages, security)

### 1. Database
Supabase SQL Editor: run `supabase/migrations/0006_phase6.sql`, then run `supabase/tests/rls_test.sql`. The last line should say `ALL RLS TESTS PASSED`.

### 2. Vercel
- Add `CRON_SECRET` (any long random string) in Environment Variables, then redeploy. `vercel.json` already schedules the daily cleanup.
- Replace your project files with this version (keep `.env.local`), `npm install`.

### 3. Forgot password (one-time Supabase setup)
Supabase > Authentication > URL Configuration: add `https://YOUR-APP.vercel.app/auth/callback` under **Redirect URLs**.
The reset link works out of the box when opened in the same browser or phone that asked for it. To make it work from any device, edit Authentication > Email Templates > **Reset Password** and set the link to:
```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
```

### 4. Try it
- **Voice note:** tap the microphone (appears when the message box is empty), talk, tap the arrow to send. Tap the bin to discard.
- **Profile:** Settings > Profile. Change your name, username, about line and photo. Your person sees it update live.
- **Privacy:** Settings > Privacy. Turn off last seen or read receipts.
- **Disappearing messages:** chat (i) button > Disappearing messages > 24 hours or 7 days. Applies to new messages for both of you.
- **Tests:** `npm test`.

Read `SECURITY.md` for what is protected and what is not.

---

## Notifications: setup checklist and troubleshooting

Vercel > Settings > Environment Variables. The names must match exactly:

| Name | What it is | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | no |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key | **yes** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | public half of the push key pair | no |
| `VAPID_PRIVATE_KEY` | private half of the same pair | **yes** |
| `VAPID_SUBJECT` | `mailto:you@example.com` | no |
| `WEBHOOK_SECRET` | random string, same one in the Supabase webhook header | **yes** |
| `CRON_SECRET` | random string | **yes** |

Paste each value exactly, with no quotes and no spaces around it.
Variables that start with `NEXT_PUBLIC_` are baked in when the app is built, so after changing one, redeploy with **Use existing Build Cache turned off**.

In the app: Settings > Notifications > **Check server setup** tells you what is missing or wrong.

| Message | Meaning |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY is missing` | Add the variable in Vercel and redeploy. |
| `keys are not a matching pair` | Generate one new pair (`npx web-push generate-vapid-keys`) and set both. |
| `Brave blocks push notifications` | brave://settings/privacy > turn on "Use Google services for push messaging" > restart Brave. |
| `Saving this device failed: ...` | The database refused the save. Run `supabase/tests/schema_check.sql`. |
| `push service rejected this server's keys (403)` | Old sign-up from before a key change. Turn notifications off and on again on that device. |

Database health check: run `supabase/tests/schema_check.sql`. Every row should say `true`.
