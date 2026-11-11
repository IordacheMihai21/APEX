// Cloudflare Pages (advanced mode): Umami analytics through lapdle.com, so blockers that drop third-party analytics
// hosts don't hide visits. Only /lp/* reaches this worker (_routes.json); every other address is served straight from
// the static files, with _headers and _redirects as before. /lp/script.js is Umami Cloud's tracker; /lp/api/send
// forwards its data to Umami's gateway with the visitor's own IP (Umami turns it into a country and drops it).
// See src/analytics.ts and https://docs.umami.is/docs/bypass-ad-blockers.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/lp/api/send") {
      if (request.method !== "POST") return new Response("POST only", { status: 405 });
      return fetch("https://gateway.umami.is/api/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": request.headers.get("User-Agent") ?? "",
          "X-Forwarded-For": request.headers.get("CF-Connecting-IP") ?? "",
        },
        body: await request.text(),
      });
    }
    if (url.pathname === "/lp/script.js") {
      const res = await fetch("https://cloud.umami.is/script.js", { cf: { cacheTtl: 3600, cacheEverything: true } });
      return new Response(res.body, { status: res.status, headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
    }
    if (url.pathname.startsWith("/lp/")) return new Response("Not found", { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
