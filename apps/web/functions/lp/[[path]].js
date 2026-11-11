// Cloudflare Pages Function: Umami analytics through lapdle.com, so blockers that drop third-party analytics hosts
// don't hide visits. /lp/script.js is Umami Cloud's tracker; /lp/api/send forwards its data to Umami's gateway with the
// visitor's own IP (Umami turns it into a country and drops it; it never appears in the statistics).
// See src/analytics.ts and https://docs.umami.is/docs/bypass-ad-blockers.
export async function onRequest({ request }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/lp/, "") || "/";
  if (path === "/api/send") {
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
  if (path === "/script.js") {
    const res = await fetch("https://cloud.umami.is/script.js", { cf: { cacheTtl: 3600, cacheEverything: true } });
    return new Response(res.body, { status: res.status, headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  }
  return new Response("Not found", { status: 404 });
}
