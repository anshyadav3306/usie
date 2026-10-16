"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VAPID_PUBLIC_KEY, ensureRegistration, isIOS, isStandalone, pushSupported, subscribeThisDevice } from "@/lib/push";

type State = "loading" | "unconfigured" | "needs-install" | "unsupported" | "denied" | "off" | "on";

export default function PushSettings() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const detect = useCallback(async () => {
    if (!pushSupported()) {
      setState(isIOS() && !isStandalone() ? "needs-install" : "unsupported");
      return;
    }
    if (!VAPID_PUBLIC_KEY) return setState("unconfigured");
    if (Notification.permission === "denied") return setState("denied");
    if (Notification.permission !== "granted") return setState("off");
    const reg = await ensureRegistration();
    const sub = await reg.pushManager.getSubscription();
    setState(sub ? "on" : "off");
  }, []);

  useEffect(() => {
    detect();
  }, [detect]);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") return setState("denied");
      if (permission !== "granted") return setState("off");
      await subscribeThisDevice();
      setState("on");
    } catch {
      setMessage("Couldn't turn notifications on. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await ensureRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setMessage("Couldn't turn notifications off. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      setMessage(res.ok ? "Test sent. It should arrive in a few seconds." : (json.error ?? "The test failed."));
    } catch {
      setMessage("The test failed. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  const card = "rounded-3xl border border-brand-100 bg-white/70 p-4 shadow-card dark:border-white/10 dark:bg-white/5";
  const primary = "mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3 font-bold text-white shadow-soft hover:bg-brand-600 disabled:opacity-60";
  const secondary = "flex flex-1 items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-white/70 py-3 font-semibold text-brand-600 hover:bg-white disabled:opacity-60 dark:bg-white/10 dark:text-brand-200";

  if (state === "loading") return null;

  return (
    <div className={card}>
      {state === "unconfigured" && (
        <p className="text-sm text-ink-soft dark:text-white/80">Notifications aren&apos;t set up on the server yet. Add the push keys in Vercel, then redeploy.</p>
      )}
      {state === "needs-install" && (
        <p className="text-sm text-ink-soft dark:text-white/80">On iPhone, add usie to your Home Screen first (see Install above), then open it from there to turn notifications on.</p>
      )}
      {state === "unsupported" && <p className="text-sm text-ink-soft dark:text-white/80">This browser can&apos;t show notifications from websites.</p>}
      {state === "denied" && (
        <p className="text-sm text-ink-soft dark:text-white/80">Notifications are blocked for usie. Allow them in your browser or phone settings for this site, then come back here.</p>
      )}
      {state === "off" && (
        <>
          <p className="text-sm text-ink-soft dark:text-white/80">Get a notification when a new message arrives, even when usie is closed.</p>
          <button onClick={enable} disabled={busy} className={primary}>
            <Bell size={18} /> {busy ? "Turning on…" : "Turn on notifications"}
          </button>
        </>
      )}
      {state === "on" && (
        <>
          <p className="font-semibold text-ink dark:text-white">Notifications are on for this device ✓</p>
          <div className="mt-3 flex gap-2">
            <button onClick={sendTest} disabled={busy} className={secondary}>
              <Bell size={17} /> Send a test
            </button>
            <button onClick={disable} disabled={busy} className={secondary}>
              <BellOff size={17} /> Turn off
            </button>
          </div>
        </>
      )}
      {message && (
        <p role="status" className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-ink-soft dark:bg-white/10 dark:text-white/80">
          {message}
        </p>
      )}
    </div>
  );
}
