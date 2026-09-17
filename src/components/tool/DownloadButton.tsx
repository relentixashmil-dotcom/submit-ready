import { useState, type ComponentProps } from "react";
import { Download, FileArchive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type NamedBlob,
  bytesToBlob,
  downloadAllSequential,
  downloadAsZip,
  downloadBlob,
  formatBytes,
} from "@/lib/format";

type ButtonProps = ComponentProps<typeof Button>;

export interface DownloadButtonProps {
  blob?: Blob | null;
  bytes?: Uint8Array | null;
  filename: string;
  label?: string;
  /** Accessible name; defaults to the visible label or the file name. */
  ariaLabel?: string;
  size?: number;
  disabled?: boolean;
  variant?: ButtonProps["variant"];
  buttonSize?: ButtonProps["size"];
  className?: string;
  mime?: string;
}

export function DownloadButton({
  blob = null,
  bytes = null,
  filename,
  label = "Download",
  ariaLabel,
  size,
  disabled = false,
  variant = "default",
  buttonSize = "default",
  className,
  mime = "application/pdf",
}: DownloadButtonProps) {
  const ready = Boolean(blob || bytes);

  return (
    <Button
      type="button"
      variant={variant}
      size={buttonSize}
      aria-label={ariaLabel ?? (label || `Download ${filename}`)}
      disabled={disabled || !ready}
      className={cn("gap-2", className)}
      onClick={() => {
        const payload = blob ?? (bytes ? bytesToBlob(bytes, mime) : null);
        if (!payload) {
          toast.error("There's nothing to download yet.");
          return;
        }
        downloadBlob(payload, filename);
        toast.success(`Downloaded ${filename}`, {
          description: size ? formatBytes(payload.size) : undefined,
        });
      }}
    >
      <Download className="size-4" />
      {label}
    </Button>
  );
}

export interface DownloadAllButtonProps {
  files: NamedBlob[];
  zipName?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

/** Batch download as a single ZIP, with a fallback to individual downloads. */
export function DownloadAllButton({
  files,
  zipName = "submitready-files.zip",
  label = "Download all as ZIP",
  className,
  disabled = false,
}: DownloadAllButtonProps) {
  const [busy, setBusy] = useState(false);
  const empty = files.length === 0;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button
        type="button"
        disabled={disabled || empty || busy}
        className="gap-2"
        onClick={async () => {
          setBusy(true);
          const toastId = toast.loading("Zipping files in your browser…");
          try {
            await downloadAsZip(files, zipName);
            toast.success(`Downloaded ${files.length} files as ${zipName}`, {
              id: toastId,
            });
          } catch (error) {
            toast.error("The ZIP couldn't be created", {
              id: toastId,
              description:
                error instanceof Error
                  ? error.message
                  : "Try downloading the files individually.",
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileArchive className="size-4" />
        )}
        {label}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || empty || busy}
        className="gap-2"
        onClick={async () => {
          setBusy(true);
          try {
            await downloadAllSequential(files);
            toast.success(`Downloading ${files.length} files one by one…`);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download className="size-4" />
        Download individually
      </Button>
    </div>
  );
}
