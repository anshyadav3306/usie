"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncPush } from "@/lib/push";

// Registers the service worker, opens the right chat when a notification is tapped,
// and keeps this device's notification subscription fresh.
export default function SWBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "navigate" && typeof e.data.url === "string") router.push(e.data.url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    syncPush();
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
