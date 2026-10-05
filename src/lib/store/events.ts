"use client";
import { useEffect, useState } from "react";

/** Tiny change bus so screens refresh after a write without a global state library. */
const TOPIC = "oathsteps:store-changed";

export function notifyStoreChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TOPIC));
}

export function useStoreRevision(): number {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const handler = () => setRev((r) => r + 1);
    window.addEventListener(TOPIC, handler);
    return () => window.removeEventListener(TOPIC, handler);
  }, []);
  return rev;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
