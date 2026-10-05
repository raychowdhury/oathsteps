"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export type TabKey = "today" | "practice" | "interview" | "journey";
const TABS: { key: TabKey; href: string; label: string; icon: IconName }[] = [
  { key: "today", href: "/", label: "Today", icon: "today" },
  { key: "practice", href: "/practice", label: "Practice", icon: "practice" },
  { key: "interview", href: "/interview", label: "Interview", icon: "interview" },
  { key: "journey", href: "/journey", label: "Journey", icon: "journey" },
];
const HOME: Record<TabKey, string> = { today: "/", practice: "/practice", interview: "/interview", journey: "/journey" };

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
const isOnline = () => navigator.onLine;
const serverOnline = () => true;

export interface ScreenProps {
  /** Header title; tab roots show "OathSteps". */
  title: string;
  tab: TabKey;
  /** Back control: an href, a handler, or none (tab roots). */
  back?: string | (() => void);
  backLabel?: string;
  showTabs?: boolean;
  showSettings?: boolean;
  /** Demo tag in the header when fictional history is loaded. */
  demo?: boolean;
  /** Offline banner text override. */
  offlineText?: string;
  children: ReactNode;
  /** Sticky action bar content. */
  actions?: ReactNode;
}

/** The app shell from the design: top bar, tabs (bottom on phones, top on wide screens), scrolling main, sticky actions. */
export function Screen({ title, tab, back, backLabel = "Back", showTabs = true, showSettings = true, demo = false, offlineText, children, actions }: ScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const online = useSyncExternalStore(subscribeOnline, isOnline, serverOnline);
  const goBack = () => {
    if (typeof back === "function") back();
    else if (typeof back === "string") router.push(back as never);
    else router.push(HOME[tab] as never);
  };
  return (
    <div className="o-shell">
      <a href="#main" className="o-skip">
        Skip to content
      </a>
      <header className="o-top">
        {back ? (
          <button className="o-iconbtn" type="button" onClick={goBack} aria-label={backLabel}>
            <Icon name="back" />
          </button>
        ) : (
          <span className="o-logo">
            <Icon name="logo" />
          </span>
        )}
        <div className="o-grow o-brand">{title}</div>
        {demo && <span className="o-tag o-tag-demo o-hide-xs">Demo</span>}
        {showSettings && (
          <Link href="/settings" className="o-iconbtn" aria-current={pathname.startsWith("/settings") ? "page" : undefined}>
            <Icon name="person" />
            <span>Settings</span>
          </Link>
        )}
      </header>
      {showTabs && (
        <nav className="o-tabs" aria-label="Main">
          {TABS.map((t) => (
            <Link key={t.key} href={t.href as never} className={`o-tab ${t.key === tab ? "o-tab-on" : ""}`} aria-current={t.key === tab ? "page" : undefined}>
              <span className="o-tab-ic">
                <Icon name={t.icon} />
              </span>
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      {!online && (
        <div className="o-banner" role="status">
          <Icon name="offline" style={{ color: "var(--am)" }} />
          <div className="o-grow">
            <div className="o-strong">You’re offline</div>
            <div>{offlineText ?? "Practice still works if you downloaded the content. Your progress is saved on this device."}</div>
          </div>
        </div>
      )}
      <main className="o-main" id="main">
        {children}
        {actions && <div className="o-actions">{actions}</div>}
      </main>
    </div>
  );
}

export function Steps({ count, current, full = false }: { count: number; current: number; full?: boolean }) {
  return (
    <div className={`o-steps ${full ? "o-steps-full" : ""}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`o-step ${i < current ? "o-step-done" : i === current ? "o-step-now" : ""}`} />
      ))}
    </div>
  );
}

export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} <span className="o-meta">(opens in a new tab)</span>
    </a>
  );
}
