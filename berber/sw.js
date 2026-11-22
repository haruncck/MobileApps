// Berber Randevu — çevrimdışı çalışma.
// Önce ağ denenir (yeni sürüm hemen gelsin); ağ yoksa ya da 4 saniyede yanıt vermezse önbellekteki kopya kullanılır.
const C = "berber-v3", F = ["./", "hesap.js", "ornek.js", "ses.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(F))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("berber-") && k !== C).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const istek = e.request, adres = new URL(istek.url);
  if (istek.method !== "GET" || adres.origin !== location.origin) return;
  // Sayfanın kendisi tek anahtar altında tutulur: "?fbclid=…" gibi eklerle açılan bağlantılar eski bir kopyaya düşmesin.
  const sayfa = istek.mode === "navigate";
  const anahtar = sayfa ? new URL("./", self.registration.scope).href : adres.origin + adres.pathname;
  const agdan = fetch(istek, { cache: "no-cache" }).then(yanit => {
    if (yanit.ok) { const kopya = yanit.clone(); e.waitUntil(caches.open(C).then(c => c.put(anahtar, kopya))); }
    return yanit;
  });
  const onbellekten = () => caches.open(C).then(c => c.match(anahtar));
  const bekle = new Promise(coz => setTimeout(coz, 4000)).then(onbellekten); // yavaş bağlantıda açılış beklemesin
  e.respondWith(Promise.race([agdan.catch(() => null), bekle]).then(y => y || onbellekten()).then(y => y || agdan));
});
