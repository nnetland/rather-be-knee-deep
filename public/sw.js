/* Rather Be Knee Deep — service worker (2026-11-26, Director's call).
 *
 * Purpose: let the home-screen app open with no signal (on the mountain, on a
 * plane). It does NOT change how updates ship:
 *
 *   - The page itself is NETWORK-FIRST. When there's a connection you always
 *     get the latest deploy, so "ship it" is still live in ~90 seconds. Only
 *     when the network fails (or takes longer than NAV_TIMEOUT_MS) is the last
 *     copy served from the cache.
 *   - Icons, share images and the manifest are cache-first (they're served
 *     with immutable cache headers anyway).
 *   - Google Fonts are stale-while-revalidate, so type still looks right offline.
 *   - Everything else — notably the NOAA forecast API — is left alone. The app
 *     already has its own not-live fallback for when that call fails.
 *
 * Bump CACHE_VERSION only if the caching strategy itself changes; ordinary
 * content deploys don't need it.
 */
const CACHE_VERSION = 'v1';
const PAGE_CACHE = `kd-page-${CACHE_VERSION}`;
const ASSET_CACHE = `kd-assets-${CACHE_VERSION}`;
const FONT_CACHE = `kd-fonts-${CACHE_VERSION}`;
const NAV_TIMEOUT_MS = 4000;

const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const page = await caches.open(PAGE_CACHE);
    await page.add(new Request('/', { cache: 'reload' }));
    const assets = await caches.open(ASSET_CACHE);
    await assets.addAll(PRECACHE.filter((u) => u !== '/'));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PAGE_CACHE, ASSET_CACHE, FONT_CACHE]);
    for (const key of await caches.keys()) {
      if (key.startsWith('kd-') && !keep.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  const network = fetch(request).then((res) => {
    // Every app route rewrites to index.html, so the copy at '/' is the app.
    if (res.ok && new URL(request.url).pathname === '/') cache.put('/', res.clone());
    return res;
  });
  try {
    return await Promise.race([network, timeout(NAV_TIMEOUT_MS)]);
  } catch (e) {
    const cached = await cache.match('/');
    if (cached) {
      network.catch(() => {}); // let a slow response still refresh the cache
      return cached;
    }
    return network; // nothing cached yet: wait for the network after all
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then((res) => {
    if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(networkFirstPage(request));
    } else if (/\.(png|svg|jpg|webmanifest)$/.test(url.pathname)) {
      event.respondWith(cacheFirst(request, ASSET_CACHE));
    }
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
  }
  // Anything else (NOAA, etc.) goes straight to the network untouched.
});
