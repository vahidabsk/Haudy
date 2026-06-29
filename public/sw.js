const CACHE_NAME = "haudy-offline-v2";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => undefined)));

  const indexResponse = await fetch("/index.html", { cache: "no-store" });
  if (!indexResponse.ok) return;

  await cache.put("/", indexResponse.clone());
  await cache.put("/index.html", indexResponse.clone());

  const html = await indexResponse.text();
  const assetUrls = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g))
    .map((match) => match[1])
    .filter((url) => url.startsWith("/assets/"));

  await Promise.all([...new Set(assetUrls)].map((url) => cache.add(url).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    cacheAppShell().then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS") return;
  const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(urls.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => event.ports?.[0]?.postMessage({ ok: true }))
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put("/", copy.clone());
            cache.put("/index.html", copy);
          });
          return response;
        })
        .catch(() => caches.match("/index.html").then((cached) => cached || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
