"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { getProfile } from "@/lib/store/repo";
import { useStoreRevision } from "@/lib/store/events";
import { SwRegister } from "./SwRegister";

const tabs = [
  { href: "/", label: "Today", icon: "☀" },
  { href: "/practice", label: "Practice", icon: "✎" },
  { href: "/interview", label: "Interview", icon: "💬" },
  { href: "/journey", label: "Journey", icon: "⛳" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const rev = useStoreRevision();

  useEffect(() => {
    getProfile()
      .then((p) => {
        document.documentElement.dataset.textSize = p.textSize;
        document.documentElement.dataset.reduceMotion = String(p.reduceMotion);
      })
      .catch(() => {});
  }, [rev]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-ink" aria-label="OathSteps home">
          <span aria-hidden className="inline-block h-6 w-6 rounded-md bg-ink" style={{ backgroundImage: "url(/icons/icon-192.png)", backgroundSize: "cover" }} />
          OathSteps
        </Link>
        <Link href="/settings" className={`rounded-xl px-3 py-2 font-medium ${pathname.startsWith("/settings") ? "bg-teal-soft text-teal-2" : "text-ink-2 hover:bg-paper-2"}`}>
          Settings
        </Link>
      </header>
      <main id="main" className="flex-1 px-4 pb-28 pt-1">
        {children}
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur">
        <ul className="mx-auto grid max-w-2xl grid-cols-4 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((t) => (
            <li key={t.href}>
              <Link href={t.href} aria-current={isActive(t.href) ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-medium ${isActive(t.href) ? "text-teal-2" : "text-ink-3 hover:text-ink"}`}>
                <span aria-hidden className="text-xl leading-none">
                  {t.icon}
                </span>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <SwRegister />
    </div>
  );
}
