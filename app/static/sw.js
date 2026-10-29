const CACHE_NAME = "ritmo-directo-v3";
const APP_SHELL = [
    "/",
    "/static/styles.css",
    "/static/app.js",
    "/static/manifest.json",
    "/static/icons/icon-192.png",
    "/static/icons/icon-512.png",
    "/static/icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== "GET" || url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/") || url.pathname === "/reproducir") return;

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put("/", copy));
                    }
                    return response;
                })
                .catch(async () => {
                    const cachedPage = await caches.match(request);
                    return cachedPage || caches.match("/");
                })
        );
        return;
    }

    if (url.pathname.startsWith("/static/")) {
        event.respondWith(
            fetch(request, { cache: "no-cache" })
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match(request);
                    if (cached) return cached;
                    throw new Error(`No hay una copia disponible para ${url.pathname}`);
                })
        );
    }
});
