"use client";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { getProfile } from "@/lib/store/repo";
import { useStoreRevision } from "@/lib/store/events";
import { useData } from "@/lib/store/useData";
import { ToastProvider } from "./Overlay";
import { SwRegister } from "./SwRegister";

function subscribeDark(cb: () => void) {
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener?.("change", cb);
  return () => mq?.removeEventListener?.("change", cb);
}
const systemDark = () => Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
const serverDark = () => false;

/** `.o-app` root: design tokens, appearance, text size and reduced-motion flags, toasts, service worker. */
export function AppRoot({ children }: { children: ReactNode }) {
  const rev = useStoreRevision();
  const sysDark = useSyncExternalStore(subscribeDark, systemDark, serverDark);
  const { data: profile } = useData(getProfile);
  const theme = profile?.theme ?? "system";
  const dark = theme === "dark" || (theme === "system" && sysDark);
  useEffect(() => {
    getProfile()
      .then((p) => {
        document.documentElement.dataset.textSize = p.textSize;
        document.documentElement.dataset.reduceMotion = String(p.reduceMotion);
      })
      .catch(() => {});
  }, [rev]);
  useEffect(() => {
    document.documentElement.classList.toggle("o-dark-page", dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#172530" : "#FFFFFF");
  }, [dark]);
  return (
    <div className={`o-app ${dark ? "o-dark" : ""} ${profile?.reduceMotion ? "o-rm" : ""}`} id="o-app">
      <ToastProvider>{children}</ToastProvider>
      <SwRegister />
    </div>
  );
}
