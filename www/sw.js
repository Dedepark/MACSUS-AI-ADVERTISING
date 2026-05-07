// PENTING: Tiap kali kamu update codingan dan mau upload ke Netlify, 
// ganti angka v2 ini jadi v3, v4, dan seterusnya.
const CACHE_NAME = "macsus-ai-cache-v16"; 

const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./ikon.png",
  "./manifest.json"
];

// Install Service Worker & langsung maksa aktif
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Memaksa SW baru untuk langsung jalan tanpa nunggu user tutup tab
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate: Ini kunci buat NGEHAPUS CACHE LAMA
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Kalau nama cache-nya beda sama CACHE_NAME yang baru, hapus!
          if (cacheName !== CACHE_NAME) {
            console.log("Menghapus cache lama:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Langsung ambil alih kontrol halaman klien
});

// Fetch dari Cache atau Network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cache jika ada, jika tidak fetch dari internet
      return response || fetch(event.request);
    })
  );
});