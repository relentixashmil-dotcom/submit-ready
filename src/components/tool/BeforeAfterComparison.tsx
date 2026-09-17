import { ArrowRight, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes, reductionPercent } from "@/lib/format";

export interface ComparisonSide {
  label: string;
  url?: string | null;
  bytes: number;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  pages?: number | null;
  muted?: boolean;
}

export interface BeforeAfterComparisonProps {
  before: ComparisonSide;
  after: ComparisonSide;
  targetBytes?: number | null;
  metTarget?: boolean;
  notes?: string[];
  className?: string;
}

function StatRow({ side }: { side: ComparisonSide }) {
  return (
    <dl className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
      <div className="flex justify-between gap-3">
        <dt>Size</dt>
        <dd className="text-foreground">{formatBytes(side.bytes)}</dd>
      </div>
      {side.width && side.height ? (
        <div className="flex justify-between gap-3">
          <dt>Dimensions</dt>
          <dd className="text-foreground">
            {side.width} × {side.height} px
          </dd>
        </div>
      ) : null}
      {side.format ? (
        <div className="flex justify-between gap-3">
          <dt>Format</dt>
          <dd className="text-foreground">{side.format}</dd>
        </div>
      ) : null}
      {side.pages ? (
        <div className="flex justify-between gap-3">
          <dt>Pages</dt>
          <dd className="text-foreground">{side.pages}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function PreviewPanel({ side }: { side: ComparisonSide }) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-tight uppercase">
          {side.label}
        </span>
        {side.muted ? (
          <span className="text-[11px] text-muted-foreground">original</span>
        ) : null}
      </div>
      <div className="checkerboard flex h-40 items-center justify-center overflow-hidden rounded-md border">
        {side.url ? (
          <img
            src={side.url}
            alt={`${side.label} preview`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="px-3 text-center text-xs text-muted-foreground">
            No visual preview
          </span>
        )}
      </div>
      <StatRow side={side} />
    </div>
  );
}

export function BeforeAfterComparison({
  before,
  after,
  targetBytes = null,
  metTarget,
  notes = [],
  className,
}: BeforeAfterComparisonProps) {
  const reduction = reductionPercent(before.bytes, after.bytes);
  const grew = after.bytes > before.bytes;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <TrendingDown className="size-4 text-success" />
        <span className="text-sm font-semibold tracking-tight">
          {grew
            ? "Output is larger than the original"
            : reduction > 0
              ? `${reduction}% smaller`
              : "Same size"}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {formatBytes(before.bytes)} → {formatBytes(after.bytes)}
        </span>
        {targetBytes ? (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium",
              metTarget === false
                ? "border-warning/50 bg-warning/10 text-warning-foreground dark:text-warning"
                : "border-success/40 bg-success/10 text-success",
            )}
          >
            {metTarget === false
              ? `Couldn't reach ${formatBytes(targetBytes)}`
              : `Within ${formatBytes(targetBytes)}`}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <PreviewPanel side={before} />
        <div className="hidden items-center justify-center sm:flex">
          <ArrowRight className="size-4 text-muted-foreground" />
        </div>
        <PreviewPanel side={after} />
      </div>

      {notes.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {notes.map((note) => (
            <li key={note} className="text-xs leading-relaxed text-muted-foreground">
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
