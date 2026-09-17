import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Images, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FileDropzone } from "@/components/tool/FileDropzone";
import { FileList, type FileListItem } from "@/components/tool/FileList";
import { ProgressIndicator } from "@/components/tool/ProgressIndicator";
import { DownloadButton } from "@/components/tool/DownloadButton";
import { BeforeAfterComparison } from "@/components/tool/BeforeAfterComparison";
import { ToolStep, OptionRow } from "@/components/tool/ToolStep";
import { MM_TO_PT, imagesToPdf, type Orientation, type PagePreset } from "@/lib/pdf";
import { openPdfForRendering, renderPageThumbnail, closePdf } from "@/lib/pdf-render";
import {
  createPreviewDataUrl,
  getImageSize,
  prepareImageForPdf,
  type PreparedPdfImage,
} from "@/lib/image";
import {
  bytesToBlob,
  describeError,
  formatBytes,
  nextFrame,
  uid,
} from "@/lib/format";
import { usePack } from "@/context/pack";

const PAGE_OPTIONS: { value: PagePreset; label: string; hint: string }[] = [
  { value: "a4", label: "A4", hint: "210 × 297 mm" },
  { value: "letter", label: "Letter", hint: "8.5 × 11 in" },
  { value: "image", label: "Image size", hint: "matches each photo" },
];

const ORIENTATION_OPTIONS: { value: Orientation; label: string }[] = [
  { value: "auto", label: "Automatic" },
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];

interface Item {
  id: string;
  file: File;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
}

interface PdfResult {
  blob: Blob;
  bytes: Uint8Array;
  pageCount: number;
  size: number;
  name: string;
  configKey: string;
  previewUrl: string | null;
}

export function ImagesToPdfTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [pageSize, setPageSize] = useState<PagePreset>("a4");
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [marginMm, setMarginMm] = useState(8);
  const [quality, setQuality] = useState(85);
  const [keepTransparency, setKeepTransparency] = useState(false);
  const [result, setResult] = useState<PdfResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const { consumeHandoff } = usePack();
  const handoffUsed = useRef(false);

  const configKey = useMemo(
    () => `${pageSize}|${orientation}|${marginMm}|${quality}|${keepTransparency}`,
    [keepTransparency, marginMm, orientation, pageSize, quality],
  );
  const stale = Boolean(result && result.configKey !== configKey);

  const addFiles = useCallback(async (files: File[]) => {
    const created: Item[] = [];
    for (const file of files) {
      try {
        const [preview, size] = await Promise.all([
          createPreviewDataUrl(file, 260),
          getImageSize(file),
        ]);
        created.push({
          id: uid("pdf-img"),
          file,
          previewUrl: preview,
          width: size.width,
          height: size.height,
        });
      } catch (error) {
        toast.error(`${file.name} couldn't be read`, {
          description: describeError(
            error,
            "The image may be corrupted or in a format the browser can't decode.",
          ),
        });
      }
    }
    if (created.length > 0) {
      setItems((current) => [...current, ...created]);
      setResult(null);
    }
  }, []);

  useEffect(() => {
    if (handoffUsed.current) return;
    const staged = consumeHandoff();
    if (staged) {
      handoffUsed.current = true;
      void addFiles([staged]);
    }
  }, [addFiles, consumeHandoff]);

  const move = useCallback((id: string, direction: -1 | 1) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setResult(null);
  }, []);

  const reorder = useCallback((fromId: string, toId: string) => {
    setItems((current) => {
      const from = current.findIndex((item) => item.id === fromId);
      const to = current.findIndex((item) => item.id === toId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setResult(null);
  }, []);

  const generate = useCallback(async () => {
    if (items.length === 0) {
      toast.error("Add at least one image first.");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: items.length, label: "Preparing images" });
    try {
      const prepared: PreparedPdfImage[] = [];
      for (let index = 0; index < items.length; index += 1) {
        setProgress({
          done: index,
          total: items.length,
          label: "Preparing images",
        });
        const image = await prepareImageForPdf(items[index].file, {
          quality: quality / 100,
          maxDimension: 2400,
          keepTransparency,
        });
        prepared.push(image);
        await nextFrame();
      }

      setProgress({ done: items.length, total: items.length, label: "Building the PDF" });
      const output = await imagesToPdf(prepared, {
        pageSize,
        orientation,
        margin: marginMm * MM_TO_PT,
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
        blob,
        bytes: output.bytes,
        pageCount: output.pageCount,
        size: blob.size,
        name: "submitready-document.pdf",
        configKey,
        previewUrl,
      });
      toast.success(`PDF created with ${output.pageCount} page${output.pageCount === 1 ? "" : "s"}`,
        { description: formatBytes(blob.size) });
    } catch (err) {
      const message = describeError(
        err,
        "The PDF could not be created. Try removing the largest image and generating again.",
      );
      setError(message);
      toast.error("PDF creation failed", { description: message });
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }, [configKey, items, keepTransparency, marginMm, orientation, pageSize, quality]);

  const listItems: FileListItem[] = items.map((item) => ({
    id: item.id,
    name: item.file.name,
    size: item.file.size,
    previewUrl: item.previewUrl,
    kind: "image",
    meta:
      item.width && item.height ? `${item.width} × ${item.height} px` : undefined,
  }));

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);

  return (
    <div className="flex flex-col gap-5">
      <ToolStep
        step={1}
        title="Add and order the images"
        description="Each image becomes one page. Drag rows or use the arrows to set the order."
        state={items.length > 0 ? "done" : "active"}
        headerAside={
          items.length > 0 ? (
            <Badge variant="secondary">
              {items.length} image{items.length === 1 ? "" : "s"} ·{" "}
              {formatBytes(totalBytes)}
            </Badge>
          ) : null
        }
      >
        <FileDropzone
          accept="image/jpeg,image/png,image/webp"
          multiple
          allowCamera
          onFiles={(files) => void addFiles(files)}
          title="Drop images or scans here"
          hint="photos, scanned pages, screenshots"
          formats="JPG · PNG · WebP"
          icon={<Images className="size-5" />}
        />
        <FileList
          items={listItems}
          reorderable
          onRemove={(id) => {
            setItems((current) => current.filter((item) => item.id !== id));
            setResult(null);
          }}
          onMove={move}
          onReorder={reorder}
          emptyLabel="No images added yet."
        />
      </ToolStep>

      <ToolStep
        step={2}
        title="Page setup"
        description="A4 or Letter for printing, or keep each image's own proportions."
        state={items.length > 0 ? "active" : "todo"}
      >
        <OptionRow label="Page size">
          {PAGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={pageSize === option.value ? "default" : "outline"}
              aria-pressed={pageSize === option.value}
              onClick={() => setPageSize(option.value)}
            >
              {option.label}
              <span className="font-mono text-[11px] text-muted-foreground">
                {option.hint}
              </span>
            </Button>
          ))}
        </OptionRow>

        {pageSize !== "image" ? (
          <OptionRow label="Orientation">
            {ORIENTATION_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={orientation === option.value ? "default" : "outline"}
                aria-pressed={orientation === option.value}
                onClick={() => setOrientation(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </OptionRow>
        ) : (
          <p className="text-xs text-muted-foreground">
            Image-size pages use each photo&apos;s own dimensions, capped at A4 length so
            print sizes stay sensible.
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="margin-slider" className="text-sm font-semibold tracking-tight">
                Margin
              </Label>
              <span className="font-mono text-xs text-muted-foreground">
                {marginMm} mm
              </span>
            </div>
            <Slider
              id="margin-slider"
              min={0}
              max={25}
              step={1}
              value={[marginMm]}
              onValueChange={([value]) => setMarginMm(value)}
            />
            <p className="text-xs text-muted-foreground">
              Images are scaled to fit inside the margin box, never stretched.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="image-quality" className="text-sm font-semibold tracking-tight">
                Image quality
              </Label>
              <span className="font-mono text-xs text-muted-foreground">
                {quality}%
              </span>
            </div>
            <Slider
              id="image-quality"
              min={50}
              max={95}
              step={1}
              value={[quality]}
              onValueChange={([value]) => setQuality(value)}
            />
            <p className="text-xs text-muted-foreground">
              Lower quality means a smaller PDF. 85% suits scans and documents.
            </p>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/25 px-3 py-2.5 sm:max-w-md">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="keep-transparency" className="font-medium">
              Keep transparent areas
            </Label>
            <span className="text-xs text-muted-foreground">
              Off (recommended): flatten to white. On: embed PNG instead, which is larger.
            </span>
          </div>
          <Switch
            id="keep-transparency"
            checked={keepTransparency}
            onCheckedChange={setKeepTransparency}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="lg"
            className="gap-2"
            disabled={busy || items.length === 0}
            onClick={() => void generate()}
          >
            <FileText className="size-4" />
            {result ? "Regenerate PDF" : "Create PDF"}
          </Button>
          {stale ? (
            <span className="flex items-center gap-1.5 text-xs text-warning-foreground dark:text-warning">
              <RefreshCw className="size-3.5" />
              Settings changed — regenerate to apply them.
            </span>
          ) : null}
          {items.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Add at least one image to create a PDF.
            </span>
          ) : null}
        </div>

        {progress ? (
          <ProgressIndicator
            value={
              progress.total > 0
                ? Math.round((progress.done / progress.total) * 100)
                : null
            }
            label={progress.label}
            detail={
              progress.done < progress.total
                ? `Image ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`
                : "Writing the PDF file"
            }
          />
        ) : null}

        {error ? (
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
        title="Check and download"
        description="A preview of page 1 is rendered from the PDF you just created."
        state={result ? "active" : "todo"}
      >
        {!result ? (
          <p className="text-sm text-muted-foreground">
            The generated PDF appears here with its page count and size.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <BeforeAfterComparison
              before={{
                label: `${items.length} image${items.length === 1 ? "" : "s"}`,
                url: items[0]?.previewUrl ?? null,
                bytes: totalBytes,
                muted: true,
              }}
              after={{
                label: "PDF page 1",
                url: result.previewUrl,
                bytes: result.size,
                pages: result.pageCount,
              }}
              notes={
                stale
                  ? ["These settings have changed since the PDF was created. Regenerate to apply them."]
                  : [
                      `Layout: ${pageSize === "image" ? "image size" : pageSize.toUpperCase()}${
                        pageSize === "image" ? "" : ` · ${orientation}`
                      } · ${marginMm} mm margin`,
                    ]
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <DownloadButton
                blob={result.blob}
                filename={result.name}
                label={`Download PDF (${formatBytes(result.size)})`}
                size={result.size}
              />
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Lock className="size-3.5 text-success" />
                built in your browser
              </span>
            </div>
          </div>
        )}
      </ToolStep>
    </div>
  );
}
