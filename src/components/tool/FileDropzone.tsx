import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { Camera, FileUp, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extensionOf } from "@/lib/format";

export interface FileDropzoneProps {
  /** Comma separated accept list, e.g. "image/jpeg,image/png,.pdf". */
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  title?: string;
  hint?: string;
  icon?: ReactNode;
  /** Extra description of what this zone accepts, shown under the title. */
  formats?: string;
  /** Show a "take photo" button for mobile camera capture. */
  allowCamera?: boolean;
  className?: string;
  /** Called with files that don't match the accept list. */
  onRejected?: (files: File[]) => void;
}

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true;
  const tokens = accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const extension = extensionOf(file.name);
  return tokens.some((token) => {
    if (token.startsWith(".")) return extension === token.slice(1);
    if (token.endsWith("/*")) return file.type.startsWith(token.slice(0, -1));
    if (token === "application/pdf") {
      return file.type === "application/pdf" || extension === "pdf";
    }
    if (token === "image/*") return file.type.startsWith("image/");
    return file.type === token;
  });
}

export function FileDropzone({
  accept,
  multiple = false,
  onFiles,
  disabled = false,
  title = "Drop files here",
  hint = "or choose files from your device",
  icon,
  formats,
  allowCamera = false,
  className,
  onRejected,
}: FileDropzoneProps) {
  const inputId = useId();
  const cameraId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFiles = useCallback(
    (fileList: FileList | File[] | null) => {
      if (!fileList) return;
      const all = Array.from(fileList);
      if (all.length === 0) return;

      const accepted = all.filter((file) => matchesAccept(file, accept));
      const rejected = all.filter((file) => !matchesAccept(file, accept));

      if (rejected.length > 0) {
        if (onRejected) {
          onRejected(rejected);
        } else {
          toast.error(
            rejected.length === 1
              ? `${rejected[0].name} isn't a supported file type here.`
              : `${rejected.length} files were skipped because the type isn't supported here.`,
            { description: formats ? `This tool accepts ${formats}.` : undefined },
          );
        }
      }

      if (accepted.length > 0) {
        onFiles(multiple ? accepted : accepted.slice(0, 1));
      }
    },
    [accept, formats, multiple, onFiles, onRejected],
  );

  const showCamera = allowCamera && (!accept || accept.includes("image"));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={`${title}. ${hint}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled) return;
          acceptFiles(event.dataTransfer?.files ?? null);
        }}
        className={cn(
          "group relative flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted/25 px-5 py-8 text-center transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/40",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-full border bg-background transition-colors",
            dragging ? "border-primary text-primary" : "text-muted-foreground",
          )}
        >
          {icon ?? <UploadCloud className="size-5" />}
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-base font-semibold tracking-tight">{title}</span>
          <span className="text-sm text-muted-foreground">{hint}</span>
          {formats ? (
            <span className="mt-1 font-mono text-xs tracking-tight text-muted-foreground/90">
              {formats}
            </span>
          ) : null}
        </span>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            acceptFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {showCamera ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => document.getElementById(cameraId)?.click()}
          >
            <Camera className="size-4" />
            Take photo
          </Button>
          <input
            id={cameraId}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              acceptFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function DropzoneFileIcon() {
  return <FileUp className="size-5" />;
}
