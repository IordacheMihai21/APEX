// Lapdle service worker: play offline once loaded.
// Pages: network first (so a new build arrives at once), cached copy when offline.
// Hashed build assets (code, circuits, scenery): cache first; their names change with every build.
// Anything from another origin (ads, fonts CDNs) is left to the browser.
const CACHE = "lapdle-v2"; // v2 drops v1, which could hold an HTML page saved under a script name

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // the offline copy is the app shell; a 404 page must not replace it
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || /\.(png|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            // only real files: never an HTML page standing in for a missing script or image
            if (res.ok && !(res.headers.get("content-type") ?? "").includes("text/html")) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
