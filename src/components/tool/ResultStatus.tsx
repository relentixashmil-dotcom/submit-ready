import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MinusCircle,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes, reductionPercent } from "@/lib/format";

export interface ResultStatusProps {
  /** Bytes of the file the user supplied. */
  originalBytes: number;
  /** Bytes of the file that was produced. */
  resultBytes: number;
  /** Name of the produced file, e.g. "Compressed" or "Merged PDF". */
  resultLabel?: string;
  /** Extra detail under the result, e.g. "350 × 350 px" or "3 pages". */
  resultDetail?: string;
  /** The size the form asked for, or null when there is no requirement. */
  targetBytes?: number | null;
  /** true = target met, false = target not met, null/undefined = no target. */
  metTarget?: boolean | null;
  /** Whether processing produced a usable file. */
  processed?: boolean;
  /** Verb describing the work, used in the screen-reader summary. */
  action?: string;
  className?: string;
  compact?: boolean;
}

function Readout({
  label,
  value,
  detail,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-lg border px-3 py-2.5",
        emphasis ? "border-primary/40 bg-primary/5" : "border-border bg-muted/25",
      )}
    >
      <span className="mono-label">{label}</span>
      <span
        className={cn(
          "font-mono text-lg font-bold tracking-tight tabular-nums",
          emphasis ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
      {detail ? (
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {detail}
        </span>
      ) : null}
    </div>
  );
}

function Connector() {
  return (
    <span
      aria-hidden="true"
      className="hidden items-center justify-center text-muted-foreground sm:flex"
    >
      <ArrowRight className="size-4" />
    </span>
  );
}

function Chip({
  icon,
  children,
  className,
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * The single place that reports what happened to a file.
 *
 * It deliberately separates two facts that are easy to confuse:
 *   • "Processed successfully" — the tool produced a usable file.
 *   • "Requirement satisfied"  — that file also meets the limit you asked for.
 *
 * A 2.8 MB photo that lands at 120 KB was processed successfully but does not
 * satisfy a 100 KB requirement, and this component says so plainly.
 */
export function ResultStatus({
  originalBytes,
  resultBytes,
  resultLabel = "Result",
  resultDetail,
  targetBytes = null,
  metTarget = null,
  processed = true,
  action = "Processing",
  className,
  compact = false,
}: ResultStatusProps) {
  const target = targetBytes ?? null;
  const met = target !== null ? metTarget !== false : null;
  const reduction = reductionPercent(originalBytes, resultBytes);
  const grew = resultBytes > originalBytes;

  const requirement = target
    ? met
      ? {
          icon: <ShieldCheck className="size-3.5" />,
          text: `Under ${formatBytes(target)}`,
          cls: "border-success/50 bg-success/10 text-success",
        }
      : {
          icon: <ShieldAlert className="size-3.5" />,
          text: `Couldn't reach ${formatBytes(target)}`,
          cls: "border-warning/50 bg-warning/10 text-warning-foreground dark:text-warning",
        }
    : {
        icon: <MinusCircle className="size-3.5" />,
        text: "No size requirement",
        cls: "border-border bg-muted/40 text-muted-foreground",
      };

  const spoken = processed
    ? `${action} complete. Original ${formatBytes(originalBytes)}, ${resultLabel.toLowerCase()} ${formatBytes(resultBytes)}. ${
        target
          ? met
            ? `Requirement satisfied: under ${formatBytes(target)}.`
            : `Requirement not met: the target was ${formatBytes(target)}.`
          : "No size requirement was set."
      }`
    : `${action} did not complete.`;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className="flex flex-wrap items-stretch gap-2 sm:gap-3"
        role="group"
        aria-label="Result: original, result and status"
      >
        <Readout label="Original" value={formatBytes(originalBytes)} />
        <Connector />
        <Readout
          label={resultLabel}
          value={formatBytes(resultBytes)}
          detail={resultDetail}
          emphasis
        />
        <Connector />
        <div className="flex min-w-40 flex-1 flex-col justify-center gap-1.5">
          <span className="mono-label">Status</span>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              icon={
                processed ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  <ShieldAlert className="size-3.5" />
                )
              }
              className={
                processed
                  ? "border-success/50 bg-success/10 text-success"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }
            >
              {processed ? "Processed successfully" : "Not processed"}
            </Chip>
            <Chip icon={requirement.icon} className={requirement.cls}>
              {requirement.text}
            </Chip>
          </div>
          {!compact && processed ? (
            <span className="font-mono text-[11px] text-muted-foreground">
              {grew
                ? "larger than the original"
                : reduction > 0
                  ? `${reduction}% smaller`
                  : "same size"}
            </span>
          ) : null}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {spoken}
      </p>
    </div>
  );
}
