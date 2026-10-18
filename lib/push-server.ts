import { createECDH } from "node:crypto";
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

const clean = (v: string | undefined) => v?.trim() || "";

// True only when the public key really is the matching half of the private key.
export function vapidKeysMatch(publicKey?: string, privateKey?: string) {
  const pub = clean(publicKey);
  const priv = clean(privateKey);
  if (!pub || !priv) return false;
  // Quotes or stray characters would break the browser even though the server tolerates them.
  const clean64 = /^[A-Za-z0-9_-]+$/;
  if (!clean64.test(pub) || !clean64.test(priv)) return false;
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(priv, "base64url"));
    return ecdh.getPublicKey().equals(Buffer.from(pub, "base64url"));
  } catch {
    return false;
  }
}

export function subjectOk(subject?: string) {
  return /^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(clean(subject));
}

// Names only, never values: which settings exist on the server.
export function configStatus() {
  const settings = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: !!clean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    VAPID_PRIVATE_KEY: !!clean(process.env.VAPID_PRIVATE_KEY),
    VAPID_SUBJECT: !!clean(process.env.VAPID_SUBJECT),
    SUPABASE_SERVICE_ROLE_KEY: !!clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    WEBHOOK_SECRET: !!clean(process.env.WEBHOOK_SECRET),
    CRON_SECRET: !!clean(process.env.CRON_SECRET),
  };
  const keysMatch = vapidKeysMatch(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const subjectValid = subjectOk(process.env.VAPID_SUBJECT);

  const problems: string[] = [];
  for (const [name, present] of Object.entries(settings)) {
    if (!present) problems.push(`${name} is not set in Vercel.`);
  }
  if (settings.VAPID_SUBJECT && !subjectValid) problems.push("VAPID_SUBJECT must look like mailto:you@example.com (or an https:// address).");
  if (settings.NEXT_PUBLIC_VAPID_PUBLIC_KEY && settings.VAPID_PRIVATE_KEY && !keysMatch) {
    problems.push("The VAPID public and private keys are not a matching pair, or one has stray characters such as quotes or spaces. Generate one new pair and paste each value exactly, with nothing around it.");
  }
  return { settings, keysMatch, subjectValid, problems };
}

function configure() {
  const status = configStatus();
  const needed = ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;
  const missing = needed.filter((n) => !status.settings[n]);
  if (missing.length) throw new Error(`The server is missing ${missing.join(", ")}. Add them in Vercel, then redeploy.`);
  if (!status.subjectValid) throw new Error("VAPID_SUBJECT must look like mailto:you@example.com.");
  if (!status.keysMatch) throw new Error("The VAPID public and private keys are not a matching pair, or one has stray characters such as quotes or spaces.");
  webpush.setVapidDetails(clean(process.env.VAPID_SUBJECT), clean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY), clean(process.env.VAPID_PRIVATE_KEY));
}

export type SendResult = {
  sent: number;
  failed: number;
  removed: number;
  firstError: { status?: number; body?: string } | null;
};

// Sends to every stored device, and removes devices the browser says are gone.
export async function sendToSubscriptions(admin: SupabaseClient, subs: SubRow[], payload: PushPayload): Promise<SendResult> {
  configure();
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
  let firstError: SendResult["firstError"] = null;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") return void (sent += 1);
    const reason = r.reason as { statusCode?: number; body?: string } | undefined;
    firstError ??= { status: reason?.statusCode, body: reason?.body?.slice(0, 200) };
    if (reason?.statusCode === 404 || reason?.statusCode === 410) dead.push(subs[i].id);
  });
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  return { sent, failed: subs.length - sent, removed: dead.length, firstError };
}

// Turns a failed send into a sentence a person can act on.
export function explainSendFailure(e: SendResult["firstError"]) {
  const status = e?.status;
  if (status === 401 || status === 403) {
    return `The push service rejected this server's keys (status ${status}). This device probably signed up with an older key. Turn notifications off and on again on this device.`;
  }
  if (status === 404 || status === 410) return "This device's sign-up has expired. Turn notifications on again.";
  if (status === 429) return "The push service says too many messages were sent. Wait a minute and try again.";
  return `The push service did not accept the message${status ? ` (status ${status})` : ""}. Turn notifications off and on again.`;
}
