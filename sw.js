/* GEOWENGAS Quote Builder — offline support with automatic updates.
   Online: always fetches the newest files (so updates appear on the next open).
   Offline or slow network: falls back to the last saved copy. */
const CACHE = "gw-quotes-v1";
const CORE = ["./", "index.html", "sign.html", "styles.css", "core.js", "app.js", "logo.jpg",
  "vendor/jspdf.umd.min.js", "vendor/jspdf.plugin.autotable.min.js",
  "manifest.webmanifest", "icon-192.png", "icon-512.png", "favicon.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(req, {cache: "no-cache"}).then(res => {
      if(res && res.ok) cache.put(req, res.clone());
      return res;
    });
    const timeout = new Promise(resolve => setTimeout(resolve, 4000));
    try{
      const res = await Promise.race([network, timeout]);
      if(res) return res;
    }catch(err){}
    const cached = await cache.match(req, {ignoreSearch: true});
    return cached || network;
  })());
});
