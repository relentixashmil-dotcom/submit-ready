import * as pdfjs from "pdfjs-dist";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist";
// Vite bundles the worker as an asset and hands back its URL.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { canvasToBlob } from "./image";

export type { PDFDocumentProxy, PDFPageProxy };

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
}

/** Fonts, CMaps and decoders shipped in /public/pdfjs so rendering matches desktop viewers. */
const ASSET_OPTIONS = {
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  iccUrl: "/pdfjs/iccs/",
  wasmUrl: "/pdfjs/wasm/",
};

/** Keeps the loading task so documents can be released after use. */
const loadingTasks = new WeakMap<PDFDocumentProxy, PDFDocumentLoadingTask>();

/** Opens a PDF for rendering. The input buffer is copied — pdf.js detaches it. */
export async function openPdfForRendering(
  bytes: Uint8Array,
  password?: string,
): Promise<PDFDocumentProxy> {
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    ...ASSET_OPTIONS,
    password,
  });
  try {
    const pdf = await task.promise;
    loadingTasks.set(pdf, task);
    return pdf;
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name: unknown }).name)
        : "";
    if (name === "PasswordException") {
      throw new Error(
        "This PDF is password protected. Remove the password, then try again.",
      );
    }
    if (name === "InvalidPDFException") {
      throw new Error(
        "This file isn't a valid PDF, or it was only partially downloaded.",
      );
    }
    throw error;
  }
}

/** Frees the worker resources held by a rendered document. */
export async function closePdf(pdf: PDFDocumentProxy): Promise<void> {
  const task = loadingTasks.get(pdf);
  loadingTasks.delete(pdf);
  if (!task) return;
  await task.destroy().catch(() => undefined);
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** Original page size in PDF points (rotation applied). */
  baseWidth: number;
  baseHeight: number;
}

/** Renders one page into a fresh canvas at the given scale (1 = 72 DPI). */
export async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
): Promise<RenderedPage> {
  const page = await pdf.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas drawing is unavailable in this browser.");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = page.render({ canvas, viewport });
  await renderTask.promise;

  const result: RenderedPage = {
    canvas,
    width: canvas.width,
    height: canvas.height,
    baseWidth: baseViewport.width,
    baseHeight: baseViewport.height,
  };
  page.cleanup();
  return result;
}

/** Renders a page as a JPEG data URL sized for a thumbnail strip. */
export async function renderPageThumbnail(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  targetWidth = 150,
  quality = 0.7,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.max(0.08, targetWidth / base.width);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas drawing is unavailable in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = page.render({ canvas, viewport });
  await renderTask.promise;
  page.cleanup();

  return {
    dataUrl: canvas.toDataURL("image/jpeg", quality),
    width: canvas.width,
    height: canvas.height,
  };
}

/** Re-encodes a rendered page as JPEG bytes for embedding into a new PDF. */
export async function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Uint8Array> {
  const blob = await canvasToBlob(canvas, "image/jpeg", quality);
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Renders one page and returns JPEG bytes plus the original page box.
 * Used by the PDF compressor when pages are re-encoded as images.
 */
export async function rasterizePage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  dpi: number,
  quality: number,
): Promise<{
  bytes: Uint8Array;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
}> {
  const scale = dpi / 72;
  const rendered = await renderPageToCanvas(pdf, pageNumber, scale);
  const bytes = await canvasToJpegBytes(rendered.canvas, quality);
  // Release the canvas backing store as soon as the bytes exist.
  rendered.canvas.width = 0;
  rendered.canvas.height = 0;
  return {
    bytes,
    width: rendered.width,
    height: rendered.height,
    pageWidth: rendered.baseWidth,
    pageHeight: rendered.baseHeight,
  };
}

/** Small helper used by tools that only need a page count without pdf-lib. */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  const pdf = await openPdfForRendering(bytes);
  try {
    return pdf.numPages;
  } finally {
    await closePdf(pdf);
  }
}
