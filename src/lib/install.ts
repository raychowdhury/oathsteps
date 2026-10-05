/**
 * Safari on iPhone and iPad deletes a site's stored data after about seven days without a visit, unless the site was
 * added to the Home Screen. Guest progress lives in that storage, so iOS learners who have not installed the app get a tip.
 */
export function needsHomeScreenTip(ua: string, standalone: boolean, maxTouchPoints: number): boolean {
  // iPadOS reports itself as a Mac; touch points tell them apart.
  const ios = /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  return ios && !standalone;
}

export function runningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Asks the browser not to evict our storage. Browsers decide; a refusal is fine and changes nothing. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
