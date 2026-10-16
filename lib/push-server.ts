import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  badge?: number;
};

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

// Sends to every stored device, and removes devices the browser says are gone.
export async function sendToSubscriptions(admin: SupabaseClient, subs: SubRow[], payload: PushPayload) {
  if (!configure()) throw new Error("VAPID keys are not configured");
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
        TTL: 60 * 60 * 24,
        urgency: "high",
      })
    )
  );

  const dead: string[] = [];
  let sent = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") sent += 1;
    else {
      const code = (r.reason as { statusCode?: number } | undefined)?.statusCode;
      if (code === 404 || code === 410) dead.push(subs[i].id);
    }
  });
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  return { sent, failed: subs.length - sent, removed: dead.length };
}
