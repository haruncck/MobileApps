// Berber Randevu — çevrimdışı çalışma. Önce ağ denenir (güncel sürüm gelsin), ağ yoksa önbellek kullanılır.
const C = "berber-v2", F = ["./", "index.html", "hesap.js", "ornek.js", "ses.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(F))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("berber-") && k !== C).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const kopya = r.clone(); caches.open(C).then(c => c.put(e.request, kopya)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
