import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "good" | "warn";
const variants: Record<Variant, string> = {
  primary: "bg-teal text-white hover:bg-teal-2 border-transparent",
  secondary: "bg-white text-ink border-line hover:bg-paper-2",
  ghost: "bg-transparent text-teal-2 border-transparent hover:bg-teal-soft",
  danger: "bg-white text-bad border-bad/40 hover:bg-bad-soft",
  good: "bg-good-soft text-good border-transparent hover:brightness-95",
  warn: "bg-warn-soft text-warn border-transparent hover:brightness-95",
};

export function Button({ variant = "primary", size = "md", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "lg" | "sm" }) {
  const sizes = { sm: "min-h-10 px-3 text-sm", md: "min-h-12 px-4", lg: "min-h-14 px-6 text-lg" };
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`} {...rest} />;
}

export function LinkButton({ href, variant = "primary", size = "md", className = "", children, ...rest }: { href: string; variant?: Variant; size?: "md" | "lg" | "sm"; className?: string; children: ReactNode; "aria-label"?: string }) {
  const sizes = { sm: "min-h-10 px-3 text-sm", md: "min-h-12 px-4", lg: "min-h-14 px-6 text-lg" };
  return (
    <Link href={href as never} className={`inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}

export function Card({ children, className = "", as: Tag = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "li"; "aria-labelledby"?: string; "aria-label"?: string }) {
  return (
    <Tag className={`rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(23,50,75,0.05)] ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function Pill({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "neutral" | "teal" | "good" | "warn" | "bad"; className?: string }) {
  const tones = { neutral: "bg-paper-2 text-ink-2", teal: "bg-teal-soft text-teal-2", good: "bg-good-soft text-good", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${tones[tone]} ${className}`}>{children}</span>;
}

export function Notice({ children, tone = "info", title }: { children: ReactNode; tone?: "info" | "warn" | "good" | "bad"; title?: string }) {
  const tones = { info: "border-teal/30 bg-teal-soft/60", warn: "border-warn/30 bg-warn-soft", good: "border-good/30 bg-good-soft", bad: "border-bad/30 bg-bad-soft" };
  return (
    <div role={tone === "bad" ? "alert" : "note"} className={`rounded-xl border p-3 text-[0.95rem] leading-relaxed ${tones[tone]}`}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function PageTitle({ title, lead, action }: { title: string; lead?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {lead && <p className="mt-1 text-ink-2">{lead}</p>}
      </div>
      {action}
    </header>
  );
}

export function Field({ label, hint, id, children, error }: { label: string; hint?: ReactNode; id: string; children: ReactNode; error?: string | null }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-ink-3">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`min-h-12 w-full rounded-xl border border-line bg-white px-3 text-ink placeholder:text-ink-3 ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`min-h-12 w-full rounded-xl border border-line bg-white px-3 text-ink ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-1 text-ink-2">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm text-ink-2">
        <span>{label}</span>
        <span>
          {value} / {max}
        </span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
        <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" className="py-8 text-center text-ink-3">
      {label}…
    </p>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-2 underline decoration-teal/40 underline-offset-2 hover:decoration-teal">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
