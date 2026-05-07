// Naikkan versi cache agar browser otomatis menghapus cache yang nge-bug
const CACHE_NAME = "macsus-ai-cache-v22"; 

const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./ikon.png",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  // PERBAIKAN KRUSIAL: HANYA cache file dari domain lokal. 
  // JANGAN intercept API Supabase atau Google agar tidak nge-hang!
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});