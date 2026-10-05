const VERSION = "__VERSION__";
const CACHE = `dcc-${VERSION}`;
const URLS = __URLS__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("dcc-") && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // ignoreSearch: pages like /guides/custom?id=… share one prerendered file.
      const hit =
        (await cache.match(req, { ignoreSearch: true })) ??
        (req.mode === "navigate"
          ? await cache.match(url.pathname.replace(/\/?$/, "/"), { ignoreSearch: true })
          : undefined);
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch (err) {
        if (req.mode === "navigate") return (await cache.match("/")) ?? Response.error();
        throw err;
      }
    })(),
  );
});
