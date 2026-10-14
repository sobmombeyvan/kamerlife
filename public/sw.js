/* KAMERLIFE service worker.
 * Precaches the app shell only. City sectors, vehicles and character models
 * are fetched while playing and stored in a separate media cache — never as
 * one open-world download.
 * VERSION is stamped during the production build.
 */
const VERSION = '__KAMERLIFE_CACHE__';
const SHELL = `kamerlife-shell-${VERSION}`;
const MEDIA = 'kamerlife-media-v1';

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then(async (cache) => {
      await Promise.all(
        SHELL_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn('[kamerlife-sw] précache ignoré', url, error);
          }
        }),
      );
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('kamerlife-shell-') && key !== SHELL)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;
  if (req.headers.get('range')) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  const bucket = cacheBucket(url.pathname);
  if (!bucket) return;
  event.respondWith(cacheFirst(req, bucket));
});

function cacheBucket(pathname) {
  if (/\.(glb|gltf|bin)$/i.test(pathname)) return MEDIA;
  if (pathname.startsWith('/assets/')) return SHELL;
  if (/\.(png|jpe?g|webp|svg|json|wasm)$/i.test(pathname)) return MEDIA;
  return null;
}

async function networkFirstNavigation(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') {
      await safePut(cache, req, res.clone());
    }
    return res;
  } catch (error) {
    console.warn('[kamerlife-sw] navigation hors ligne', error);
    const cached =
      (await cache.match(req, { ignoreSearch: true })) ||
      (await cache.match('/index.html')) ||
      (await cache.match('/'));
    if (cached) return cached;
    return new Response('KAMERLIFE — fichiers non disponibles hors ligne.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirst(req, bucket) {
  const cache = await caches.open(bucket);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') await safePut(cache, req, res.clone());
    return res;
  } catch (error) {
    console.warn('[kamerlife-sw] ressource indisponible', req.url, error);
    const fallback = await cache.match(req);
    if (fallback) return fallback;
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function safePut(cache, req, res) {
  try {
    await cache.put(req, res);
  } catch (error) {
    console.warn('[kamerlife-sw] cache refusé (quota)', error);
    try {
      const keys = await cache.keys();
      const heavy = keys.find((key) => /\.(glb|gltf|bin)$/i.test(new URL(key.url).pathname));
      if (heavy) await cache.delete(heavy);
      await cache.put(req, res);
    } catch (retryError) {
      console.warn('[kamerlife-sw] cache abandonné', retryError);
    }
  }
}
