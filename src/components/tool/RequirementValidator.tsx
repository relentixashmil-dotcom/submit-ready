import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckStatus, ValidationCheck } from "@/lib/requirements";

export interface RequirementValidatorProps {
  checks: ValidationCheck[];
  status?: CheckStatus | null;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  renderAction?: (check: ValidationCheck) => ReactNode;
  className?: string;
  compact?: boolean;
}

const statusStyles: Record<
  CheckStatus,
  { icon: ReactNode; text: string; chip: string; label: string }
> = {
  pass: {
    icon: <CheckCircle2 className="size-4 text-success" />,
    text: "text-foreground",
    chip: "border-success/40 bg-success/10 text-success",
    label: "Meets requirement",
  },
  warn: {
    icon: <AlertTriangle className="size-4 text-warning" />,
    text: "text-foreground",
    chip: "border-warning/50 bg-warning/10 text-warning-foreground dark:text-warning",
    label: "Needs a check",
  },
  fail: {
    icon: <XCircle className="size-4 text-destructive" />,
    text: "text-foreground",
    chip: "border-destructive/40 bg-destructive/10 text-destructive",
    label: "Does not meet requirement",
  },
};

export function RequirementValidator({
  checks,
  status,
  title = "Requirement check",
  subtitle,
  loading = false,
  error = null,
  renderAction,
  className,
  compact = false,
}: RequirementValidatorProps) {
  const derived: CheckStatus =
    checks.some((check) => check.status === "fail")
      ? "fail"
      : checks.some((check) => check.status === "warn")
        ? "warn"
        : "pass";
  const overall = status ?? derived;
  const styles = statusStyles[overall];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold tracking-tight">{title}</span>
        {loading ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Checking…
          </span>
        ) : checks.length > 0 ? (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium",
              styles.chip,
            )}
          >
            {styles.icon}
            <span className="ml-1 align-middle">{styles.label}</span>
          </span>
        ) : null}
      </div>

      {subtitle ? (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {checks.length > 0 ? (
        <ul className={cn("flex flex-col", compact ? "gap-1.5" : "gap-2.5")}>
          {checks.map((check) => {
            const checkStyles = statusStyles[check.status];
            return (
              <li key={check.id} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0">{checkStyles.icon}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("text-sm font-medium tracking-tight", checkStyles.text)}>
                    {check.label}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {check.detail}
                  </span>
                  {renderAction ? (
                    <span className="mt-1.5 flex flex-wrap gap-2">
                      {renderAction(check)}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function StatusDot({ status }: { status: CheckStatus }) {
  const styles = statusStyles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        styles.chip,
      )}
    >
      {styles.icon}
      <span className="ml-1">
        {status === "pass" ? "Valid" : status === "warn" ? "Check" : "Fix needed"}
      </span>
    </span>
  );
}
