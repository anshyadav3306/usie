"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { isIOS, isStandalone } from "@/lib/push";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallCard() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIOS());
    setReady(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!ready) return null;

  return (
    <div className="rounded-3xl border border-brand-100 bg-white/70 p-4 shadow-card dark:border-white/10 dark:bg-white/5">
      {installed ? (
        <p className="font-semibold text-ink dark:text-white">usie is installed on this device ✓</p>
      ) : deferred ? (
        <>
          <p className="text-sm text-ink-soft dark:text-white/80">Add usie to your home screen so it opens like a normal app.</p>
          <button
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3 font-bold text-white shadow-soft hover:bg-brand-600"
          >
            <Download size={18} /> Install usie
          </button>
        </>
      ) : ios ? (
        <>
          <p className="font-semibold text-ink dark:text-white">Add usie to your Home Screen</p>
          <ol className="mt-2 space-y-2 text-sm text-ink-soft dark:text-white/80">
            <li className="flex items-center gap-2">
              <Share size={16} className="shrink-0 text-brand-600" /> Tap the Share button in Safari
            </li>
            <li className="flex items-center gap-2">
              <SquarePlus size={16} className="shrink-0 text-brand-600" /> Choose Add to Home Screen, then Add
            </li>
          </ol>
          <p className="mt-2 text-xs text-ink-muted">You need this on iPhone before notifications can work.</p>
        </>
      ) : (
        <p className="text-sm text-ink-soft dark:text-white/80">
          Open your browser menu and choose Install app or Add to Home Screen to put usie on this device.
        </p>
      )}
    </div>
  );
}
