// Lapdle service worker: the installed app, playable offline.
// Install: every file of the app's code is fetched up front (PRECACHE, written in by
// the build with BUILD, see vite.config.ts), so every game opens offline.
// Pages: network first (so a new build arrives at once), cached copy when offline.
// Hashed build assets (code, circuits, scenery): cache first; their names change with every build.
// Anything from another origin (ads, fonts CDNs) is left to the browser.
const BUILD = "dev";
const PRECACHE = [];
const SHELL = `lapdle-shell-${BUILD}`; // this build's code
const CACHE = "lapdle-v2"; // pages, and circuit data cached on first use (kept across builds)

self.addEventListener("install", (event) => {
  // best effort: a file that fails to arrive is fetched (and cached) when first needed
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => Promise.all(["/", "/manifest.webmanifest", "/icon-192.png", ...PRECACHE].map((url) => c.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== SHELL).map((k) => caches.delete(k))))
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
