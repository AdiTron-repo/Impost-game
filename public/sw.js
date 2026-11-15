// Network first (so updates arrive), with a cached copy for offline use or a sleeping server.
const CACHE = "imposter-v2";
const SHELL = ["/", "/words.js", "/manifest.json", "/icon-192.png", "/icon-512.png", "/socket.io/socket.io.js"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.startsWith("/.well-known/")) return;
  if (u.pathname.startsWith("/socket.io/") && u.pathname !== "/socket.io/socket.io.js") return;
  e.respondWith(new Promise((resolve) => {
    const timer = setTimeout(() => caches.match(r, { ignoreSearch: true }).then((m) => m && resolve(m)), 4000);
    fetch(r).then((res) => {
      clearTimeout(timer);
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); }
      resolve(res);
    }).catch(() => {
      clearTimeout(timer);
      caches.match(r, { ignoreSearch: true }).then((m) => resolve(m || Response.error()));
    });
  }));
});
