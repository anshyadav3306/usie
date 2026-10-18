import { createClient } from "@/lib/supabase/client";

export const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function isBrave() {
  try {
    const brave = (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave;
    return !!(await brave?.isBrave?.());
  } catch {
    return false;
  }
}

export function keyToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function sameKey(existing: ArrayBuffer | null | undefined, wanted: Uint8Array) {
  if (!existing) return false;
  const a = new Uint8Array(existing);
  return a.length === wanted.length && a.every((v, i) => v === wanted[i]);
}

export async function ensureRegistration() {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

// Saves this device for the signed-in person. Throws with the real reason if it fails.
export async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("Saving this device failed: the browser gave an incomplete push address.");
  }
  const { error } = await createClient().rpc("save_push_subscription", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw new Error(`Saving this device failed: ${error.message}`);
}

export async function subscribeThisDevice() {
  if (!VAPID_PUBLIC_KEY) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing from this build.");
  const reg = await ensureRegistration();
  const wanted = keyToBytes(VAPID_PUBLIC_KEY);

  let sub = await reg.pushManager.getSubscription();
  // After the keys are changed, an old sign-up no longer works. Replace it.
  if (sub && !sameKey(sub.options.applicationServerKey, wanted)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted });

  await saveSubscription(sub);
  return sub;
}

// Re-registers this device quietly if notifications were already allowed.
export async function syncPush() {
  if (!pushSupported() || !VAPID_PUBLIC_KEY || Notification.permission !== "granted") return;
  try {
    await subscribeThisDevice();
  } catch (e) {
    console.warn("usie: could not refresh the notification sign-up", e);
  }
}

export async function clearBadge() {
  try {
    await (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.();
  } catch {}
}

// Turns a browser error into a sentence that says what to do.
export async function describePushError(e: unknown) {
  const err = e as { name?: string; message?: string } | undefined;
  const name = err?.name ?? "Error";
  const message = err?.message ?? String(e);

  if (message.startsWith("Saving this device failed") || message.includes("VAPID_PUBLIC_KEY")) return message;
  if (name === "NotAllowedError") {
    return "Notifications are blocked for this site. Allow them in your browser's site settings, then try again.";
  }
  if (name === "AbortError" || /push service/i.test(message)) {
    if (await isBrave()) {
      return "Brave blocks push notifications by default. Open brave://settings/privacy, turn on “Use Google services for push messaging”, restart Brave, then try again.";
    }
    return `Your browser's push service refused the sign-up (${name}: ${message}). Check your internet connection, or try another browser.`;
  }
  if (name === "InvalidAccessError" || /applicationServerKey/i.test(message)) {
    return "The notification key in this build is not valid. Check NEXT_PUBLIC_VAPID_PUBLIC_KEY in Vercel and redeploy.";
  }
  return `${name}: ${message}`;
}
