import { useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  GripVertical,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";

export interface FileListItem {
  id: string;
  name: string;
  size?: number;
  previewUrl?: string | null;
  kind?: "image" | "pdf" | "other";
  /** Small line of detail, e.g. "350 × 350 px · JPG". */
  meta?: string;
  badge?: ReactNode;
  tone?: "default" | "pass" | "warn" | "fail";
}

export interface FileListProps {
  items: FileListItem[];
  onRemove?: (id: string) => void;
  reorderable?: boolean;
  onMove?: (id: string, direction: -1 | 1) => void;
  onReorder?: (fromId: string, toId: string) => void;
  renderActions?: (item: FileListItem, index: number) => ReactNode;
  emptyLabel?: string;
  className?: string;
  /** Dim the row while it is being worked on. */
  busyId?: string | null;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  selectLabel?: string;
}

const toneRing: Record<string, string> = {
  default: "border-border",
  pass: "border-success/40",
  warn: "border-warning/50",
  fail: "border-destructive/40",
};

function KindIcon({ kind }: { kind: FileListItem["kind"] }) {
  if (kind === "pdf") return <FileText className="size-4" />;
  return <ImageIcon className="size-4" />;
}

export function FileList({
  items,
  onRemove,
  reorderable = false,
  onMove,
  onReorder,
  renderActions,
  emptyLabel = "No files added yet.",
  className,
  busyId = null,
  selectedIds,
  onToggleSelect,
  selectLabel = "Select",
}: FileListProps) {
  const draggingId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</p>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {items.map((item, index) => {
        const selected = selectedIds?.includes(item.id) ?? false;
        return (
          <li
            key={item.id}
            draggable={reorderable}
            onDragStart={() => {
              draggingId.current = item.id;
            }}
            onDragOver={(event) => {
              if (!reorderable) return;
              event.preventDefault();
              setDragOverId(item.id);
            }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(event) => {
              event.preventDefault();
              const from = draggingId.current;
              setDragOverId(null);
              if (from && from !== item.id) onReorder?.(from, item.id);
              draggingId.current = null;
            }}
            onDragEnd={() => {
              draggingId.current = null;
              setDragOverId(null);
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-card p-2.5 transition-colors sm:p-3",
              toneRing[item.tone ?? "default"],
              dragOverId === item.id && "ring-2 ring-primary/40",
              busyId === item.id && "opacity-60",
            )}
          >
            {onToggleSelect ? (
              <button
                type="button"
                aria-label={`${selectLabel} ${item.name}`}
                aria-pressed={selected}
                onClick={() => onToggleSelect(item.id)}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/60",
                )}
              >
                {selected ? "✓" : index + 1}
              </button>
            ) : (
              <span className="w-5 shrink-0 text-center font-mono text-xs text-muted-foreground">
                {index + 1}
              </span>
            )}

            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40 text-muted-foreground">
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <KindIcon kind={item.kind} />
              )}
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium tracking-tight">
                {item.name}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                {item.size !== undefined ? <span>{formatBytes(item.size)}</span> : null}
                {item.meta ? <span>{item.meta}</span> : null}
              </span>
            </span>

            {item.badge ? <span className="hidden sm:block">{item.badge}</span> : null}

            <span className="flex shrink-0 items-center gap-1">
              {renderActions?.(item, index)}
              {reorderable ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${item.name} up`}
                    disabled={index === 0}
                    onClick={() => onMove?.(item.id, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${item.name} down`}
                    disabled={index === items.length - 1}
                    onClick={() => onMove?.(item.id, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <span
                    className="hidden cursor-grab text-muted-foreground sm:flex"
                    aria-hidden="true"
                  >
                    <GripVertical className="size-4" />
                  </span>
                </>
              ) : null}
              {onRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${item.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
