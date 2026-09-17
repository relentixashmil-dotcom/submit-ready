import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ToolStepProps {
  step: number;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Rendered on the right of the header, e.g. a status chip. */
  headerAside?: ReactNode;
  state?: "active" | "done" | "todo";
  className?: string;
}

export function ToolStep({
  step,
  title,
  description,
  children,
  headerAside,
  state = "active",
  className,
}: ToolStepProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5",
        state === "todo" && "opacity-70",
        className,
      )}
      aria-label={`Step ${step}: ${title}`}
    >
      <header className="flex flex-wrap items-start gap-3">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold",
            state === "done"
              ? "border-success/40 bg-success/10 text-success"
              : "border-border bg-secondary text-secondary-foreground",
          )}
        >
          {state === "done" ? "✓" : step}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {headerAside}
      </header>
      {children}
    </section>
  );
}

export interface OptionGridProps {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function OptionRow({ label, hint, children, className }: OptionGridProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-semibold tracking-tight">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
