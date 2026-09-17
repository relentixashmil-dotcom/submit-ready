import { useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  KB,
  MAX_TARGET_BYTES,
  MB,
  MIN_TARGET_BYTES,
  SIZE_PRESETS,
  formatBytes,
  parseSizeToBytes,
} from "@/lib/format";

export interface SizeTargetSelectorProps {
  /** Target in bytes, or null when no target is set. */
  value: number | null;
  onChange: (bytes: number | null) => void;
  presets?: number[];
  label?: string;
  hint?: string;
  /** Offer a "no target" option that keeps maximum quality. */
  allowNone?: boolean;
  noneLabel?: string;
  minBytes?: number;
  maxBytes?: number;
  className?: string;
}

function displayForCustomValue(bytes: number): { text: string; unit: "KB" | "MB" } {
  if (bytes >= MB) {
    const mb = bytes / MB;
    return { text: String(Math.round(mb * 100) / 100), unit: "MB" };
  }
  return { text: String(Math.round(bytes / KB)), unit: "KB" };
}

export function SizeTargetSelector({
  value,
  onChange,
  presets = SIZE_PRESETS,
  label = "Target file size",
  hint,
  allowNone = false,
  noneLabel = "No target — keep quality",
  minBytes = MIN_TARGET_BYTES,
  maxBytes = MAX_TARGET_BYTES,
  className,
}: SizeTargetSelectorProps) {
  const presetMatch = value !== null && presets.includes(value);
  const [customOpen, setCustomOpen] = useState(value !== null && !presetMatch);
  const [initial] = useState(() =>
    value !== null ? displayForCustomValue(value) : { text: "250", unit: "KB" as const },
  );
  const [unit, setUnit] = useState<"KB" | "MB">(initial.unit);
  const [text, setText] = useState(initial.text);
  const [error, setError] = useState<string | null>(null);

  const applyCustom = () => {
    const bytes = parseSizeToBytes(`${text} ${unit}`);
    if (bytes === null) {
      setError("Enter a number, for example 250.");
      return;
    }
    if (bytes < minBytes) {
      setError(`The smallest useful target is ${formatBytes(minBytes)}.`);
      return;
    }
    if (bytes > maxBytes) {
      setError(`Targets above ${formatBytes(maxBytes)} aren't supported.`);
      return;
    }
    setError(null);
    setCustomOpen(true);
    onChange(bytes);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-semibold tracking-tight">{label}</Label>
        {value !== null ? (
          <span className="font-mono text-xs text-muted-foreground">
            aiming for ≤ {formatBytes(value)}
          </span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">
            no size limit
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const active = presetMatch && value === preset;
          return (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              className="min-w-20"
              onClick={() => {
                setCustomOpen(false);
                setError(null);
                onChange(preset);
              }}
            >
              {active ? <Check className="size-3.5" /> : null}
              {formatBytes(preset)}
            </Button>
          );
        })}

        <Button
          type="button"
          size="sm"
          variant={
            customOpen || (value !== null && !presetMatch) ? "default" : "outline"
          }
          aria-pressed={customOpen || (value !== null && !presetMatch)}
          onClick={() => setCustomOpen((open) => !open)}
        >
          <SlidersHorizontal className="size-3.5" />
          Custom
        </Button>

        {allowNone ? (
          <Button
            type="button"
            size="sm"
            variant={value === null ? "default" : "outline"}
            aria-pressed={value === null}
            onClick={() => {
              setCustomOpen(false);
              setError(null);
              onChange(null);
            }}
          >
            {noneLabel}
          </Button>
        ) : null}
      </div>

      {customOpen ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5 min-w-32">
              <Label htmlFor="custom-size" className="text-xs">
                Custom target
              </Label>
              <Input
                id="custom-size"
                inputMode="decimal"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyCustom();
                  }
                }}
                aria-invalid={Boolean(error)}
                placeholder="250"
              />
            </div>
            <div className="flex gap-1.5">
              {(["KB", "MB"] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={unit === option ? "default" : "outline"}
                  aria-pressed={unit === option}
                  onClick={() => setUnit(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
            <Button type="button" size="sm" onClick={applyCustom}>
              Apply
            </Button>
          </div>
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Anywhere from {formatBytes(minBytes)} to {formatBytes(maxBytes)}.
            </p>
          )}
        </div>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
