const CACHE_NAME = "vmgc-cache-v1";

const urlsToCache = [
    "./",
    "./login.html",
    "./panel.html",
    "./resultados.html",
    "./torneos.html",
    "./grilla_interactiva.html",
    "./styles.css",
    "./supabase.js"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});