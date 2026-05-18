const CACHE_NAME = "vmgc-app-v6";

const ASSETS = [
    "./escudo.png",
    "./manifest.json"
];

self.addEventListener("install", (event) => {
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
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
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Solo manejar archivos de la misma web
    if (url.origin !== location.origin) {
        event.respondWith(fetch(request));
        return;
    }

    // HTML: siempre intenta traer nuevo
    if (request.mode === "navigate" || request.destination === "document") {
        event.respondWith(
            fetch(request, { cache: "no-store" })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Imágenes, manifest, iconos: cache primero
    if (
        request.destination === "image" ||
        url.pathname.endsWith(".png") ||
        url.pathname.endsWith(".jpg") ||
        url.pathname.endsWith(".jpeg") ||
        url.pathname.endsWith(".webp") ||
        url.pathname.endsWith(".svg") ||
        url.pathname.endsWith("manifest.json")
    ) {
        event.respondWith(
            caches.match(request)
                .then((cached) => {
                    return cached || fetch(request).then((response) => {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, copy);
                        });
                        return response;
                    });
                })
        );
        return;
    }

    // JS/CSS: red primero, backup cache
    event.respondWith(
        fetch(request)
            .then((response) => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, copy);
                });
                return response;
            })
            .catch(() => caches.match(request))
    );
});