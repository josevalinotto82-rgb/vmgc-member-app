const CACHE_NAME = "vmgc-app-v8";

const ASSETS = [
    "/escudo.png",
    "/manifest.json",
    "/icon-192.png",
    "/icon-512.png"
];

self.addEventListener("install", (event) => {
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) =>
                Promise.all(
                    names
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    if (
        request.mode === "navigate" ||
        request.destination === "document"
    ) {
        event.respondWith(
            fetch(request, { cache: "no-store" })
                .catch(async () => {
                    const cached = await caches.match(request);
                    return cached || Response.error();
                })
        );

        return;
    }

    if (
        request.destination === "image" ||
        url.pathname.endsWith(".png") ||
        url.pathname.endsWith(".jpg") ||
        url.pathname.endsWith(".jpeg") ||
        url.pathname.endsWith(".webp") ||
        url.pathname.endsWith(".svg") ||
        url.pathname.endsWith("/manifest.json")
    ) {
        event.respondWith(
            caches.match(request).then(async (cached) => {
                if (cached) return cached;

                const response = await fetch(request);

                if (response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, response.clone());
                }

                return response;
            })
        );

        return;
    }

    event.respondWith(
        fetch(request)
            .then(async (response) => {
                if (response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, response.clone());
                }

                return response;
            })
            .catch(async () => {
                const cached = await caches.match(request);
                return cached || Response.error();
            })
    );
});