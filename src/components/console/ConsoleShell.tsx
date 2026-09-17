import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { cn } from "@/lib/utils";

export interface ConsoleNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** Short status text shown on the right of the sidebar entry. */
  meta?: string;
}

export interface ConsoleShellProps {
  eyebrow: string;
  title: string;
  description: string;
  nav: ConsoleNavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  aside?: ReactNode;
  children: ReactNode;
}

export function ConsoleShell({
  eyebrow,
  title,
  description,
  nav,
  activeId,
  onNavigate,
  aside,
  children,
}: ConsoleShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row">
        <aside className="flex flex-col gap-4 lg:w-60 lg:shrink-0">
          <div className="flex flex-col gap-1">
            <p className="mono-label">{eyebrow}</p>
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden flex-col gap-1 lg:flex">
            {nav.map((item) => {
              const active = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <span className={cn(active ? "text-primary" : "")}>{item.icon}</span>
                  <span className="flex-1 truncate font-medium">{item.label}</span>
                  {item.meta ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.meta}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Mobile tab strip */}
          <nav className="-mx-1 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {nav.map((item) => {
              const active = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-2 font-mono text-xs tracking-wide uppercase transition-colors",
                    active
                      ? "border-primary/60 bg-primary/15 text-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {aside ? <div className="hidden lg:block">{aside}</div> : null}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
      </div>

      <SiteFooter />
    </div>
  );
}

export function ConsolePanel({
  title,
  description,
  actions,
  children,
  className,
  monoLabel,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  monoLabel?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5", className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {monoLabel ? <p className="mono-label">{monoLabel}</p> : null}
            {title ? (
              <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            ) : null}
            {description ? (
              <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "brand-1",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?:
    | "brand-1"
    | "brand-2"
    | "brand-3"
    | "brand-4"
    | "brand-5"
    | "brand-6"
    | "brand-7";
}) {
  const accentClass = {
    "brand-1": "text-brand-1",
    "brand-2": "text-brand-2",
    "brand-3": "text-brand-3",
    "brand-4": "text-brand-4",
    "brand-5": "text-brand-5",
    "brand-6": "text-brand-6",
    "brand-7": "text-brand-7",
  }[accent];

  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="mono-label">{label}</span>
      <span className={cn("font-mono text-2xl font-bold tracking-tight", accentClass)}>
        {value}
      </span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
