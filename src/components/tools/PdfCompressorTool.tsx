import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  FileText,
  Gauge,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/tool/FileDropzone";
import { FileList } from "@/components/tool/FileList";
import { ProgressIndicator } from "@/components/tool/ProgressIndicator";
import { SizeTargetSelector } from "@/components/tool/SizeTargetSelector";
import { BeforeAfterComparison } from "@/components/tool/BeforeAfterComparison";
import { DownloadButton } from "@/components/tool/DownloadButton";
import { ToolStep } from "@/components/tool/ToolStep";
import {
  COMPRESSION_LEVELS,
  compressPdf,
  type CompressionLevel,
  type CompressPdfResult,
} from "@/lib/pdf-compress";
import { readPdfInfo } from "@/lib/pdf";
import { closePdf, openPdfForRendering, renderPageThumbnail } from "@/lib/pdf-render";
import {
  PDF_SIZE_PRESETS,
  bytesToBlob,
  describeError,
  formatBytes,
  readAsArrayBuffer,
  reductionPercent,
  suffixName,
} from "@/lib/format";
import { useRunLog } from "@/hooks/use-run-log";
import { cn } from "@/lib/utils";

interface SourceFile {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
  encrypted: boolean;
  previewUrl: string | null;
}

export interface PdfCompressorToolProps {
  initialTargetBytes?: number | null;
  initialLevel?: CompressionLevel;
}

export function PdfCompressorTool({
  initialTargetBytes = null,
  initialLevel = "balanced",
}: PdfCompressorToolProps) {
  const [source, setSource] = useState<SourceFile | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [level, setLevel] = useState<CompressionLevel>(initialLevel);
  const [target, setTarget] = useState<number | null>(initialTargetBytes);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    percent: number;
    stage: string;
    page: number;
    totalPages: number;
  } | null>(null);
  const [result, setResult] = useState<
    (CompressPdfResult & { blob: Blob; name: string; previewUrl: string | null; configKey: string }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRun = useRunLog();

  const configKey = useMemo(
    () => `${level}|${target ?? "none"}`,
    [level, target],
  );
  const stale = Boolean(result && result.configKey !== configKey);

  const loadFile = useCallback(async (file: File) => {
    setLoadingFile(true);
    setResult(null);
    setError(null);
    try {
      const buffer = await readAsArrayBuffer(file);
      const bytes = new Uint8Array(buffer);
      const info = await readPdfInfo(bytes);

      let previewUrl: string | null = null;
      try {
        const pdf = await openPdfForRendering(bytes);
        const thumb = await renderPageThumbnail(pdf, 1, 420, 0.8);
        previewUrl = thumb.dataUrl;
        await closePdf(pdf);
      } catch {
        previewUrl = null;
      }

      setSource({
        file,
        bytes,
        pageCount: info.pageCount,
        encrypted: info.encrypted,
        previewUrl,
      });
      if (info.encrypted) {
        toast.warning("This PDF is password protected", {
          description:
            "Pages can be copied, but content may be missing. Remove the password for a reliable result.",
        });
      }
    } catch (err) {
      const message = describeError(
        err,
        "This PDF couldn't be read. It may be corrupted or password protected.",
      );
      setError(message);
      setSource(null);
      toast.error("Could not open that PDF", { description: message });
    } finally {
      setLoadingFile(false);
    }
  }, []);

  const compress = useCallback(async () => {
    if (!source) return;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const output = await compressPdf(source.bytes, {
        level,
        targetBytes: target,
        signal: controller.signal,
        onProgress: (update) =>
          setProgress({
            percent: update.percent,
            stage: update.stage,
            page: update.page,
            totalPages: update.totalPages,
          }),
      });

      const blob = bytesToBlob(output.bytes, "application/pdf");
      let previewUrl: string | null = null;
      try {
        const pdf = await openPdfForRendering(output.bytes);
        const thumb = await renderPageThumbnail(pdf, 1, 420, 0.8);
        previewUrl = thumb.dataUrl;
        await closePdf(pdf);
      } catch {
        previewUrl = null;
      }

      setResult({
        ...output,
        blob,
        name: suffixName(source.file.name, "compressed", "pdf"),
        previewUrl,
        configKey,
      });

      if (output.metTarget) {
        toast.success(`Compressed to ${formatBytes(output.finalBytes)}`, {
          description: `${reductionPercent(output.originalBytes, output.finalBytes)}% smaller than the original.`,
        });
      } else {
        toast.warning("Target size not reached", {
          description: `The smallest version this browser could produce is ${formatBytes(output.finalBytes)}.`,
        });
      }

      void logRun({
        tool: "pdf-compress",
        label: source.file.name,
        fileCount: 1,
        inputBytes: output.originalBytes,
        outputBytes: output.finalBytes,
        status: output.metTarget ? "ok" : "partial",
        detail: `${COMPRESSION_LEVELS[level].label} · ${
          target ? `target ${formatBytes(target)}` : "no target"
        }`,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast("Compression cancelled");
      } else {
        const message = describeError(
          err,
          "Compression failed. The PDF may be too large for this browser's memory.",
        );
        setError(message);
        toast.error("Compression failed", { description: message });
      }
    } finally {
      abortRef.current = null;
      setProgress(null);
      setBusy(false);
    }
  }, [configKey, level, logRun, source, target]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="flex flex-col gap-5">
      <ToolStep
        step={1}
        title="Select a PDF"
        description="One PDF at a time. The file is read and processed locally."
        state={source ? "done" : "active"}
        headerAside={
          source ? (
            <Badge variant="secondary">
              {source.pageCount} page{source.pageCount === 1 ? "" : "s"}
            </Badge>
          ) : null
        }
      >
        {!source ? (
          <FileDropzone
            accept="application/pdf,.pdf"
            onFiles={(files) => {
              if (files[0]) void loadFile(files[0]);
            }}
            disabled={loadingFile}
            title="Drop a PDF here"
            hint="or choose a file from your device"
            formats="PDF"
            icon={<FileText className="size-5" />}
          />
        ) : (
          <FileList
            items={[
              {
                id: "source",
                name: source.file.name,
                size: source.file.size,
                previewUrl: null,
                kind: "pdf",
                meta: `${source.pageCount} pages`,
                tone: source.encrypted ? "warn" : "default",
                badge: source.encrypted ? (
                  <Badge variant="outline">Password protected</Badge>
                ) : null,
              },
            ]}
            onRemove={() => {
              setSource(null);
              setResult(null);
            }}
          />
        )}
        {loadingFile ? (
          <ProgressIndicator value={null} label="Reading the PDF" />
        ) : null}
        {source?.encrypted ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-warning-foreground dark:text-warning">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            This PDF is encrypted. Pages can be copied without the password, but the
            result may lose content. Unlock the file in a PDF reader first if you can.
          </p>
        ) : null}
        {error && !source ? (
          <p
            className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </ToolStep>

      <ToolStep
        step={2}
        title="Choose how much to compress"
        description="Light is lossless. Higher levels re-render pages as images, which saves the most."
        state={source ? "active" : "todo"}
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {(Object.keys(COMPRESSION_LEVELS) as CompressionLevel[]).map((key) => {
            const profile = COMPRESSION_LEVELS[key];
            const active = level === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setLevel(key)}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                )}
              >
                <span className="flex items-center gap-2">
                  <Gauge className="size-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold tracking-tight">
                    {profile.label}
                  </span>
                  {profile.rasterize ? (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {profile.dpi} DPI · q{Math.round(profile.quality * 100)}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      lossless
                    </span>
                  )}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {profile.summary}
                </span>
              </button>
            );
          })}
        </div>

        <SizeTargetSelector
          value={target}
          onChange={setTarget}
          presets={PDF_SIZE_PRESETS}
          allowNone
          noneLabel="No target"
          label="Target size (optional)"
          hint="Pages share a per-page byte budget, so a whole document lands near the target."
        />

        <p className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          An exact target size can&apos;t be guaranteed. How much a PDF shrinks depends on
          what is inside it — scans and photos compress dramatically, while already
          optimised text PDFs may barely move. You will always see the true result before
          downloading.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="lg"
            className="gap-2"
            disabled={!source || busy}
            onClick={() => void compress()}
          >
            <Gauge className="size-4" />
            {result ? "Compress again" : "Compress PDF"}
          </Button>
          {busy ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={() => abortRef.current?.abort()}
            >
              <X className="size-4" />
              Cancel
            </Button>
          ) : null}
          {stale ? (
            <span className="flex items-center gap-1.5 text-xs text-warning-foreground dark:text-warning">
              <RefreshCw className="size-3.5" />
              Settings changed — compress again to apply them.
            </span>
          ) : null}
        </div>

        {progress ? (
          <ProgressIndicator
            value={progress.percent}
            label={progress.stage}
            detail={
              progress.totalPages > 0
                ? `Page ${Math.max(1, progress.page)} of ${progress.totalPages}`
                : "Working through the document"
            }
          />
        ) : null}

        {error && source ? (
          <p
            className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </ToolStep>

      <ToolStep
        step={3}
        title="Check readability, then download"
        description="Page 1 of the original and the result, rendered side by side."
        state={result ? "active" : "todo"}
      >
        {!result ? (
          <p className="text-sm text-muted-foreground">
            Compress the PDF to see the size comparison and a page preview.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-3",
                result.metTarget
                  ? "border-success/40 bg-success/5"
                  : "border-warning/50 bg-warning/5",
              )}
            >
              <span className="text-sm font-semibold tracking-tight">
                {result.metTarget
                  ? "Ready to upload"
                  : "Smallest possible size reached"}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatBytes(result.originalBytes)} → {formatBytes(result.finalBytes)} ·{" "}
                {reductionPercent(result.originalBytes, result.finalBytes)}% smaller ·{" "}
                {result.originalPages} page
                {result.originalPages === 1 ? "" : "s"} preserved
              </span>
            </div>

            <BeforeAfterComparison
              before={{
                label: "Original page 1",
                url: source?.previewUrl ?? null,
                bytes: result.originalBytes,
                pages: source?.pageCount ?? null,
                muted: true,
              }}
              after={{
                label: "Compressed page 1",
                url: result.previewUrl,
                bytes: result.finalBytes,
                pages: result.originalPages,
              }}
              targetBytes={result.targetBytes}
              metTarget={result.metTarget}
              notes={result.notes}
            />

            <div className="flex flex-wrap items-center gap-3">
              <DownloadButton
                blob={result.blob}
                filename={result.name}
                label={`Download PDF (${formatBytes(result.finalBytes)})`}
                size={result.finalBytes}
              />
              <span className="font-mono text-xs text-muted-foreground">
                {result.lossless
                  ? "lossless rebuild"
                  : `${result.dpi} DPI · quality ${Math.round(result.quality * 100)}%`}
              </span>
            </div>
          </div>
        )}
      </ToolStep>
    </div>
  );
}
