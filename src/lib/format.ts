import JSZip from "jszip";

/* -------------------------------------------------------------------------- */
/*  Sizes                                                                      */
/* -------------------------------------------------------------------------- */

export const KB = 1024;
export const MB = 1024 * 1024;

/** Human readable byte size, e.g. "184 KB" (space-free style options available). */
export function formatBytes(bytes: number, fractionDigits = 0): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < KB) return `${Math.round(bytes)} B`;
  if (bytes < MB) {
    const kb = bytes / KB;
    return `${kb.toFixed(kb < 10 && fractionDigits > 0 ? fractionDigits : 0)} KB`;
  }
  const mb = bytes / MB;
    return `${mb.toFixed(mb < 10 && fractionDigits > 0 ? fractionDigits : 0)} MB`;
}

/** "50 KB" / "1.5 MB" / "184320 B" -> bytes, or null when unparseable. */
export function parseSizeToBytes(input: string): number | null {
  const match = /^\s*([\d.]+)\s*(b|kb|mb|gb)?\s*$/i.exec(input);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  switch ((match[2] ?? "kb").toLowerCase()) {
    case "b":
      return Math.round(value);
    case "kb":
      return Math.round(value * KB);
    case "mb":
      return Math.round(value * MB);
    case "gb":
      return Math.round(value * 1024 * MB);
    default:
      return null;
  }
}

export const SIZE_PRESETS: number[] = [
  50 * KB,
  100 * KB,
  200 * KB,
  300 * KB,
  500 * KB,
  1 * MB,
];

export const PDF_SIZE_PRESETS: number[] = [
  100 * KB,
  200 * KB,
  500 * KB,
  1 * MB,
  2 * MB,
];

export const MIN_TARGET_BYTES = 5 * KB;
export const MAX_TARGET_BYTES = 100 * MB;

/** Percentage reduction between two sizes, rounded, clamped at 0. */
export function reductionPercent(original: number, output: number): number {
  if (original <= 0) return 0;
  return Math.max(0, Math.round(((original - output) / original) * 100));
}

/* -------------------------------------------------------------------------- */
/*  Files                                                                      */
/* -------------------------------------------------------------------------- */

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function baseNameOf(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.replace(/[\\/:*?"<>|]+/g, "-").trim() || "file";
}

export function replaceExtension(name: string, extension: string): string {
  return `${baseNameOf(name)}.${extension.replace(/^\./, "")}`;
}

export function suffixName(
  name: string,
  suffix: string,
  extension?: string,
): string {
  const ext = extension ?? extensionOf(name);
  const base = baseNameOf(name);
  return ext ? `${base}-${suffix}.${ext}` : `${base}-${suffix}`;
}

export type FileKind = "image" | "pdf" | "other";

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];

export function isSupportedImage(file: File | { name: string; type: string }) {
  const ext = extensionOf(file.name);
  return file.type.startsWith("image/") || IMAGE_EXTENSIONS.includes(ext);
}

export function isPdfFile(file: File | { name: string; type: string }) {
  return file.type === "application/pdf" || extensionOf(file.name) === "pdf";
}

export function fileKindOf(file: File): FileKind {
  if (isPdfFile(file)) return "pdf";
  if (isSupportedImage(file)) return "image";
  return "other";
}

/** MIME type used when we re-encode pixels in the browser. */
export function mimeForExtension(ext: string): string {
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export function formatLabelForExt(ext: string): string {
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "JPG";
    case "png":
      return "PNG";
    case "webp":
      return "WebP";
    case "pdf":
      return "PDF";
    default:
      return ext.toUpperCase();
  }
}

export function readAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () =>
      reject(new Error("The file could not be read. It may be corrupted."));
    reader.readAsArrayBuffer(file);
  });
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error("The file could not be read. It may be corrupted."));
    reader.readAsDataURL(file);
  });
}

/* -------------------------------------------------------------------------- */
/*  Downloads                                                                  */
/* -------------------------------------------------------------------------- */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export interface NamedBlob {
  name: string;
  blob: Blob;
}

/** Convert Uint8Array output from pdf-lib into a Blob. */
export function bytesToBlob(bytes: Uint8Array, type = "application/pdf"): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
}

export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  type = "application/pdf",
) {
  downloadBlob(bytesToBlob(bytes, type), filename);
}

/** Downloads several files one after another, with a small gap for browsers. */
export async function downloadAllSequential(files: NamedBlob[]) {
  for (let i = 0; i < files.length; i += 1) {
    downloadBlob(files[i].blob, files[i].name);
    if (i < files.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }
  }
}

/** Bundles the given files into a single .zip and downloads it. */
export async function downloadAsZip(
  files: NamedBlob[],
  zipName: string,
): Promise<void> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const file of files) {
    let name = file.name;
    let counter = 2;
    while (used.has(name)) {
      const dot = file.name.lastIndexOf(".");
      name =
        dot > 0
          ? `${file.name.slice(0, dot)}-${counter}${file.name.slice(dot)}`
          : `${file.name}-${counter}`;
      counter += 1;
    }
    used.add(name);
    zip.file(name, file.blob);
  }
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  downloadBlob(blob, zipName);
}

/* -------------------------------------------------------------------------- */
/*  Misc                                                                       */
/* -------------------------------------------------------------------------- */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Turns any thrown value into a message that is useful to a human, without
 * ever leaking a raw stack trace into the interface.
 */
export function describeError(error: unknown, fallback: string): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (!raw) return fallback;
  const lower = raw.toLowerCase();

  if (lower.includes("password") || lower.includes("encrypt")) {
    return "This PDF is password protected, so it can't be processed in your browser. Remove the password and try again.";
  }
  if (lower.includes("invalid pdf") || lower.includes("invalidpdf")) {
    return "This file doesn't look like a valid PDF. It may be corrupted or only partially downloaded.";
  }
  if (lower.includes("out of memory") || lower.includes("allocation failed")) {
    return "This file is too large for your browser's memory. Try a smaller file, or close other tabs and retry.";
  }
  if (lower.includes("no pdf header") || lower.includes("could not find")) {
    return "This PDF couldn't be read — the file may be corrupted or in an unsupported format.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Something went wrong loading the processing engine. Check your connection and try again.";
  }
  return raw.length > 240 ? `${raw.slice(0, 237)}…` : raw;
}

/** Yields to the browser so long processing loops don't freeze the interface. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
