import { EncryptedPDFError, PDFDocument } from "pdf-lib";
import type { PreparedPdfImage } from "./image";
import { baseNameOf, bytesToBlob } from "./format";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const MM_TO_PT = 2.8346456693;

export const PAGE_BOXES = {
  a4: { width: 595.28, height: 841.89, label: "A4 (210 × 297 mm)" },
  letter: { width: 612, height: 792, label: "Letter (8.5 × 11 in)" },
} as const;

export type PagePreset = "a4" | "letter" | "image";
export type Orientation = "portrait" | "landscape" | "auto";

/* -------------------------------------------------------------------------- */
/*  Loading                                                                    */
/* -------------------------------------------------------------------------- */

export interface LoadedPdf {
  doc: PDFDocument;
  /** True when the source was password protected and loaded with encryption ignored. */
  encrypted: boolean;
}

export async function loadPdf(bytes: Uint8Array): Promise<LoadedPdf> {
  const common = {
    updateMetadata: false,
    throwOnInvalidObject: false,
  } as const;
  try {
    const doc = await PDFDocument.load(bytes, common);
    return { doc, encrypted: false };
  } catch (error) {
    if (error instanceof EncryptedPDFError) {
      try {
        const doc = await PDFDocument.load(bytes, {
          ...common,
          ignoreEncryption: true,
        });
        return { doc, encrypted: true };
      } catch {
        throw new Error(
          "This PDF is password protected and can't be opened in your browser. Remove the password first.",
        );
      }
    }
    throw new Error(
      "This file could not be read as a PDF. It may be corrupted, or it may not really be a PDF file.",
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Reading page information                                                   */
/* -------------------------------------------------------------------------- */

export interface PdfPageInfo {
  width: number;
  height: number;
  rotation: number;
}

export interface PdfInfo {
  pageCount: number;
  pages: PdfPageInfo[];
  encrypted: boolean;
}

export async function readPdfInfo(bytes: Uint8Array): Promise<PdfInfo> {
  const { doc, encrypted } = await loadPdf(bytes);
  const pages = doc.getPages().map((page) => {
    const { width, height } = page.getSize();
    return {
      width: Math.round(width * 100) / 100,
      height: Math.round(height * 100) / 100,
      rotation: page.getRotation().angle,
    };
  });
  return { pageCount: pages.length, pages, encrypted };
}

/* -------------------------------------------------------------------------- */
/*  Images → PDF                                                               */
/* -------------------------------------------------------------------------- */

export interface ImagesToPdfOptions {
  pageSize: PagePreset;
  orientation: Orientation;
  /** Page margin in PDF points. */
  margin: number;
}

function resolveOrientation(
  orientation: Orientation,
  imageAspect: number,
): "portrait" | "landscape" {
  if (orientation !== "auto") return orientation;
  return imageAspect >= 1 ? "landscape" : "portrait";
}

function pageBoxFor(
  image: PreparedPdfImage,
  options: ImagesToPdfOptions,
): { width: number; height: number } {
  const imageAspect = image.width / image.height;

  if (options.pageSize === "image") {
    // Match the image exactly, assuming a 96 DPI screen pixel, then cap the
    // longest edge at A4 length so pages stay printable.
    let width = (image.width * 72) / 96;
    let height = (image.height * 72) / 96;
    const longest = Math.max(width, height);
    if (longest > PAGE_BOXES.a4.height) {
      const factor = PAGE_BOXES.a4.height / longest;
      width *= factor;
      height *= factor;
    }
    return { width, height };
  }

  const box = PAGE_BOXES[options.pageSize];
  const orientation = resolveOrientation(options.orientation, imageAspect);
  return orientation === "landscape"
    ? { width: box.height, height: box.width }
    : { width: box.width, height: box.height };
}

export interface ImagesToPdfResult {
  bytes: Uint8Array;
  pageCount: number;
  /** Page box used for the first page, for UI feedback. */
  pageSize: { width: number; height: number };
}

export async function imagesToPdf(
  images: PreparedPdfImage[],
  options: ImagesToPdfOptions,
): Promise<ImagesToPdfResult> {
  if (images.length === 0) throw new Error("Add at least one image first.");

  const pdf = await PDFDocument.create();
  pdf.setProducer("SubmitReady");
  pdf.setCreator("SubmitReady — browser document toolkit");

  let firstBox = { width: 0, height: 0 };

  for (const image of images) {
    const embedded =
      image.embedType === "png"
        ? await pdf.embedPng(image.bytes)
        : await pdf.embedJpg(image.bytes);

    const box = pageBoxFor(image, options);
    if (firstBox.width === 0) firstBox = box;

    const page = pdf.addPage([box.width, box.height]);
    const maxWidth = Math.max(1, box.width - options.margin * 2);
    const maxHeight = Math.max(1, box.height - options.margin * 2);
    const scale = Math.min(
      maxWidth / embedded.width,
      maxHeight / embedded.height,
    );
    const width = embedded.width * scale;
    const height = embedded.height * scale;

    page.drawImage(embedded, {
      x: (box.width - width) / 2,
      y: (box.height - height) / 2,
      width,
      height,
    });
  }

  const bytes = await pdf.save({ useObjectStreams: true });
  return { bytes, pageCount: pdf.getPageCount(), pageSize: firstBox };
}

/* -------------------------------------------------------------------------- */
/*  Merge                                                                      */
/* -------------------------------------------------------------------------- */

export interface MergeInput {
  name: string;
  bytes: Uint8Array;
}

export interface MergeResult {
  bytes: Uint8Array;
  pageCount: number;
  fileCount: number;
  encryptedFiles: string[];
}

export async function mergePdfs(inputs: MergeInput[]): Promise<MergeResult> {
  if (inputs.length === 0) throw new Error("Add at least two PDF files to merge.");

  const merged = await PDFDocument.create();
  merged.setProducer("SubmitReady");
  merged.setCreator("SubmitReady — browser document toolkit");

  const encryptedFiles: string[] = [];

  for (const input of inputs) {
    const { doc, encrypted } = await loadPdf(input.bytes);
    if (encrypted) encryptedFiles.push(input.name);
    const indices = doc.getPageIndices();
    const copied = await merged.copyPages(doc, indices);
    copied.forEach((page) => merged.addPage(page));
  }

  const bytes = await merged.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: merged.getPageCount(),
    fileCount: inputs.length,
    encryptedFiles,
  };
}

/* -------------------------------------------------------------------------- */
/*  Split / extract                                                            */
/* -------------------------------------------------------------------------- */

export interface SplitGroup {
  label: string;
  /** 1-based page numbers in output order. */
  pages: number[];
}

export interface SplitOutput {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

export async function splitPdf(
  bytes: Uint8Array,
  sourceName: string,
  groups: SplitGroup[],
): Promise<{ outputs: SplitOutput[]; encrypted: boolean }> {
  const { doc, encrypted } = await loadPdf(bytes);
  const total = doc.getPageCount();
  const base = baseNameOf(sourceName);
  const outputs: SplitOutput[] = [];

  for (const group of groups) {
    const indices = group.pages
      .map((page) => page - 1)
      .filter((index) => index >= 0 && index < total);
    if (indices.length === 0) continue;

    const part = await PDFDocument.create();
    part.setProducer("SubmitReady");
    const copied = await part.copyPages(doc, indices);
    copied.forEach((page) => part.addPage(page));
    outputs.push({
      name: `${base}-${group.label}.pdf`,
      bytes: await part.save({ useObjectStreams: true }),
      pageCount: copied.length,
    });
  }

  if (outputs.length === 0) {
    throw new Error("None of the selected pages exist in this PDF.");
  }
  return { outputs, encrypted };
}

/* -------------------------------------------------------------------------- */
/*  Light re-save compression                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Rebuilds a PDF with object streams. This is lossless: text stays selectable
 * and image streams are untouched. Gains vary by source PDF.
 */
export async function resavePdf(bytes: Uint8Array): Promise<Uint8Array> {
  const { doc } = await loadPdf(bytes);
  return doc.save({ useObjectStreams: true });
}

/* -------------------------------------------------------------------------- */
/*  Page range parsing                                                         */
/* -------------------------------------------------------------------------- */

export interface ParsedRanges {
  groups: SplitGroup[];
  errors: string[];
}

/**
 * Parses input like `1-3, 5, 8-10` (or `all`) into page groups.
 * Zero-based page indices are never exposed to the user.
 */
export function parsePageRanges(
  input: string,
  pageCount: number,
): ParsedRanges {
  const errors: string[] = [];
  const trimmed = input.trim();
  if (!trimmed) return { groups: [], errors: [] };

  if (/^(all|\*)$/i.test(trimmed)) {
    return {
      groups: [
        {
          label: `all-pages`,
          pages: Array.from({ length: pageCount }, (_, i) => i + 1),
        },
      ],
      errors,
    };
  }

  const groups: SplitGroup[] = [];

  for (const rawPart of trimmed.split(/[,\n;]+/)) {
    const part = rawPart.trim();
    if (!part) continue;

    const range = /^(\d+)\s*(?:-|–|to)\s*(\d+)$/.exec(part);
    if (range) {
      const start = Number.parseInt(range[1], 10);
      const end = Number.parseInt(range[2], 10);
      if (start > end) {
        errors.push(`"${part}" is reversed — write it as ${end}-${start}.`);
        continue;
      }
      if (start < 1 || end > pageCount) {
        errors.push(
          `"${part}" is outside this PDF, which has ${pageCount} page${pageCount === 1 ? "" : "s"}.`,
        );
        continue;
      }
      groups.push({
        label: `pages-${start}-${end}`,
        pages: Array.from({ length: end - start + 1 }, (_, i) => start + i),
      });
      continue;
    }

    const single = /^(\d+)$/.exec(part);
    if (single) {
      const page = Number.parseInt(single[1], 10);
      if (page < 1 || page > pageCount) {
        errors.push(`Page ${page} doesn't exist in this PDF.`);
        continue;
      }
      groups.push({ label: `page-${page}`, pages: [page] });
      continue;
    }

    errors.push(`"${part}" isn't a page or range. Use 1-3, 5 or 8-10.`);
  }

  return { groups, errors };
}

/** Normalises a selection of 1-based page numbers into one output group. */
export function selectionToGroup(pages: number[]): SplitGroup | null {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const label =
    sorted.length === 1
      ? `page-${sorted[0]}`
      : `pages-${sorted.slice(0, 6).join("-")}${sorted.length > 6 ? "-etc" : ""}`;
  return { label, pages: sorted };
}

export function pdfBlobFromBytes(bytes: Uint8Array): Blob {
  return bytesToBlob(bytes, "application/pdf");
}
