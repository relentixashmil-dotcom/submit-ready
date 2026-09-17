import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface ProgressIndicatorProps {
  /** 0–100, or null for an indeterminate task. */
  value?: number | null;
  label: string;
  detail?: string;
  className?: string;
}

export function ProgressIndicator({
  value = null,
  label,
  detail,
  className,
}: ProgressIndicatorProps) {
  const determinate = typeof value === "number";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card px-4 py-3",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        <span className="tracking-tight">{label}</span>
        {determinate ? (
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {Math.round(value)}%
          </span>
        ) : null}
      </div>
      <Progress
        value={determinate ? value : 45}
        className={cn("h-1.5", !determinate && "opacity-70")}
      />
      {detail ? (
        <p className="text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}
