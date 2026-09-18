/* Bio-Lien — service worker.
 *
 * Deux rôles, pas plus :
 * 1. rendre l'installation possible partout (Android exige un service
 *    worker pour proposer « Ajouter à l'écran d'accueil ») ;
 * 2. tenir la 3G : les fichiers hachés de Next.js (_next/static) sont servis
 *    depuis le cache une fois vus — ils ne changent jamais sous le même nom —
 *    et une navigation sans réseau tombe sur la page « Hors ligne » au lieu
 *    de l'écran gris du navigateur.
 *
 * Tout le reste (pages, API, images) passe par le réseau, sans cache : une
 * commande ou un prix ne doivent jamais être servis depuis une copie.
 */
const VERSION = "v1";
const STATIC_CACHE = `biolien-static-${VERSION}`;
const OFFLINE_CACHE = `biolien-offline-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("biolien-") && ![STATIC_CACHE, OFFLINE_CACHE].includes(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Fichiers hachés : cache d'abord, réseau sinon, puis mise en cache.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
    return;
  }

  // Navigations : réseau, et la page « Hors ligne » quand il n'y en a pas.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.open(OFFLINE_CACHE).then((cache) => cache.match(OFFLINE_URL))),
    );
  }
});
