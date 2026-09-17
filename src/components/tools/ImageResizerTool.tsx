import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { AlertTriangle, Crop, Info, Maximize2, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FileDropzone } from "@/components/tool/FileDropzone";
import { FileList, type FileListItem } from "@/components/tool/FileList";
import { ProgressIndicator } from "@/components/tool/ProgressIndicator";
import { BeforeAfterComparison } from "@/components/tool/BeforeAfterComparison";
import { DownloadAllButton, DownloadButton } from "@/components/tool/DownloadButton";
import { ToolStep } from "@/components/tool/ToolStep";
import {
  type ImageOutput,
  type OutputFormat,
  type ResizeMode,
  FORMAT_LABEL,
  createPreviewDataUrl,
  getImageSize,
  planResize,
  resizeImage,
} from "@/lib/image";
import {
  describeError,
  formatBytes,
  nextFrame,
  suffixName,
  uid,
} from "@/lib/format";
import { usePack } from "@/context/pack";
import { cn } from "@/lib/utils";

interface Preset {
  label: string;
  hint: string;
  mode: ResizeMode;
  width?: number;
  height?: number;
  longestEdge?: number;
  crop?: boolean;
}

const PRESETS: Preset[] = [
  { label: "Application photo", hint: "350 × 350 px", mode: "exact", width: 350, height: 350, crop: true },
  { label: "Photo copy", hint: "200 × 230 px", mode: "exact", width: 200, height: 230, crop: true },
  { label: "Passport square", hint: "600 × 600 px", mode: "exact", width: 600, height: 600, crop: true },
  { label: "Signature", hint: "140 × 60 px", mode: "exact", width: 140, height: 60, crop: true },
  { label: "Wide signature", hint: "300 × 80 px", mode: "exact", width: 300, height: 80, crop: true },
  { label: "Document scan", hint: "longest edge 1600 px", mode: "longest-edge", longestEdge: 1600 },
  { label: "Web image", hint: "longest edge 1200 px", mode: "longest-edge", longestEdge: 1200 },
];

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "original", label: "Keep original" },
  { value: "jpeg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
];

interface Item {
  id: string;
  file: File;
  beforeUrl: string | null;
  sourceWidth: number;
  sourceHeight: number;
  status: "queued" | "working" | "done" | "error";
  configKey: string | null;
  output: ImageOutput | null;
  afterUrl: string | null;
  error: string | null;
}

export function ImageResizerTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<ResizeMode>("exact");
  const [width, setWidth] = useState("350");
  const [height, setHeight] = useState("350");
  const [percent, setPercent] = useState("50");
  const [longestEdge, setLongestEdge] = useState("1600");
  const [keepAspect, setKeepAspect] = useState(true);
  const [crop, setCrop] = useState(true);
  const [format, setFormat] = useState<OutputFormat>("jpeg");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const { consumeHandoff } = usePack();
  const handoffUsed = useRef(false);

  const parsedWidth = Number.parseInt(width, 10) || 0;
  const parsedHeight = Number.parseInt(height, 10) || 0;
  const parsedPercent = Number.parseFloat(percent) || 0;
  const parsedLongest = Number.parseInt(longestEdge, 10) || 0;

  const configKey = useMemo(
    () =>
      [
        mode,
        mode === "exact" ? `${parsedWidth}x${parsedHeight}` : "",
        mode === "percent" ? `${parsedPercent}` : "",
        mode === "longest-edge" ? `${parsedLongest}` : "",
        keepAspect ? "keep" : "stretch",
        crop ? "crop" : "fit",
        format,
        quality,
      ].join("|"),
    [
      crop,
      format,
      keepAspect,
      mode,
      parsedHeight,
      parsedLongest,
      parsedPercent,
      parsedWidth,
      quality,
    ],
  );

  const addFiles = useCallback(async (files: File[]) => {
    const created: Item[] = [];
    for (const file of files) {
      try {
        const [preview, size] = await Promise.all([
          createPreviewDataUrl(file, 320),
          getImageSize(file),
        ]);
        created.push({
          id: uid("resize"),
          file,
          beforeUrl: preview,
          sourceWidth: size.width,
          sourceHeight: size.height,
          status: "queued",
          configKey: null,
          output: null,
          afterUrl: null,
          error: null,
        });
      } catch (error) {
        toast.error(`${file.name} couldn't be read`, {
          description: describeError(error, "The image may be corrupted."),
        });
      }
    }
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

  const resizeOptions = useCallback(
    () => ({
      mode,
      width: parsedWidth,
      height: parsedHeight,
      percent: parsedPercent,
      longestEdge: parsedLongest,
      keepAspectRatio: keepAspect,
      crop: mode === "exact" && keepAspect && crop,
      format,
      quality: quality / 100,
      background: format === "jpeg" || format === "original" ? "#ffffff" : null,
    }),
    [
      crop,
      format,
      keepAspect,
      mode,
      parsedHeight,
      parsedLongest,
      parsedPercent,
      parsedWidth,
      quality,
    ],
  );

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
        const output = await resizeImage(item.file, resizeOptions());
        const afterUrl = await createPreviewDataUrl(output.blob, 320);
        list[index] = { ...item, status: "done", configKey, output, afterUrl, error: null };
      } catch (error) {
        const message = describeError(error, "This image couldn't be resized.");
        list[index] = { ...item, status: "error", configKey, error: message };
        toast.error(`${item.file.name} failed`, { description: message });
      }
      setItems([...list]);
      await nextFrame();
    }
    setProgress(null);
    setBusy(false);
  }, [configKey, resizeOptions]);

  useEffect(() => {
    if (items.length === 0) return;
    const timer = window.setTimeout(() => void runAll(), 300);
    return () => window.clearTimeout(timer);
  }, [configKey, items.length, runAll]);

  const active = items.find((item) => item.id === activeId) ?? items[0] ?? null;
  const plan = active
    ? planResize(
        { width: active.sourceWidth, height: active.sourceHeight },
        resizeOptions(),
      )
    : null;
  const upscaling = plan ? plan.scale > 1.01 : false;

  const listItems: FileListItem[] = items.map((item) => ({
    id: item.id,
    name: item.file.name,
    size: item.file.size,
    previewUrl: item.afterUrl ?? item.beforeUrl,
    kind: "image",
    meta:
      item.status === "done" && item.output
        ? `${item.sourceWidth} × ${item.sourceHeight} → ${item.output.width} × ${item.output.height} px`
        : item.error
          ? "failed"
          : `${item.sourceWidth} × ${item.sourceHeight} px`,
    tone:
      item.status === "error"
        ? "fail"
        : item.status === "done"
          ? "pass"
          : "default",
    badge:
      item.status === "done" && item.output ? (
        <Badge variant="secondary">
          {FORMAT_LABEL[item.output.format]}
        </Badge>
      ) : null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <ToolStep
        step={1}
        title="Select images"
        description="Resize one image, or apply the same dimensions to a batch."
        state={items.length > 0 ? "done" : "active"}
      >
        <FileDropzone
          accept="image/jpeg,image/png,image/webp"
          multiple
          allowCamera
          onFiles={(files) => void addFiles(files)}
          title="Drop images here"
          hint="or choose files from your device"
          formats="JPG · PNG · WebP"
          icon={<Maximize2 className="size-5" />}
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
                  ariaLabel={`Download resized ${source.file.name}`}
                  blob={source.output.blob}
                  filename={suffixName(
                    source.file.name,
                    `${source.output.width}x${source.output.height}`,
                    source.output.format === "jpeg" ? "jpg" : source.output.format,
                  )}
                  size={source.output.blob.size}
                />
              );
            }}
          />
        ) : null}
      </ToolStep>

      <ToolStep
        step={2}
        title="Choose the new size"
        description="Type the exact dimensions a portal asks for, or start from a preset."
        state={items.length > 0 ? "active" : "todo"}
      >
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold tracking-tight">
            Common requirements
          </Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const activePreset =
                preset.mode === mode &&
                (preset.mode === "exact"
                  ? preset.width === parsedWidth && preset.height === parsedHeight
                  : preset.longestEdge === parsedLongest);
              return (
                <Button
                  key={preset.label}
                  type="button"
                  size="sm"
                  variant={activePreset ? "default" : "outline"}
                  aria-pressed={activePreset}
                  onClick={() => {
                    setMode(preset.mode);
                    if (preset.width) setWidth(String(preset.width));
                    if (preset.height) setHeight(String(preset.height));
                    if (preset.longestEdge) setLongestEdge(String(preset.longestEdge));
                    if (preset.crop !== undefined) {
                      setCrop(preset.crop);
                      setKeepAspect(true);
                    }
                  }}
                >
                  {preset.label}
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {preset.hint}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label className="text-sm font-semibold tracking-tight">
            Resize method
          </Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "exact", label: "Exact width & height", icon: <Ruler className="size-3.5" /> },
                { value: "percent", label: "Percentage", icon: <Maximize2 className="size-3.5" /> },
                { value: "longest-edge", label: "Longest edge", icon: <Crop className="size-3.5" /> },
              ] as { value: ResizeMode; label: string; icon: ReactNode }[]
            ).map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={mode === option.value ? "default" : "outline"}
                aria-pressed={mode === option.value}
                onClick={() => setMode(option.value)}
              >
                {option.icon}
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {mode === "exact" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="resize-width">Width (px)</Label>
              <Input
                id="resize-width"
                inputMode="numeric"
                value={width}
                onChange={(event) => setWidth(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="resize-height">Height (px)</Label>
              <Input
                id="resize-height"
                inputMode="numeric"
                value={height}
                onChange={(event) => setHeight(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        {mode === "percent" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="percent-input" className="text-sm font-semibold tracking-tight">
                Scale
              </Label>
              <span className="font-mono text-xs text-muted-foreground">
                {percent}%
              </span>
            </div>
            <Slider
              min={5}
              max={200}
              step={5}
              value={[Math.min(200, Math.max(5, parsedPercent))]}
              onValueChange={([value]) => setPercent(String(value))}
              aria-label="Resize percentage"
            />
            <div className="flex flex-wrap gap-2">
              {[25, 50, 75, 100].map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={parsedPercent === value ? "default" : "outline"}
                  aria-pressed={parsedPercent === value}
                  onClick={() => setPercent(String(value))}
                >
                  {value}%
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {mode === "longest-edge" ? (
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor="longest-edge">Longest edge (px)</Label>
            <Input
              id="longest-edge"
              inputMode="numeric"
              value={longestEdge}
              onChange={(event) => setLongestEdge(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Width and height shrink together, so nothing is distorted.
            </p>
          </div>
        ) : null}

        {mode === "exact" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/25 px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="keep-aspect" className="font-medium">
                  Maintain aspect ratio
                </Label>
                <span className="text-xs text-muted-foreground">
                  Prevents stretching and squashing.
                </span>
              </div>
              <Switch
                id="keep-aspect"
                checked={keepAspect}
                onCheckedChange={setKeepAspect}
              />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/25 px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="crop-mode" className="font-medium">
                  Crop to fill exactly
                </Label>
                <span className="text-xs text-muted-foreground">
                  Trims the overflow evenly to hit the exact size.
                </span>
              </div>
              <Switch
                id="crop-mode"
                checked={crop}
                disabled={!keepAspect}
                onCheckedChange={setCrop}
              />
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
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
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="resize-quality" className="text-sm font-semibold tracking-tight">
                Quality
              </Label>
              <span className="font-mono text-xs text-muted-foreground">
                {quality}%
              </span>
            </div>
            <Slider
              id="resize-quality"
              min={40}
              max={100}
              step={1}
              value={[quality]}
              onValueChange={([value]) => setQuality(value)}
              aria-label="Output quality"
            />
            <p className="text-xs text-muted-foreground">
              Applies to JPG and WebP. PNG output is always lossless.
            </p>
          </div>
        </div>

        {plan ? (
          <p className="flex items-center gap-2 rounded-lg border bg-muted/25 px-3 py-2 font-mono text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0 text-info" />
            Result: {plan.width} × {plan.height} px
            {plan.crop ? " (cropped to fill)" : ""}
            {plan.scale < 1 ? ` · ${Math.round(plan.scale * 100)}% of the original` : ""}
          </p>
        ) : null}

        {upscaling && plan ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-warning-foreground dark:text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            These dimensions are larger than the original ({active?.sourceWidth} ×{" "}
            {active?.sourceHeight} px), so the image will be enlarged. Resizing can't add
            detail that wasn't captured.
          </p>
        ) : null}
      </ToolStep>

      <ToolStep
        step={3}
        title="Preview and download"
        description="Check the result before saving it."
        state={items.some((item) => item.status === "done") ? "active" : "todo"}
      >
        {progress ? (
          <ProgressIndicator
            value={
              progress.total > 0
                ? Math.round((progress.done / progress.total) * 100)
                : null
            }
            label="Resizing images"
            detail={`${progress.done} of ${progress.total} files processed`}
          />
        ) : null}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add an image to see the preview and download options.
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
              muted: true,
            }}
            after={{
              label: "Resized",
              url: active.afterUrl,
              bytes: active.output.blob.size,
              width: active.output.width,
              height: active.output.height,
              format: FORMAT_LABEL[active.output.format],
            }}
          />
        ) : null}

        {items.some((item) => item.output) ? (
          <div className="flex flex-wrap gap-2">
            {active?.output ? (
              <DownloadButton
                blob={active.output.blob}
                filename={suffixName(
                  active.file.name,
                  `${active.output.width}x${active.output.height}`,
                  active.output.format === "jpeg" ? "jpg" : active.output.format,
                )}
                label="Download this file"
                size={active.output.blob.size}
              />
            ) : null}
            {items.filter((item) => item.output).length > 1 ? (
              <DownloadAllButton
                files={items
                  .filter((item) => item.output)
                  .map((item) => ({
                    name: suffixName(
                      item.file.name,
                      `${item.output!.width}x${item.output!.height}`,
                      item.output!.format === "jpeg" ? "jpg" : item.output!.format,
                    ),
                    blob: item.output!.blob,
                  }))}
                zipName="submitready-resized-images.zip"
              />
            ) : null}
            <span
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs",
                active?.output
                  ? "border-success/40 bg-success/5 text-muted-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {active?.output
                ? `${formatBytes(active.file.size)} → ${formatBytes(active.output.blob.size)}`
                : "processing…"}
            </span>
          </div>
        ) : null}
        {busy ? (
          <p className="text-xs text-muted-foreground">
            Processing runs automatically whenever settings change.
          </p>
        ) : null}
      </ToolStep>
    </div>
  );
}
