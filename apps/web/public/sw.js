// Service worker: offline app shell + last-known data. Registered by src/components/pwa/pwa-status.tsx.
// Strategies: pages network-first (cache → /offline fallback), /_next/static cache-first (hashed),
// /api stale-while-revalidate, other same-origin GETs network-first. One cache, one version.
const CACHE = "kbb-v1";
const OFFLINE_URL = "/offline";
// Synthetic entry holding when page/API data was last stored — the offline banner shows it.
const LAST_SYNC_KEY = "/__kbb/last-sync";
const PRECACHE_PAGES = ["/", OFFLINE_URL];
const PRECACHE_FILES = ["/manifest.webmanifest", "/icons/icon-192.png"];
const MATCH = { ignoreVary: true };

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// The page sends the URLs it loaded before the worker took control so the first visit works offline.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "kbb:warm" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(cacheMissing(event.data.urls.filter(isCacheableUrl)));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !isCacheableUrl(url.href)) return;

  if (request.mode === "navigate") event.respondWith(page(request));
  else if (url.pathname.startsWith("/_next/static/")) event.respondWith(cacheFirst(request));
  else if (url.pathname.startsWith("/api/")) event.respondWith(staleWhileRevalidate(request, event));
  else event.respondWith(networkFirst(request));
});

function isCacheableUrl(href) {
  const url = new URL(href, self.location.origin);
  if (url.origin !== self.location.origin) return false;
  // Dev-server internals (HMR, overlay) and the worker itself never go through the cache.
  return !(
    url.pathname === "/sw.js" ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/__nextjs") ||
    url.pathname.startsWith("/__kbb/")
  );
}

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    PRECACHE_PAGES.map(async (path) => {
      const response = await fetch(path, { cache: "reload" });
      if (!response.ok) return;
      const html = await response.clone().text();
      await cache.put(path, response);
      const assets = [...html.matchAll(/(\/_next\/static\/[^"'\s\\]+)/g)].map((m) => m[1]);
      await cacheMissing(assets);
    }),
  );
  await cacheMissing(PRECACHE_FILES);
  await stampSync(cache);
}

async function cacheMissing(urls) {
  const cache = await caches.open(CACHE);
  await Promise.all(
    [...new Set(urls)].map(async (url) => {
      if (await cache.match(url, MATCH)) return;
      try {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch {
        // Best effort: a missing asset only matters offline.
      }
    }),
  );
}

async function stampSync(cache) {
  await cache.put(LAST_SYNC_KEY, new Response(new Date().toISOString()));
}

async function store(request, response) {
  if (!response.ok || response.type !== "basic") return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  await stampSync(cache);
}

async function page(request) {
  try {
    const response = await fetch(request);
    await store(request, response.clone());
    return response;
  } catch {
    const cache = await caches.open(CACHE);
    return (
      (await cache.match(request, MATCH)) ??
      (await cache.match(request, { ...MATCH, ignoreSearch: true })) ??
      (await cache.match(OFFLINE_URL, MATCH)) ??
      Response.error()
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, MATCH);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, MATCH);
    return cached ?? Response.error();
  }
}

async function staleWhileRevalidate(request, event) {
  const cached = await caches.match(request, MATCH);
  const network = fetch(request).then(async (response) => {
    await store(request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  return network.catch(() => Response.error());
}
