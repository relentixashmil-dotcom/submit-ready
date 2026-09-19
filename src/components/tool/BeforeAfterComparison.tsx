import { ArrowRight, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { ResultStatus } from "./ResultStatus";

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
  /** Verb for the screen-reader summary, e.g. "Compression". */
  action?: string;
  resultLabel?: string;
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
    <figure className="flex flex-1 flex-col gap-3 rounded-lg border bg-card p-3">
      <figcaption className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-tight uppercase">
          {side.label}
        </span>
        {side.muted ? (
          <span className="text-[11px] text-muted-foreground">original</span>
        ) : null}
      </figcaption>
      <div className="checkerboard flex h-40 items-center justify-center overflow-hidden rounded-md border">
        {side.url ? (
          <img
            src={side.url}
            alt={`${side.label} preview`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-3 text-center text-xs text-muted-foreground">
            <ImageIcon className="size-5 opacity-60" aria-hidden="true" />
            No visual preview for this file type
          </span>
        )}
      </div>
      <StatRow side={side} />
    </figure>
  );
}

export function BeforeAfterComparison({
  before,
  after,
  targetBytes = null,
  metTarget,
  action = "Processing",
  resultLabel,
  notes = [],
  className,
}: BeforeAfterComparisonProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <ResultStatus
        originalBytes={before.bytes}
        resultBytes={after.bytes}
        resultLabel={resultLabel ?? after.label}
        resultDetail={
          after.width && after.height ? `${after.width} × ${after.height} px` : undefined
        }
        targetBytes={targetBytes}
        metTarget={metTarget ?? null}
        action={action}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <PreviewPanel side={before} />
        <div className="hidden items-center justify-center sm:flex">
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <PreviewPanel side={after} />
      </div>

      {notes.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {notes.map((note) => (
            <li
              key={note}
              className="text-xs leading-relaxed text-muted-foreground"
            >
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
