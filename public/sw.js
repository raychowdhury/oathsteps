/* OathSteps service worker.
 * - Precaches nothing at install except the offline page; the app shell and content are cached
 *   on navigation and on an explicit "download for offline" request from Settings.
 * - Navigation: network first, cache fallback, then /offline.
 * - Static assets (_next/static, icons, manifest): cache first.
 * - Never caches /api/auth, /api/sync, /api/account, /api/export or any non-GET request.
 */
const VERSION = "oathsteps-v2";
const SHELL = `${VERSION}-shell`;
const CONTENT = `${VERSION}-content`;
const NEVER_CACHE = [/^\/api\//];
const OFFLINE_URL = "/offline";
const APP_ROUTES = ["/", "/setup", "/practice", "/practice/session?kind=daily", "/practice/mock?kind=walkthrough", "/interview", "/interview/voice", "/interview/reading", "/interview/writing", "/interview/instructions", "/interview/n400", "/journey", "/journey/guide", "/readiness", "/settings", OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "DOWNLOAD_FOR_OFFLINE") {
    const reply = (msg) => event.source?.postMessage(msg);
    downloadForOffline()
      .then((n) => reply({ type: "DOWNLOAD_DONE", cached: n }))
      .catch((e) => reply({ type: "DOWNLOAD_FAILED", error: String(e) }));
  }
  if (event.data?.type === "CLEAR_PRIVATE_CACHE") {
    // Private, per-user responses are never cached, so there is nothing to purge beyond the shell.
    event.source?.postMessage({ type: "CLEARED" });
  }
});

async function downloadForOffline() {
  const cache = await caches.open(CONTENT);
  let count = 0;
  for (const route of APP_ROUTES) {
    const res = await fetch(route, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`Could not fetch ${route}: ${res.status}`);
    await cache.put(route, res.clone());
    count++;
    // Pull the page's static assets too so the shell renders offline.
    const html = await res.text();
    const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
    for (const a of new Set(assets)) {
      const r = await fetch(a);
      if (r.ok) {
        await cache.put(a, r);
        count++;
      }
    }
  }
  for (const icon of ["/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"]) {
    const r = await fetch(icon);
    if (r.ok) await cache.put(icon, r);
  }
  return count;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((re) => re.test(url.pathname))) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CONTENT).then((c) => c.put(url.pathname + url.search, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(url.pathname + url.search)) ?? (await caches.match(url.pathname)) ?? (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) caches.open(CONTENT).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
  }
});
