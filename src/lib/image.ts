import { extensionOf, nextFrame } from "./format";

/* -------------------------------------------------------------------------- */
/*  Decoding                                                                   */
/* -------------------------------------------------------------------------- */

export interface DecodedImage {
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  dispose: () => void;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "sync";
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "This image couldn't be decoded. The file may be corrupted or in a format your browser can't open.",
        ),
      );
    img.src = src;
  });
}

/** Decodes any browser-supported image blob into a drawable source. */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> path for formats createImageBitmap rejects.
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImageElement(url);
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      dispose: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function getImageSize(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  const decoded = await decodeImage(blob);
  const size = { width: decoded.width, height: decoded.height };
  decoded.dispose();
  return size;
}

/* -------------------------------------------------------------------------- */
/*  Canvas helpers                                                             */
/* -------------------------------------------------------------------------- */

export function createCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    throw new Error(
      "Your browser blocked canvas drawing, so images can't be processed here.",
    );
  }
  return { canvas, ctx };
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const done = (blob: Blob | null) => {
      if (blob) resolve(blob);
      else
        reject(
          new Error(
            `Your browser could not create a ${mime.replace("image/", "").toUpperCase()} file.`,
          ),
        );
    };
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob(done, mime, quality);
      return;
    }
    try {
      const dataUrl = canvas.toDataURL(mime, quality);
      const [meta, data] = dataUrl.split(",");
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const type = /:(.*?);/.exec(meta)?.[1] ?? mime;
      done(new Blob([bytes], { type }));
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/* -------------------------------------------------------------------------- */
/*  Format resolution                                                          */
/* -------------------------------------------------------------------------- */

export type OutputFormat = "jpeg" | "png" | "webp" | "original";
export type ResolvedFormat = "jpeg" | "png" | "webp";

export const FORMAT_MIME: Record<ResolvedFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const FORMAT_EXTENSION: Record<ResolvedFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

export const FORMAT_LABEL: Record<ResolvedFormat, string> = {
  jpeg: "JPG",
  png: "PNG",
  webp: "WebP",
};

export function resolveFormat(
  file: File | Blob,
  requested: OutputFormat = "original",
): ResolvedFormat {
  if (requested !== "original") return requested;
  const type = file.type.toLowerCase();
  const name = "name" in file ? (file as File).name : "";
  const ext = extensionOf(name);
  if (type === "image/png" || ext === "png") return "png";
  if (type === "image/webp" || ext === "webp") return "webp";
  return "jpeg";
}

/* -------------------------------------------------------------------------- */
/*  Geometry                                                                   */
/* -------------------------------------------------------------------------- */

export function fitWithin(
  width: number,
  height: number,
  maxWidth?: number | null,
  maxHeight?: number | null,
): { width: number; height: number } {
  let ratio = 1;
  if (maxWidth && width > maxWidth) ratio = Math.min(ratio, maxWidth / width);
  if (maxHeight && height > maxHeight)
    ratio = Math.min(ratio, maxHeight / height);
  if (ratio >= 1) return { width: Math.round(width), height: Math.round(height) };
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Scales down so the longest edge is at most `max` pixels. */
export function fitLongestEdge(
  width: number,
  height: number,
  max?: number | null,
): { width: number; height: number } {
  if (!max) return { width, height };
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  return fitWithin(width, height, max, max);
}

export interface DrawOptions {
  targetWidth: number;
  targetHeight: number;
  /** Cover-crop the source to the target aspect ratio before scaling. */
  crop?: boolean;
  background?: string | null;
  smoothing?: boolean;
}

export function drawImageToCanvas(
  decoded: DecodedImage,
  options: DrawOptions,
): HTMLCanvasElement {
  const { targetWidth, targetHeight, crop = false } = options;
  const { canvas, ctx } = createCanvas(targetWidth, targetHeight);
  ctx.imageSmoothingEnabled = options.smoothing !== false;
  ctx.imageSmoothingQuality = "high";

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  let sx = 0;
  let sy = 0;
  let sw = decoded.width;
  let sh = decoded.height;

  if (crop) {
    const sourceAspect = decoded.width / decoded.height;
    const targetAspect = targetWidth / targetHeight;
    if (sourceAspect > targetAspect) {
      sw = Math.round(decoded.height * targetAspect);
      sx = Math.round((decoded.width - sw) / 2);
    } else if (sourceAspect < targetAspect) {
      sh = Math.round(decoded.width / targetAspect);
      sy = Math.round((decoded.height - sh) / 2);
    }
  }

  ctx.drawImage(
    decoded.source,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

/* -------------------------------------------------------------------------- */
/*  Compression                                                                */
/* -------------------------------------------------------------------------- */

export interface CompressOptions {
  format?: OutputFormat;
  /** Starting quality for lossy formats (0.1 – 1). Ignored for PNG. */
  quality?: number;
  targetBytes?: number | null;
  maxWidth?: number | null;
  maxHeight?: number | null;
  maxDimension?: number | null;
}

export interface ImageOutput {
  blob: Blob;
  width: number;
  height: number;
  format: ResolvedFormat;
  quality: number;
  /** Scale relative to the source (1 = original dimensions). */
  scale: number;
  originalBytes: number;
  outputBytes: number;
  metTarget: boolean;
  targetBytes: number | null;
  /** True when the source had transparency that the output format cannot keep. */
  flattened: boolean;
  notes: string[];
}

const QUALITY_FLOOR = 0.35;
const QUALITY_CEILING = 0.92;
const SCALE_STEPS = [1, 0.85, 0.72, 0.6, 0.5, 0.4, 0.32, 0.25];

async function searchQuality(
  encode: (quality: number) => Promise<Blob>,
  targetBytes: number,
  high: number,
  low: number = QUALITY_FLOOR,
): Promise<{ blob: Blob; quality: number } | null> {
  let best: { blob: Blob; quality: number } | null = null;
  let lowBound = low;
  let highBound = high;

  for (let i = 0; i < 6 && highBound - lowBound > 0.03; i += 1) {
    const mid = (lowBound + highBound) / 2;
    const blob = await encode(mid);
    await nextFrame();
    if (blob.size <= targetBytes) {
      best = { blob, quality: mid };
      lowBound = mid;
    } else {
      highBound = mid;
    }
  }

  if (!best) {
    const blob = await encode(highBound);
    if (blob.size <= targetBytes) best = { blob, quality: highBound };
  }
  return best;
}

/**
 * Compresses an image in the browser. When `targetBytes` is set the encoder
 * searches quality levels and, if necessary, dimensions until the output fits —
 * and reports honestly when an exact target is not reachable.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<ImageOutput> {
  const format = resolveFormat(file, options.format ?? "original");
  const mime = FORMAT_MIME[format];
  const notes: string[] = [];
  const targetBytes = options.targetBytes ?? null;

  const decoded = await decodeImage(file);
  try {
    const constrained = fitWithin(
      decoded.width,
      decoded.height,
      options.maxWidth,
      options.maxHeight,
    );
    const base = fitLongestEdge(
      constrained.width,
      constrained.height,
      options.maxDimension,
    );

    const opaque = format === "jpeg";
    const quality = Math.min(
      QUALITY_CEILING,
      Math.max(0.1, options.quality ?? 0.82),
    );

    const renderAt = (scale: number): HTMLCanvasElement =>
      drawImageToCanvas(decoded, {
        targetWidth: Math.max(1, Math.round(base.width * scale)),
        targetHeight: Math.max(1, Math.round(base.height * scale)),
        background: opaque ? "#ffffff" : null,
      });

    if (!targetBytes) {
      const canvas = renderAt(1);
      const blob = await canvasToBlob(canvas, mime, quality);
      return {
        blob,
        width: canvas.width,
        height: canvas.height,
        format,
        quality,
        scale: 1,
        originalBytes: file.size,
        outputBytes: blob.size,
        metTarget: true,
        targetBytes: null,
        flattened: opaque,
        notes,
      };
    }

    let best: { blob: Blob; quality: number; scale: number } | null = null;

    for (const scale of SCALE_STEPS) {
      const canvas = renderAt(scale);
      if (canvas.width < 24 || canvas.height < 24) break;

      const encode = (q: number) => canvasToBlob(canvas, mime, q);

      // PNG ignores the quality argument, so the only lever is pixel scale.
      if (format === "png") {
        const blob = await encode(1);
        await nextFrame();
        if (!best || blob.size < best.blob.size)
          best = { blob, quality: 1, scale };
        if (blob.size <= targetBytes) break;
        continue;
      }

      // Cheap probe at the quality floor: skip this scale if even that is too big.
      const probe = await encode(QUALITY_FLOOR);
      await nextFrame();
      if (!best || probe.size < best.blob.size)
        best = { blob: probe, quality: QUALITY_FLOOR, scale };
      if (probe.size > targetBytes) continue;

      const found = await searchQuality(encode, targetBytes, quality);
      if (found) {
        best = { blob: found.blob, quality: found.quality, scale };
        break;
      }
    }

    if (!best) {
      throw new Error("The image could not be re-encoded in this browser.");
    }

    const metTarget = best.blob.size <= targetBytes;
    if (!metTarget) {
      notes.push(
        "Even at the lowest quality this image stays above your target size. The smallest possible version was kept.",
      );
    }
    if (format === "png" && metTarget && best.scale < 1) {
      notes.push(
        "PNG keeps lossless pixels, so the image was resized rather than re-compressed to reach the target.",
      );
    }

    const finalCanvas = renderAt(best.scale);
    return {
      blob: best.blob,
      width: finalCanvas.width,
      height: finalCanvas.height,
      format,
      quality: best.quality,
      scale: best.scale,
      originalBytes: file.size,
      outputBytes: best.blob.size,
      metTarget,
      targetBytes,
      flattened: opaque,
      notes,
    };
  } finally {
    decoded.dispose();
  }
}

/* -------------------------------------------------------------------------- */
/*  Resize                                                                     */
/* -------------------------------------------------------------------------- */

export type ResizeMode = "exact" | "percent" | "longest-edge";

export interface ResizeOptions {
  mode: ResizeMode;
  width?: number;
  height?: number;
  percent?: number;
  longestEdge?: number;
  keepAspectRatio?: boolean;
  /** Cover-crop to the exact target box instead of fitting inside it. */
  crop?: boolean;
  format?: OutputFormat;
  quality?: number;
  background?: string | null;
}

export interface ResizePlan {
  width: number;
  height: number;
  scale: number;
  crop: boolean;
}

/** Pure preview of what a resize will produce, used for live UI feedback. */
export function planResize(
  source: { width: number; height: number },
  options: ResizeOptions,
): ResizePlan {
  const { width: sw, height: sh } = source;
  if (options.mode === "percent") {
    const percent = options.percent ?? 100;
    const scale = Math.max(1, percent) / 100;
    return {
      width: Math.max(1, Math.round(sw * scale)),
      height: Math.max(1, Math.round(sh * scale)),
      scale,
      crop: false,
    };
  }

  if (options.mode === "longest-edge") {
    const target = options.longestEdge ?? Math.max(sw, sh);
    const scale = Math.min(1, target / Math.max(sw, sh));
    return {
      width: Math.max(1, Math.round(sw * scale)),
      height: Math.max(1, Math.round(sh * scale)),
      scale,
      crop: false,
    };
  }

  const tw = Math.max(1, Math.round(options.width ?? sw));
  const th = Math.max(1, Math.round(options.height ?? sh));
  const keep = options.keepAspectRatio !== false;

  if (!keep) {
    return { width: tw, height: th, scale: tw / sw, crop: false };
  }
  if (options.crop) {
    return { width: tw, height: th, scale: Math.max(tw / sw, th / sh), crop: true };
  }
  const scale = Math.min(tw / sw, th / sh);
  return {
    width: Math.max(1, Math.round(sw * scale)),
    height: Math.max(1, Math.round(sh * scale)),
    scale,
    crop: false,
  };
}

export async function resizeImage(
  file: File,
  options: ResizeOptions,
): Promise<ImageOutput> {
  const format = resolveFormat(file, options.format ?? "original");
  const mime = FORMAT_MIME[format];
  const decoded = await decodeImage(file);
  try {
    const plan = planResize(decoded, options);
    const canvas = drawImageToCanvas(decoded, {
      targetWidth: plan.width,
      targetHeight: plan.height,
      crop: plan.crop,
      background: options.background ?? null,
    });
    const blob = await canvasToBlob(
      canvas,
      mime,
      Math.min(QUALITY_CEILING, Math.max(0.1, options.quality ?? 0.92)),
    );
    return {
      blob,
      width: canvas.width,
      height: canvas.height,
      format,
      quality: options.quality ?? 0.92,
      scale: plan.scale,
      originalBytes: file.size,
      outputBytes: blob.size,
      metTarget: true,
      targetBytes: null,
      flattened: format === "jpeg",
      notes: [],
    };
  } finally {
    decoded.dispose();
  }
}

/* -------------------------------------------------------------------------- */
/*  Previews                                                                   */
/* -------------------------------------------------------------------------- */

export async function createPreviewDataUrl(
  source: Blob,
  maxEdge = 320,
): Promise<string | null> {
  try {
    const decoded = await decodeImage(source);
    try {
      const { width, height } = fitLongestEdge(
        decoded.width,
        decoded.height,
        maxEdge,
      );
      const canvas = drawImageToCanvas(decoded, {
        targetWidth: width,
        targetHeight: height,
        background: null,
      });
      return canvas.toDataURL("image/jpeg", 0.72);
    } finally {
      decoded.dispose();
    }
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Images → PDF preparation                                                   */
/* -------------------------------------------------------------------------- */

export interface PreparedPdfImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  embedType: "jpg" | "png";
  name: string;
}

export interface PrepareImageOptions {
  /** JPEG quality for photographic content (0.3 – 1). */
  quality?: number;
  /** Longest edge cap in pixels. Keeps page counts and memory sane. */
  maxDimension?: number;
  /** Keep transparency by embedding PNG (larger files). */
  keepTransparency?: boolean;
}

export async function prepareImageForPdf(
  file: File,
  options: PrepareImageOptions = {},
): Promise<PreparedPdfImage> {
  const keepTransparency = options.keepTransparency ?? false;
  const decoded = await decodeImage(file);
  try {
    const { width, height } = fitLongestEdge(
      decoded.width,
      decoded.height,
      options.maxDimension ?? 2400,
    );
    const canvas = drawImageToCanvas(decoded, {
      targetWidth: width,
      targetHeight: height,
      background: keepTransparency ? null : "#ffffff",
    });
    const mime = keepTransparency ? "image/png" : "image/jpeg";
    const blob = await canvasToBlob(
      canvas,
      mime,
      Math.min(0.95, Math.max(0.3, options.quality ?? 0.85)),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return {
      bytes,
      width: canvas.width,
      height: canvas.height,
      embedType: keepTransparency ? "png" : "jpg",
      name: file.name,
    };
  } finally {
    decoded.dispose();
  }
}
