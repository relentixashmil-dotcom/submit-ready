import { PDFDocument } from "pdf-lib";
import { loadPdf, resavePdf } from "./pdf";
import {
  canvasToJpegBytes,
  closePdf,
  openPdfForRendering,
  renderPageToCanvas,
} from "./pdf-render";
import { nextFrame } from "./format";

export type CompressionLevel = "light" | "balanced" | "strong" | "extreme";

export interface CompressionProfile {
  label: string;
  summary: string;
  /** Rendering resolution; 0 means the lossless (structure-only) pass. */
  dpi: number;
  quality: number;
  rasterize: boolean;
}

export const COMPRESSION_LEVELS: Record<CompressionLevel, CompressionProfile> = {
  light: {
    label: "Light",
    summary:
      "Rebuilds the file structure only. Text stays selectable, quality is untouched.",
    dpi: 0,
    quality: 1,
    rasterize: false,
  },
  balanced: {
    label: "Balanced",
    summary:
      "Re-encodes pages as high-quality images. Good for scans and photo-heavy PDFs.",
    dpi: 150,
    quality: 0.68,
    rasterize: true,
  },
  strong: {
    label: "Strong",
    summary:
      "Noticeably smaller files for scanned documents. Small print is still readable.",
    dpi: 120,
    quality: 0.5,
    rasterize: true,
  },
  extreme: {
    label: "Extreme",
    summary:
      "Smallest possible output for size-limited uploads. Check readability after.",
    dpi: 96,
    quality: 0.38,
    rasterize: true,
  },
};

export interface CompressProgress {
  stage: string;
  page: number;
  totalPages: number;
  percent: number;
}

export interface CompressPdfOptions {
  level: CompressionLevel;
  targetBytes?: number | null;
  signal?: AbortSignal;
  onProgress?: (progress: CompressProgress) => void;
}

export interface CompressPdfResult {
  bytes: Uint8Array;
  originalBytes: number;
  finalBytes: number;
  originalPages: number;
  metTarget: boolean;
  targetBytes: number | null;
  rasterized: boolean;
  dpi: number;
  quality: number;
  /** True when the final result came from the lossless rebuild. */
  lossless: boolean;
  notes: string[];
}

const MIN_QUALITY = 0.28;
const DPI_FLOOR = 60;

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error("Compression cancelled.");
    error.name = "AbortError";
    throw error;
  }
}

async function resave(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const out = await resavePdf(bytes);
    return out.byteLength > 0 && out.byteLength < bytes.byteLength ? out : bytes;
  } catch {
    return bytes;
  }
}

interface Candidate {
  dpi: number;
  quality: number;
}

function rasterCandidates(profile: CompressionProfile): Candidate[] {
  const steps: Candidate[] = [{ dpi: profile.dpi, quality: profile.quality }];
  let dpi = profile.dpi;
  let quality = profile.quality;
  while (dpi > DPI_FLOOR && steps.length < 5) {
    dpi = Math.max(DPI_FLOOR, Math.round(dpi * 0.8));
    quality = Math.max(MIN_QUALITY, quality * 0.82);
    steps.push({ dpi, quality });
  }
  return steps;
}

/**
 * Rebuilds a PDF with every page re-encoded as a JPEG at the given resolution
 * and a per-page byte budget, so a whole document lands near the target size.
 */
async function rasterizeDocument(
  originalBytes: Uint8Array,
  candidates: Candidate[],
  targetBytes: number | null,
  onProgress: (progress: CompressProgress) => void,
  signal?: AbortSignal,
): Promise<{
  bytes: Uint8Array;
  pages: number;
  dpi: number;
  quality: number;
} | null> {
  const pdf = await openPdfForRendering(originalBytes);
  try {
    const total = pdf.numPages;

    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      const candidate = candidates[candidateIndex];
      const budgetPerPage = targetBytes
        ? (targetBytes * 0.94) / total
        : Number.POSITIVE_INFINITY;

      const out = await PDFDocument.create();
      out.setProducer("SubmitReady");
      out.setCreator("SubmitReady — browser document toolkit");

      let qualityUsed = candidate.quality;

      for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
        abortIfNeeded(signal);
        onProgress({
          stage: "Re-encoding pages",
          page: pageNumber,
          totalPages: total,
          percent: Math.round(
            ((candidateIndex * total + (pageNumber - 1)) /
              (total * candidates.length)) *
              100,
          ),
        });

        const rendered = await renderPageToCanvas(
          pdf,
          pageNumber,
          candidate.dpi / 72,
        );
        const encode = (quality: number) =>
          canvasToJpegBytes(rendered.canvas, quality);

        let bytes = await encode(candidate.quality);
        let usedQuality = candidate.quality;

        if (Number.isFinite(budgetPerPage)) {
          if (bytes.byteLength > budgetPerPage) {
            // Walk quality down until the page fits its budget.
            let low = MIN_QUALITY;
            let high = candidate.quality;
            let best: { bytes: Uint8Array; quality: number } | null = null;
            for (let i = 0; i < 5 && high - low > 0.02; i += 1) {
              const mid = (low + high) / 2;
              const attempt = await encode(mid);
              if (attempt.byteLength <= budgetPerPage) {
                best = { bytes: attempt, quality: mid };
                low = mid;
              } else {
                high = mid;
              }
            }
            if (best) {
              bytes = best.bytes;
              usedQuality = best.quality;
            } else {
              bytes = await encode(MIN_QUALITY);
              usedQuality = MIN_QUALITY;
            }
          } else {
            // Room to spare: spend it on quality for this page.
            const ceiling = Math.min(0.92, candidate.quality + 0.2);
            if (ceiling > candidate.quality) {
              const attempt = await encode(ceiling);
              if (attempt.byteLength <= budgetPerPage) {
                bytes = attempt;
                usedQuality = ceiling;
              }
            }
          }
        }

        qualityUsed = Math.min(qualityUsed, usedQuality);

        const image = await out.embedJpg(bytes);
        const page = out.addPage([rendered.baseWidth, rendered.baseHeight]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: rendered.baseWidth,
          height: rendered.baseHeight,
        });

        rendered.canvas.width = 0;
        rendered.canvas.height = 0;
        await nextFrame();
      }

      const saved = await out.save({ useObjectStreams: true });
      const meetsTarget = targetBytes ? saved.byteLength <= targetBytes : true;
      const lastCandidate = candidateIndex === candidates.length - 1;

      if (meetsTarget || lastCandidate) {
        return {
          bytes: saved,
          pages: total,
          dpi: candidate.dpi,
          quality: qualityUsed,
        };
      }
    }
    return null;
  } finally {
    await closePdf(pdf);
  }
}

/**
 * Compresses a PDF entirely in the browser.
 *
 * The lossless rebuild always runs first. If that alone meets the target we
 * stop there. Otherwise pages are re-encoded as JPEGs, shrinking quality and
 * resolution page by page until the document fits — or until nothing more can
 * be saved, which is reported honestly instead of pretending to hit the target.
 */
export async function compressPdf(
  originalBytes: Uint8Array,
  options: CompressPdfOptions,
): Promise<CompressPdfResult> {
  const profile = COMPRESSION_LEVELS[options.level];
  const targetBytes = options.targetBytes ?? null;
  const notes: string[] = [];
  const onProgress = options.onProgress ?? (() => undefined);
  const originalSize = originalBytes.byteLength;

  abortIfNeeded(options.signal);
  onProgress({
    stage: "Rebuilding file structure",
    page: 0,
    totalPages: 0,
    percent: 0,
  });

  const rebuilt = await resave(originalBytes);
  const losslessResult = (bytes: Uint8Array, pageCount: number): CompressPdfResult => ({
    bytes,
    originalBytes: originalSize,
    finalBytes: bytes.byteLength,
    originalPages: pageCount,
    metTarget: targetBytes ? bytes.byteLength <= targetBytes : true,
    targetBytes,
    rasterized: false,
    dpi: 0,
    quality: 1,
    lossless: true,
    notes,
  });

  if (!profile.rasterize) {
    return losslessResult(rebuilt, 0);
  }

  if (targetBytes && rebuilt.byteLength <= targetBytes) {
    notes.push(
      "A lossless rebuild was already enough to meet your target, so no quality was given up.",
    );
    return losslessResult(rebuilt, 0);
  }

  onProgress({
    stage: "Preparing page rendering",
    page: 0,
    totalPages: 0,
    percent: 0,
  });

  let pageCount = 0;
  try {
    const info = await loadPdf(originalBytes);
    pageCount = info.doc.getPageCount();
  } catch {
    // pdf-lib only needs to report the page count here; pdf.js will re-report.
  }

  const rasterized = await rasterizeDocument(
    originalBytes,
    rasterCandidates(profile),
    targetBytes,
    onProgress,
    options.signal,
  );

  if (!rasterized) {
    notes.push(
      "Pages could not be re-encoded, so the lossless rebuild was kept instead.",
    );
    return losslessResult(rebuilt, pageCount);
  }

  notes.push(
    "Pages were re-rendered as images, so text is no longer selectable or searchable in the compressed file.",
  );

  const useLossless = rasterized.bytes.byteLength >= rebuilt.byteLength;
  const finalBytes = useLossless ? rebuilt : rasterized.bytes;
  if (useLossless) {
    notes.length = 0;
    notes.push(
      "Re-encoding pages would not have made this file smaller, so only the file structure was rebuilt.",
    );
  }

  onProgress({
    stage: "Done",
    page: pageCount,
    totalPages: pageCount,
    percent: 100,
  });

  const metTarget = targetBytes
    ? finalBytes.byteLength <= targetBytes
    : true;

  if (!metTarget) {
    notes.push(
      "This PDF is already heavily optimised, so the target size could not be reached. The smallest version this browser could produce is provided.",
    );
  }

  return {
    bytes: finalBytes,
    originalBytes: originalSize,
    finalBytes: finalBytes.byteLength,
    originalPages: rasterized.pages || pageCount,
    metTarget,
    targetBytes,
    rasterized: !useLossless,
    dpi: rasterized.dpi,
    quality: Math.round(rasterized.quality * 100) / 100,
    lossless: useLossless,
    notes,
  };
}
