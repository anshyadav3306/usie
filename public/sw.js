/* usie service worker: offline fallback, light asset caching and push notifications. */
const VERSION = "usie-v4";
const STATIC = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const isLocal = ["localhost", "127.0.0.1"].includes(self.location.hostname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase or other origins

  // Pages: always go to the network (they are private). Show the offline page if that fails.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Build assets and icons never change for a given URL: serve from cache.
  if (!isLocal && (url.pathname.startsWith("/_next/static/") || /\.(png|svg|woff2?)$/.test(url.pathname))) {
    event.respondWith(
      caches.open(STATIC).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            })
        )
      )
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const watching = windows.some((w) => {
        try {
          return w.visibilityState === "visible" && w.focused && data.url && new URL(w.url).pathname === data.url;
        } catch (e) {
          return false;
        }
      });

      // The unread count on the app icon (where the browser supports it).
      const nav = self.navigator;
      try {
        if (watching || !(data.badge > 0)) await (nav.clearAppBadge && nav.clearAppBadge());
        else await (nav.setAppBadge && nav.setAppBadge(data.badge));
      } catch (e) {}

      // Safari requires every push to show a notification, so only skip on other browsers.
      const apple = /iPhone|iPad|iPod|Macintosh/.test(nav.userAgent);
      if (watching && !apple) return;

      await self.registration.showNotification(data.title || "usie", {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/badge-96.png",
        tag: data.tag,
        renotify: !!data.tag,
        data: { url: data.url || "/chats" },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/chats";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          try {
            await w.focus();
          } catch (e) {}
          w.postMessage({ type: "navigate", url });
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
