"use client";

export type DownloadResult = { ok: true; cached: number } | { ok: false; error: string };

/** Ask the service worker to cache the app shell and content for offline use. Resolves with what actually happened. */
export async function downloadForOffline(timeoutMs = 60_000): Promise<DownloadResult> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return { ok: false, error: "This browser does not support offline storage for web apps." };
  const reg = await navigator.serviceWorker.getRegistration();
  const sw = reg?.active;
  if (!sw) return { ok: false, error: "The offline worker is not running yet. Reload the page once and try again (offline download is only available in the production build)." };
  return new Promise<DownloadResult>((resolve) => {
    const timer = setTimeout(() => {
      navigator.serviceWorker.removeEventListener("message", onMsg);
      resolve({ ok: false, error: "Timed out while saving content. Check your connection and try again." });
    }, timeoutMs);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "DOWNLOAD_DONE") {
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener("message", onMsg);
        resolve({ ok: true, cached: e.data.cached });
      } else if (e.data?.type === "DOWNLOAD_FAILED") {
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener("message", onMsg);
        resolve({ ok: false, error: e.data.error });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    sw.postMessage({ type: "DOWNLOAD_FOR_OFFLINE" });
  });
}

export async function clearOfflineCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}
