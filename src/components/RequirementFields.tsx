import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { KB } from "@/lib/format";
import type { Requirement } from "@/lib/requirements";

export const TYPE_OPTIONS = ["jpg", "png", "webp", "pdf"];

function NumberField({
  id,
  label,
  value,
  placeholder,
  suffix,
  onCommit,
}: {
  id: string;
  label: string;
  value: number | undefined;
  placeholder?: string;
  suffix?: string;
  onCommit: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));

  useEffect(() => {
    setText(value === undefined ? "" : String(value));
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="font-mono text-[11px] tracking-wide uppercase">
        {label}
        {suffix ? <span className="text-muted-foreground"> / {suffix}</span> : null}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (next.trim() === "") {
            onCommit(undefined);
            return;
          }
          const parsed = Number.parseFloat(next);
          if (Number.isFinite(parsed)) onCommit(parsed);
        }}
      />
    </div>
  );
}

export interface RequirementFieldsProps {
  requirement: Requirement;
  onChange: (next: Requirement) => void;
  className?: string;
}

/** Editable requirement limits, shared by the Application Pack and the console. */
export function RequirementFields({
  requirement,
  onChange,
  className,
}: RequirementFieldsProps) {
  const toggleType = (type: string) => {
    const has = requirement.extensions.includes(type);
    let extensions = has
      ? requirement.extensions.filter((entry) => entry !== type)
      : [...requirement.extensions, type];
    // jpg and jpeg are the same format on the wire.
    if (type === "jpg" && !has) {
      extensions = extensions.filter((entry) => entry !== "jpeg");
    }
    onChange({ ...requirement, extensions });
  };

  return (
    <div className={cn("flex flex-col gap-4 rounded-lg border bg-muted/20 p-3", className)}>
      <div className="flex flex-col gap-2">
        <span className="mono-label">accepted file types</span>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((type) => {
            const active =
              requirement.extensions.includes(type) ||
              (type === "jpg" && requirement.extensions.includes("jpeg"));
            return (
              <Button
                key={type}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => toggleType(type)}
              >
                {type.toUpperCase()}
              </Button>
            );
          })}
        </div>
        {requirement.extensions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No types selected — any file type is accepted.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField
          id="req-min-size"
          label="min size"
          suffix="kb"
          value={requirement.minBytes ? Math.round(requirement.minBytes / KB) : undefined}
          placeholder="none"
          onCommit={(value) =>
            onChange({
              ...requirement,
              minBytes:
                value === undefined ? undefined : Math.max(1, Math.round(value * KB)),
            })
          }
        />
        <NumberField
          id="req-max-size"
          label="max size"
          suffix="kb"
          value={requirement.maxBytes ? Math.round(requirement.maxBytes / KB) : undefined}
          placeholder="none"
          onCommit={(value) =>
            onChange({
              ...requirement,
              maxBytes:
                value === undefined ? undefined : Math.max(1, Math.round(value * KB)),
            })
          }
        />
        <NumberField
          id="req-max-pages"
          label="max pages"
          value={requirement.maxPages}
          placeholder="none"
          onCommit={(value) =>
            onChange({
              ...requirement,
              maxPages: value === undefined ? undefined : Math.max(1, Math.round(value)),
            })
          }
        />
        <NumberField
          id="req-width"
          label="exact width"
          suffix="px"
          value={requirement.exactWidth}
          placeholder="not required"
          onCommit={(value) =>
            onChange({
              ...requirement,
              exactWidth: value === undefined ? undefined : Math.round(value),
            })
          }
        />
        <NumberField
          id="req-height"
          label="exact height"
          suffix="px"
          value={requirement.exactHeight}
          placeholder="not required"
          onCommit={(value) =>
            onChange({
              ...requirement,
              exactHeight: value === undefined ? undefined : Math.round(value),
            })
          }
        />
        <NumberField
          id="req-max-width"
          label="max width"
          suffix="px"
          value={requirement.maxWidth}
          placeholder="none"
          onCommit={(value) =>
            onChange({
              ...requirement,
              maxWidth: value === undefined ? undefined : Math.round(value),
            })
          }
        />
        <NumberField
          id="req-max-height"
          label="max height"
          suffix="px"
          value={requirement.maxHeight}
          placeholder="none"
          onCommit={(value) =>
            onChange({
              ...requirement,
              maxHeight: value === undefined ? undefined : Math.round(value),
            })
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange({
              ...requirement,
              exactWidth: undefined,
              exactHeight: undefined,
              maxWidth: undefined,
              maxHeight: undefined,
              recommendedWidth: undefined,
              recommendedHeight: undefined,
            })
          }
        >
          <RotateCcw className="size-3.5" />
          Clear dimension rules
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange({
              ...requirement,
              minBytes: undefined,
              maxBytes: undefined,
              maxPages: undefined,
            })
          }
        >
          <RotateCcw className="size-3.5" />
          Clear size and page rules
        </Button>
      </div>
    </div>
  );
}
