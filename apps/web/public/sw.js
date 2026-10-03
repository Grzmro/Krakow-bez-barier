// Service worker: offline app shell + last-seen pages. Registered by src/components/pwa/pwa-status.tsx
// as /sw.js?build=<id>, so every deploy installs a fresh cache and drops the previous one.
// Strategies: pages network-first (own cache entry → /offline fallback), /_next/static cache-first
// (hashed), other same-origin GETs network-first. Next client-router (RSC) requests are never cached:
// offline, the router falls back to a full page load, which this worker answers.
const BUILD = new URL(self.location.href).searchParams.get("build") ?? "dev";
const CACHE = `kbb-${BUILD}`;
const OFFLINE_URL = "/offline";
// Header stamped on stored pages: when that copy was fetched. The offline banner shows it.
const CACHED_AT = "x-kbb-cached-at";
const PRECACHE_PAGES = ["/", OFFLINE_URL];
const PRECACHE_FILES = ["/manifest.webmanifest", "/icons/icon-192.png"];

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

self.addEventListener("message", (event) => {
  // The page sends the assets it loaded before the worker took control so the first visit works offline.
  if (event.data?.type === "kbb:warm" && Array.isArray(event.data.urls)) {
    const urls = event.data.urls.filter((href) => {
      const url = new URL(href, self.location.origin);
      return isHandled(url) && url.pathname.startsWith("/_next/static/");
    });
    event.waitUntil(Promise.all([cacheMissing(urls), warmPage(event.data.page)]));
  }
  // Client-side (RSC) navigations bypass the cache; the page asks for its HTML to be stored instead.
  // `force`: the stored copy is in another language (the language was just switched), refetch it now.
  if (event.data?.type === "kbb:warm-page") event.waitUntil(warmPage(event.data.url, event.data.force === true));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!isHandled(url) || isRsc(request, url)) return;

  if (request.mode === "navigate") event.respondWith(page(request));
  else if (url.pathname.startsWith("/_next/static/")) event.respondWith(cacheFirst(request));
  else event.respondWith(networkFirst(request));
});

function isHandled(url) {
  if (url.origin !== self.location.origin) return false;
  // Dev-server internals (HMR, overlay) and the worker itself never go through the cache.
  return !(
    url.pathname === "/sw.js" ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/__nextjs")
  );
}

function isRsc(request, url) {
  return request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
}

function isStorable(response) {
  return response.ok && response.type === "basic" && !response.redirected;
}

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    PRECACHE_PAGES.map(async (path) => {
      const response = await fetch(path, { cache: "reload" });
      if (!isStorable(response)) return;
      const html = await response.clone().text();
      await cache.put(path, await stamped(response));
      const assets = [...html.matchAll(/(\/_next\/static\/[^"'\s\\]+)/g)].map((m) => m[1]);
      await cacheMissing(assets);
    }),
  );
  await cacheMissing(PRECACHE_FILES);
}

async function cacheMissing(urls) {
  const cache = await caches.open(CACHE);
  await Promise.all(
    [...new Set(urls)].map(async (url) => {
      if (await cache.match(url)) return;
      try {
        const response = await fetch(url);
        if (isStorable(response)) await cache.put(url, response);
      } catch {
        // Best effort: a missing asset only matters offline.
      }
    }),
  );
}

async function stamped(response) {
  const headers = new Headers(response.headers);
  headers.set(CACHED_AT, new Date().toISOString());
  // Keyed by URL alone (RSC requests never reach the cache), so Next's Vary list must not block a match.
  headers.delete("Vary");
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers });
}

async function warmPage(path, force = false) {
  if (typeof path !== "string") return;
  const url = new URL(path, self.location.origin);
  if (!isHandled(url) || url.searchParams.has("_rsc")) return;
  const cache = await caches.open(CACHE);
  // A full page load stored it a moment ago — don't fetch it twice.
  const cached = await cache.match(url.href);
  const cachedAt = Date.parse(cached?.headers.get(CACHED_AT) ?? "");
  if (!force && Date.now() - cachedAt < 30_000) return;
  try {
    const response = await fetch(url.href);
    if (isStorable(response)) await cache.put(url.href, await stamped(response));
  } catch {
    // Offline or server down: keep whatever copy we have.
  }
}

async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (isStorable(response)) await cache.put(request, await stamped(response.clone()));
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  // Hashed URLs: a stored copy is valid whatever request headers it was stored under.
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (isStorable(response)) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (isStorable(response)) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? Response.error();
  }
}
