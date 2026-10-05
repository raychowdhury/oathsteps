"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";

interface ToastState {
  id: number;
  text: string;
  undo: (() => void) | null;
}
interface ToastApi {
  toast: (text: string, undo?: () => void) => void;
}
const ToastContext = createContext<ToastApi>({ toast: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

/** Toasts live at the app root (inside .o-app, which is position: relative). 7 s, with optional Undo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((text: string, undo?: () => void) => {
    const id = Date.now();
    setT({ id, text, undo: undo ?? null });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setT((cur) => (cur && cur.id === id ? null : cur)), 7000);
  }, []);
  const api = useMemo(() => ({ toast }), [toast]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {t && (
        <div className="o-toast" role="status">
          <span className="o-grow">{t.text}</span>
          {t.undo && (
            <button
              className="o-btn o-btn-g"
              type="button"
              onClick={() => {
                t.undo?.();
                setT(null);
              }}
            >
              Undo
            </button>
          )}
          <button className="o-iconbtn" type="button" onClick={() => setT(null)} aria-label="Dismiss" style={{ color: "inherit" }}>
            <Icon name="close" />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

/** Bottom sheet on phones, centered dialog on wide screens. Escape closes; focus moves inside. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, [data-os-focus]");
    first?.focus();
  }, []);
  return (
    <div
      className="o-scrim"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="o-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" ref={ref}>
        <div className="o-row-between">
          <h2 id="sheet-title" className="o-h2">
            {title}
          </h2>
          <button className="o-iconbtn" type="button" onClick={onClose} aria-label="Close" data-os-focus="1">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorLine({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div id={id} className="o-err" role="alert">
      <Icon name="warn" small />
      <span>{children}</span>
    </div>
  );
}
