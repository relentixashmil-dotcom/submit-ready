import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Images, Info, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { FileDropzone } from "@/components/tool/FileDropzone";
import { FileList, type FileListItem } from "@/components/tool/FileList";
import { ProgressIndicator } from "@/components/tool/ProgressIndicator";
import { SizeTargetSelector } from "@/components/tool/SizeTargetSelector";
import { BeforeAfterComparison } from "@/components/tool/BeforeAfterComparison";
import { DownloadAllButton, DownloadButton } from "@/components/tool/DownloadButton";
import { ToolStep } from "@/components/tool/ToolStep";
import {
  type ImageOutput,
  type OutputFormat,
  FORMAT_LABEL,
  compressImage,
  createPreviewDataUrl,
  getImageSize,
  resolveFormat,
} from "@/lib/image";
import {
  describeError,
  formatBytes,
  nextFrame,
  reductionPercent,
  suffixName,
  uid,
} from "@/lib/format";
import { usePack } from "@/context/pack";
import { cn } from "@/lib/utils";

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "original", label: "Keep original" },
  { value: "jpeg", label: "JPG" },
  { value: "webp", label: "WebP" },
  { value: "png", label: "PNG" },
];

const MAX_DIMENSION_OPTIONS = [
  { value: 0, label: "Original size" },
  { value: 2400, label: "2400 px" },
  { value: 1600, label: "1600 px" },
  { value: 1200, label: "1200 px" },
  { value: 800, label: "800 px" },
];

interface Item {
  id: string;
  file: File;
  beforeUrl: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  status: "queued" | "working" | "done" | "error";
  configKey: string | null;
  output: ImageOutput | null;
  afterUrl: string | null;
  error: string | null;
}

export interface ImageCompressorToolProps {
  initialTargetBytes?: number | null;
}

export function ImageCompressorTool({
  initialTargetBytes = null,
}: ImageCompressorToolProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [target, setTarget] = useState<number | null>(initialTargetBytes);
  const [quality, setQuality] = useState(82);
  const [format, setFormat] = useState<OutputFormat>("original");
  const [maxDimension, setMaxDimension] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const { consumeHandoff } = usePack();
  const handoffUsed = useRef(false);

  const configKey = useMemo(
    () => `t:${target ?? "none"}|q:${quality}|f:${format}|m:${maxDimension}`,
    [target, quality, format, maxDimension],
  );

  const addFiles = useCallback(async (files: File[]) => {
    const created: Item[] = [];
    setBusy(true);
    for (const file of files) {
      let beforeUrl: string | null = null;
      let width: number | null = null;
      let height: number | null = null;
      try {
        const [preview, size] = await Promise.all([
          createPreviewDataUrl(file, 360),
          getImageSize(file),
        ]);
        beforeUrl = preview;
        width = size.width;
        height = size.height;
      } catch {
        beforeUrl = null;
      }
      created.push({
        id: uid("img"),
        file,
        beforeUrl,
        sourceWidth: width,
        sourceHeight: height,
        status: "queued",
        configKey: null,
        output: null,
        afterUrl: null,
        error: null,
      });
    }
    setBusy(false);
    setItems((current) => [...current, ...created]);
    setActiveId((current) => current ?? created[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (handoffUsed.current) return;
    const staged = consumeHandoff();
    if (staged) {
      handoffUsed.current = true;
      void addFiles([staged]);
    }
  }, [addFiles, consumeHandoff]);

  /* ------------------------------- processing ------------------------------ */

  const runAll = useCallback(async () => {
    const list = [...itemsRef.current];
    if (list.length === 0) return;
    setBusy(true);

    for (let index = 0; index < list.length; index += 1) {
      const item = list[index];
      if (item.status === "done" && item.configKey === configKey) continue;

      setProgress({ done: index, total: list.length });
      list[index] = { ...item, status: "working" };
      setItems([...list]);

      try {
        const output = await compressImage(item.file, {
          targetBytes: target,
          quality: quality / 100,
          format,
          maxDimension: maxDimension || null,
        });
        const afterUrl = await createPreviewDataUrl(output.blob, 360);
        list[index] = {
          ...item,
          status: "done",
          configKey,
          output,
          afterUrl,
          error: null,
        };
      } catch (error) {
        const message = describeError(
          error,
          "This image couldn't be compressed. It may be corrupted or in an unsupported format.",
        );
        list[index] = {
          ...item,
          status: "error",
          configKey,
          error: message,
        };
        toast.error(`${item.file.name} was skipped`, { description: message });
      }
      setItems([...list]);
      await nextFrame();
    }

    setProgress(null);
    setBusy(false);
  }, [configKey, format, maxDimension, quality, target]);

  useEffect(() => {
    if (items.length === 0) return;
    const timer = window.setTimeout(() => {
      void runAll();
    }, 320);
    return () => window.clearTimeout(timer);
    // `items.length` and the config signature are the only triggers we want.
  }, [configKey, items.length, runAll]);

  /* --------------------------------- derived ------------------------------- */

  const done = items.filter((item) => item.status === "done" && item.output);
  const totalBefore = done.reduce((sum, item) => sum + item.file.size, 0);
  const totalAfter = done.reduce(
    (sum, item) => sum + (item.output?.blob.size ?? 0),
    0,
  );
  const active = items.find((item) => item.id === activeId) ?? items[0] ?? null;
  const anyUnmet = done.some((item) => !item.output?.metTarget);

  const listItems: FileListItem[] = items.map((item) => {
    const output = item.output;
    const delta =
      output && item.status === "done"
        ? `${formatBytes(item.file.size)} → ${formatBytes(output.blob.size)}`
        : item.status === "working"
          ? "compressing…"
          : item.error
            ? "failed"
            : "waiting";
    return {
      id: item.id,
      name: item.file.name,
      size: item.file.size,
      previewUrl: item.afterUrl ?? item.beforeUrl,
      kind: "image",
      meta: delta,
      tone:
        item.status === "error"
          ? "fail"
          : output && !output.metTarget
            ? "warn"
            : item.status === "done"
              ? "pass"
              : "default",
      badge:
        output && item.status === "done" ? (
          <Badge variant={output.metTarget ? "secondary" : "outline"}>
            {reductionPercent(item.file.size, output.blob.size)}% smaller
          </Badge>
        ) : null,
    };
  });

  const zipFiles =
    done.length > 1
      ? done.map((item) => ({
          name: suffixName(
            item.file.name,
            target ? formatBytes(target).replace(/\s/g, "") : "compressed",
            item.output!.format === "jpeg" ? "jpg" : item.output!.format,
          ),
          blob: item.output!.blob,
        }))
      : [];

  return (
    <div className="flex flex-col gap-5">
      <ToolStep
        step={1}
        title="Select images"
        description="Add one photo or a whole batch. Files stay on your device — nothing is uploaded."
        state={items.length > 0 ? "done" : "active"}
      >
        <FileDropzone
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          allowCamera
          onFiles={(files) => void addFiles(files)}
          title="Drop images here"
          hint="or choose files from your device"
          formats="JPG · JPEG · PNG · WebP · GIF"
          icon={<Images className="size-5" />}
        />
        {items.length > 0 ? (
          <FileList
            items={listItems}
            onRemove={(id) => {
              setItems((current) => current.filter((item) => item.id !== id));
              setActiveId((current) => (current === id ? null : current));
            }}
            selectedIds={active ? [active.id] : []}
            onToggleSelect={(id) => setActiveId(id)}
            selectLabel="Preview"
            busyId={items.find((item) => item.status === "working")?.id ?? null}
            renderActions={(item) => {
              const source = items.find((entry) => entry.id === item.id);
              if (!source?.output) return null;
              return (
                <DownloadButton
                  variant="outline"
                  buttonSize="sm"
                  label=""
                  ariaLabel={`Download compressed ${source.file.name}`}
                  blob={source.output.blob}
                  filename={suffixName(
                    source.file.name,
                    target ? formatBytes(target).replace(/\s/g, "") : "compressed",
                    source.output.format === "jpeg" ? "jpg" : source.output.format,
                  )}
                  size={source.output.blob.size}
                />
              );
            }}
          />
        ) : null}
        {items.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Select a row to preview it below. {items.length > 1 ? "All files use the same settings." : ""}
          </p>
        ) : null}
      </ToolStep>

      <ToolStep
        step={2}
        title="Set the requirement"
        description="Pick the exact size the form allows, or compress freely and keep the best quality."
        state={items.length > 0 ? "active" : "todo"}
      >
        <SizeTargetSelector
          value={target}
          onChange={setTarget}
          allowNone
          noneLabel="Best quality"
          hint="Targets are measured after compression, so the downloaded file is verified against them."
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="quality-slider" className="text-sm font-semibold tracking-tight">
                Quality
              </Label>
              <span className="font-mono text-xs text-muted-foreground">
                {quality}%
              </span>
            </div>
            <Slider
              id="quality-slider"
              min={30}
              max={95}
              step={1}
              value={[quality]}
              onValueChange={([value]) => setQuality(value)}
              aria-label="JPEG and WebP quality"
            />
            <p className="text-xs text-muted-foreground">
              A starting point. When a target size is set, SubmitReady lowers quality
              automatically until the file fits.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Label className="text-sm font-semibold tracking-tight">
              Output format
            </Label>
            <div className="flex flex-wrap gap-2">
              {FORMAT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={format === option.value ? "default" : "outline"}
                  aria-pressed={format === option.value}
                  onClick={() => setFormat(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              JPG is the safest choice for portals. PNG stays lossless, so targets
              are met by resizing instead.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label className="text-sm font-semibold tracking-tight">
            Limit dimensions
          </Label>
          <div className="flex flex-wrap gap-2">
            {MAX_DIMENSION_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={maxDimension === option.value ? "default" : "outline"}
                aria-pressed={maxDimension === option.value}
                onClick={() => setMaxDimension(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Capping the longest edge is the fastest route to a small file, and it keeps
            photos far larger than any form needs in check.
          </p>
        </div>
      </ToolStep>

      <ToolStep
        step={3}
        title="Verify and download"
        description="Compare the original with the result, confirm the size, then download."
        state={done.length > 0 ? "active" : "todo"}
      >
        {progress ? (
          <ProgressIndicator
            value={
              progress.total > 0
                ? Math.round((progress.done / progress.total) * 100)
                : null
            }
            label="Compressing images"
            detail={`${progress.done} of ${progress.total} files processed`}
          />
        ) : null}

        {items.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Add at least one image to see the before and after comparison here.
          </p>
        ) : null}

        {active?.error ? (
          <p
            className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {active.error}
          </p>
        ) : null}

        {active?.status === "done" && active.output ? (
          <BeforeAfterComparison
            before={{
              label: "Original",
              url: active.beforeUrl,
              bytes: active.file.size,
              width: active.sourceWidth,
              height: active.sourceHeight,
              format: FORMAT_LABEL[resolveFormat(active.file, "original")],
              muted: true,
            }}
            after={{
              label: "Compressed",
              url: active.afterUrl,
              bytes: active.output.blob.size,
              width: active.output.width,
              height: active.output.height,
              format: FORMAT_LABEL[active.output.format],
            }}
            targetBytes={active.output.targetBytes}
            metTarget={active.output.metTarget}
            notes={active.output.notes}
          />
        ) : null}

        {done.length > 0 ? (
          <div className="flex flex-col gap-4">
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-3",
                anyUnmet
                  ? "border-warning/50 bg-warning/5"
                  : "border-success/40 bg-success/5",
              )}
            >
              <span className="text-sm font-semibold tracking-tight">
                {anyUnmet
                  ? "Some files couldn't reach the target"
                  : done.length === 1
                    ? "File is ready to submit"
                    : `${done.length} files are ready to submit`}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatBytes(totalBefore)} → {formatBytes(totalAfter)} ·{" "}
                {reductionPercent(totalBefore, totalAfter)}% smaller
              </span>
            </div>

            {anyUnmet ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Files marked “couldn’t reach” are already at their smallest possible
                size for this browser. Try the JPG output format, a smaller dimension
                cap, or start from a lower-resolution original.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {active?.output ? (
                <DownloadButton
                  bytes={null}
                  blob={active.output.blob}
                  filename={suffixName(
                    active.file.name,
                    target ? formatBytes(target).replace(/\s/g, "") : "compressed",
                    active.output.format === "jpeg" ? "jpg" : active.output.format,
                  )}
                  label="Download this file"
                  size={active.output.blob.size}
                />
              ) : null}
              {zipFiles.length > 0 ? (
                <DownloadAllButton
                  files={zipFiles}
                  zipName="submitready-compressed-images.zip"
                />
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="gap-2"
                onClick={() => void runAll()}
                disabled={busy}
              >
                <Wand2 className="size-4" />
                Re-run compression
              </Button>
            </div>
          </div>
        ) : null}
      </ToolStep>
    </div>
  );
}
