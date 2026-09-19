import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  tone?: "neutral" | "success" | "warning";
}

const toneClasses: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  neutral: "border-border bg-muted/20",
  success: "border-success/40 bg-success/5",
  warning: "border-warning/50 bg-warning/5",
};

const toneIconClasses: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  neutral: "bg-secondary text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
};

/**
 * Explains what a section will show, instead of leaving a bare line of grey
 * text. Used for the "nothing here yet" state of every tool step.
 */
export function EmptyState({
  icon,
  title,
  description,
  children,
  className,
  tone = "neutral",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border border-dashed px-4 py-5 sm:flex-row sm:items-center",
        toneClasses[tone],
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg border",
            toneIconClasses[tone],
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold tracking-tight">{title}</span>
        {description ? (
          <span className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto">{children}</div>
      ) : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  className?: string;
}

/** A consistent, screen-reader-announced error block for tool failures. */
export function ErrorState({
  title = "Something went wrong",
  message,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5",
        className,
      )}
    >
      <span className="text-sm font-semibold tracking-tight text-destructive">
        {title}
      </span>
      <span className="text-sm leading-relaxed text-destructive/90">{message}</span>
    </div>
  );
}
