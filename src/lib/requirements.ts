import { decodeImage } from "./image";
import { readPdfInfo } from "./pdf";
import { KB, MB, extensionOf, formatBytes, readAsArrayBuffer } from "./format";

/* -------------------------------------------------------------------------- */
/*  Requirement model                                                          */
/* -------------------------------------------------------------------------- */

export interface Requirement {
  /** Allowed file extensions, lower-case, without dots. Empty means "any". */
  extensions: string[];
  minBytes?: number;
  maxBytes?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  exactWidth?: number;
  exactHeight?: number;
  /** Advisory dimensions that produce a warning, never a failure. */
  recommendedWidth?: number;
  recommendedHeight?: number;
  maxPages?: number;
}

export type CheckStatus = "pass" | "warn" | "fail";

export interface ValidationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface ValidationResult {
  status: CheckStatus;
  checks: ValidationCheck[];
  failures: number;
  warnings: number;
}

export interface FileFacts {
  name: string;
  size: number;
  type: string;
  extension: string;
  kind: "image" | "pdf" | "other";
  width?: number;
  height?: number;
  pageCount?: number;
  /** Set when inspection failed, e.g. an unreadable or protected file. */
  inspectionError?: string;
}

export const UNKNOWN_PDF_PAGE_COUNT = -1;

/* -------------------------------------------------------------------------- */
/*  Inspection                                                                 */
/* -------------------------------------------------------------------------- */

export async function inspectFile(file: File): Promise<FileFacts> {
  const extension = extensionOf(file.name);
  const facts: FileFacts = {
    name: file.name,
    size: file.size,
    type: file.type,
    extension,
    kind: "other",
  };

  if (file.type === "application/pdf" || extension === "pdf") {
    facts.kind = "pdf";
    try {
      const buffer = await readAsArrayBuffer(file);
      const info = await readPdfInfo(new Uint8Array(buffer));
      facts.pageCount = info.pageCount;
    } catch (error) {
      facts.pageCount = UNKNOWN_PDF_PAGE_COUNT;
      facts.inspectionError =
        error instanceof Error
          ? error.message
          : "This PDF could not be read. It may be corrupted.";
    }
    return facts;
  }

  if (file.type.startsWith("image/") || /^(jpg|jpeg|png|webp|gif|bmp)$/.test(extension)) {
    facts.kind = "image";
    try {
      const decoded = await decodeImage(file);
      facts.width = decoded.width;
      facts.height = decoded.height;
      decoded.dispose();
    } catch (error) {
      facts.inspectionError =
        error instanceof Error
          ? error.message
          : "This image could not be decoded. It may be corrupted.";
    }
    return facts;
  }

  return facts;
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                 */
/* -------------------------------------------------------------------------- */

function extensionList(extensions: string[]): string {
  return extensions
    .map((ext) =>
      ext === "jpg" || ext === "jpeg" ? "JPG" : ext.toUpperCase(),
    )
    .join(" / ");
}

export function validateAgainstRequirement(
  requirement: Requirement,
  facts: FileFacts,
): ValidationResult {
  const checks: ValidationCheck[] = [];

  /* File type ------------------------------------------------------------- */
  if (requirement.extensions.length > 0) {
    const allowed = requirement.extensions.includes(facts.extension);
    const isJpegAlias =
      !allowed &&
      (facts.extension === "jpg" || facts.extension === "jpeg") &&
      (requirement.extensions.includes("jpg") ||
        requirement.extensions.includes("jpeg"));
    if (allowed || isJpegAlias) {
      checks.push({
        id: "type",
        label: "File type",
        status: "pass",
        detail: `${facts.extension.toUpperCase()} is accepted.`,
      });
    } else {
      const target = requirement.extensions.includes("pdf") ? "PDF" : extensionList(requirement.extensions);
      checks.push({
        id: "type",
        label: "File type",
        status: "fail",
        detail: `.${facts.extension || "unknown"} isn't accepted here — this requirement asks for ${extensionList(
          requirement.extensions,
        )}. Convert this file to ${target}.`,
      });
    }
  }

  /* Size ------------------------------------------------------------------ */
  if (requirement.maxBytes !== undefined) {
    if (facts.size <= requirement.maxBytes) {
      checks.push({
        id: "maxSize",
        label: "Maximum size",
        status: "pass",
        detail: `${formatBytes(facts.size)} — inside the ${formatBytes(
          requirement.maxBytes,
        )} limit.`,
      });
    } else {
      checks.push({
        id: "maxSize",
        label: "Maximum size",
        status: "fail",
        detail: `${formatBytes(facts.size)} is ${formatBytes(
          facts.size - requirement.maxBytes,
        )} above the ${formatBytes(requirement.maxBytes)} limit. Compress this file.`,
      });
    }
  }

  if (requirement.minBytes !== undefined) {
    if (facts.size >= requirement.minBytes) {
      checks.push({
        id: "minSize",
        label: "Minimum size",
        status: "pass",
        detail: `${formatBytes(facts.size)} — above the ${formatBytes(
          requirement.minBytes,
        )} minimum.`,
      });
    } else {
      checks.push({
        id: "minSize",
        label: "Minimum size",
        status: "fail",
        detail: `${formatBytes(facts.size)} is below the ${formatBytes(
          requirement.minBytes,
        )} minimum. This usually means the scan or photo is too low quality — upload a clearer one.`,
      });
    }
  }

  /* Pages ----------------------------------------------------------------- */
  if (requirement.maxPages !== undefined) {
    const pages = facts.pageCount;
    if (pages === undefined || pages === UNKNOWN_PDF_PAGE_COUNT) {
      checks.push({
        id: "pages",
        label: "Page count",
        status: "warn",
        detail:
          facts.inspectionError ??
          "The number of pages couldn't be read from this PDF.",
      });
    } else if (pages <= requirement.maxPages) {
      checks.push({
        id: "pages",
        label: "Page count",
        status: "pass",
        detail: `${pages} page${pages === 1 ? "" : "s"} — within the ${requirement.maxPages}-page limit.`,
      });
    } else {
      checks.push({
        id: "pages",
        label: "Page count",
        status: "fail",
        detail: `${pages} pages — this upload accepts at most ${requirement.maxPages}. Split the PDF and submit only the pages you need.`,
      });
    }
  }

  /* Dimensions ------------------------------------------------------------ */
  const hasDimensionRule =
    requirement.minWidth !== undefined ||
    requirement.maxWidth !== undefined ||
    requirement.minHeight !== undefined ||
    requirement.maxHeight !== undefined ||
    requirement.exactWidth !== undefined ||
    requirement.exactHeight !== undefined;

  if (hasDimensionRule) {
    const { width, height } = facts;
    if (width === undefined || height === undefined) {
      checks.push({
        id: "dimensions",
        label: "Dimensions",
        status: "warn",
        detail:
          facts.inspectionError ??
          "Dimensions can only be checked for image files.",
      });
    } else {
      const target = requirementLabelDimensions(requirement);
      const problems: string[] = [];
      if (requirement.exactWidth !== undefined && width !== requirement.exactWidth)
        problems.push(`width must be exactly ${requirement.exactWidth} px`);
      if (
        requirement.exactHeight !== undefined &&
        height !== requirement.exactHeight
      )
        problems.push(`height must be exactly ${requirement.exactHeight} px`);
      if (requirement.minWidth !== undefined && width < requirement.minWidth)
        problems.push(`width must be at least ${requirement.minWidth} px`);
      if (requirement.maxWidth !== undefined && width > requirement.maxWidth)
        problems.push(`width must be at most ${requirement.maxWidth} px`);
      if (requirement.minHeight !== undefined && height < requirement.minHeight)
        problems.push(`height must be at least ${requirement.minHeight} px`);
      if (requirement.maxHeight !== undefined && height > requirement.maxHeight)
        problems.push(`height must be at most ${requirement.maxHeight} px`);

      if (problems.length === 0) {
        checks.push({
          id: "dimensions",
          label: "Dimensions",
          status: "pass",
          detail: `${width} × ${height} px — meets the requirement.`,
        });
      } else {
        checks.push({
          id: "dimensions",
          label: "Dimensions",
          status: "fail",
          detail: `${width} × ${height} px — ${problems.join(", ")}. Resize to ${target}.`,
        });
      }
    }
  }

  if (
    requirement.recommendedWidth !== undefined &&
    requirement.recommendedHeight !== undefined
  ) {
    const { width, height } = facts;
    if (width !== undefined && height !== undefined) {
      const matches =
        width === requirement.recommendedWidth &&
        height === requirement.recommendedHeight;
      if (!matches) {
        checks.push({
          id: "recommended",
          label: "Recommended size",
          status: "warn",
          detail: `${width} × ${height} px. ${requirement.recommendedWidth} × ${requirement.recommendedHeight} px is the commonly requested size — resize if the form specifies it.`,
        });
      } else {
        checks.push({
          id: "recommended",
          label: "Recommended size",
          status: "pass",
          detail: `${width} × ${height} px — matches the usual ${requirement.recommendedWidth} × ${requirement.recommendedHeight} px requirement.`,
        });
      }
    }
  }

  if (facts.inspectionError && !checks.some((check) => check.status === "fail")) {
    checks.push({
      id: "readable",
      label: "File readable",
      status: "warn",
      detail: facts.inspectionError,
    });
  }

  const failures = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warn").length;
  const status: CheckStatus =
    failures > 0 ? "fail" : warnings > 0 ? "warn" : "pass";

  return { status, checks, failures, warnings };
}

export function requirementLabelDimensions(requirement: Requirement): string {
  if (requirement.exactWidth && requirement.exactHeight) {
    return `${requirement.exactWidth} × ${requirement.exactHeight} px`;
  }
  const parts: string[] = [];
  if (requirement.minWidth) parts.push(`width ≥ ${requirement.minWidth} px`);
  if (requirement.maxWidth) parts.push(`width ≤ ${requirement.maxWidth} px`);
  if (requirement.minHeight) parts.push(`height ≥ ${requirement.minHeight} px`);
  if (requirement.maxHeight) parts.push(`height ≤ ${requirement.maxHeight} px`);
  return parts.join(", ") || "the required size";
}

export function summarizeRequirement(requirement: Requirement): string {
  const parts: string[] = [];
  if (requirement.extensions.length > 0)
    parts.push(extensionList(requirement.extensions));
  if (requirement.maxBytes) parts.push(`under ${formatBytes(requirement.maxBytes)}`);
  if (requirement.minBytes) parts.push(`above ${formatBytes(requirement.minBytes)}`);
  const dims =
    requirement.exactWidth && requirement.exactHeight
      ? `${requirement.exactWidth} × ${requirement.exactHeight} px`
      : requirement.recommendedWidth && requirement.recommendedHeight
        ? `${requirement.recommendedWidth} × ${requirement.recommendedHeight} px recommended`
        : "";
  if (dims) parts.push(dims);
  if (requirement.maxPages) parts.push(`max ${requirement.maxPages} pages`);
  return parts.join(" · ") || "No restrictions set";
}

/* -------------------------------------------------------------------------- */
/*  Application pack slots                                                     */
/* -------------------------------------------------------------------------- */

export type SlotId =
  | "photograph"
  | "signature"
  | "resume"
  | "id-proof"
  | "certificate"
  | "mark-sheet"
  | "other";

export interface PackSlotDefinition {
  id: SlotId;
  label: string;
  hint: string;
  /** Common upload requirements people run into for this document type. */
  requirement: Requirement;
}

export const PACK_SLOTS: PackSlotDefinition[] = [
  {
    id: "photograph",
    label: "Photograph",
    hint: "Passport-style photo, usually 350 × 350 px and under 200 KB.",
    requirement: {
      extensions: ["jpg", "jpeg", "png"],
      minBytes: 10 * KB,
      maxBytes: 200 * KB,
      recommendedWidth: 350,
      recommendedHeight: 350,
      maxWidth: 2000,
      maxHeight: 2000,
    },
  },
  {
    id: "signature",
    label: "Signature",
    hint: "Scanned signature on white paper, often 140 × 60 px and under 100 KB.",
    requirement: {
      extensions: ["jpg", "jpeg", "png"],
      minBytes: 5 * KB,
      maxBytes: 100 * KB,
      recommendedWidth: 140,
      recommendedHeight: 60,
      maxWidth: 1200,
      maxHeight: 600,
    },
  },
  {
    id: "resume",
    label: "Resume / CV",
    hint: "Single-column PDF, usually 1–3 pages and under 1 MB.",
    requirement: {
      extensions: ["pdf"],
      maxBytes: 1 * MB,
      maxPages: 3,
    },
  },
  {
    id: "id-proof",
    label: "ID proof",
    hint: "Aadhaar, PAN, passport or driving licence — front and back in one PDF.",
    requirement: {
      extensions: ["pdf", "jpg", "jpeg", "png"],
      maxBytes: 2 * MB,
      maxPages: 2,
    },
  },
  {
    id: "certificate",
    label: "Certificate",
    hint: "Degree, marks or experience certificate, usually under 2 MB.",
    requirement: {
      extensions: ["pdf"],
      maxBytes: 2 * MB,
      maxPages: 4,
    },
  },
  {
    id: "mark-sheet",
    label: "Mark sheet",
    hint: "Consolidated mark sheet or transcript as a PDF under 2 MB.",
    requirement: {
      extensions: ["pdf"],
      maxBytes: 2 * MB,
      maxPages: 4,
    },
  },
  {
    id: "other",
    label: "Other document",
    hint: "Anything else the form asks for. Set your own limits.",
    requirement: {
      extensions: ["pdf", "jpg", "jpeg", "png"],
      maxBytes: 2 * MB,
    },
  },
];

export function slotById(id: SlotId): PackSlotDefinition {
  return PACK_SLOTS.find((slot) => slot.id === id) ?? PACK_SLOTS[PACK_SLOTS.length - 1];
}

/* -------------------------------------------------------------------------- */
/*  Suggested one-click fixes                                                  */
/* -------------------------------------------------------------------------- */

export type PackActionKind =
  | "compress-image"
  | "compress-pdf"
  | "resize"
  | "to-pdf"
  | "to-jpg"
  | "limit-pages";

export interface PackAction {
  kind: PackActionKind;
  label: string;
  /** Target size in bytes for compression actions. */
  targetBytes?: number;
  width?: number;
  height?: number;
  pages?: number;
  reason: string;
}

/** Turns failing checks into the smallest set of one-click fixes. */
export function suggestActions(
  requirement: Requirement,
  facts: FileFacts,
  validation: ValidationResult,
): PackAction[] {
  const actions: PackAction[] = [];
  const failing = new Set(
    validation.checks.filter((check) => check.status === "fail").map((c) => c.id),
  );

  const wantsPdf = requirement.extensions.includes("pdf");
  const wantsImage =
    requirement.extensions.includes("jpg") ||
    requirement.extensions.includes("jpeg") ||
    requirement.extensions.includes("png");

  if (failing.has("type") && facts.kind === "image") {
    if (wantsPdf) {
      actions.push({
        kind: "to-pdf",
        label: "Convert to PDF",
        reason: "This requirement only accepts PDF uploads.",
      });
    } else if (wantsImage && facts.extension !== "jpg" && facts.extension !== "jpeg") {
      actions.push({
        kind: "to-jpg",
        label: "Convert to JPG",
        reason: "Turn this image into a JPG file.",
      });
    }
  }

  if (failing.has("maxSize")) {
    if (facts.kind === "image") {
      actions.push({
        kind: "compress-image",
        label: `Compress to ${formatBytes(requirement.maxBytes ?? 200 * KB)}`,
        targetBytes: requirement.maxBytes,
        reason: "Shrink the file until it fits the size limit.",
      });
    } else if (facts.kind === "pdf") {
      actions.push({
        kind: "compress-pdf",
        label: `Compress PDF to ${formatBytes(requirement.maxBytes ?? 500 * KB)}`,
        targetBytes: requirement.maxBytes,
        reason: "Reduce the PDF until it fits the size limit.",
      });
    }
  }

  const needsResize =
    failing.has("dimensions") &&
    facts.kind === "image" &&
    (requirement.exactWidth !== undefined ||
      requirement.exactHeight !== undefined ||
      requirement.maxWidth !== undefined ||
      requirement.maxHeight !== undefined);

  if (needsResize) {
    const width =
      requirement.exactWidth ?? Math.min(facts.width ?? 350, requirement.maxWidth ?? 350);
    const height =
      requirement.exactHeight ??
      Math.min(facts.height ?? 350, requirement.maxHeight ?? 350);
    actions.push({
      kind: "resize",
      label: `Resize to ${width} × ${height} px`,
      width,
      height,
      reason: "Match the pixel dimensions the form asks for.",
    });
  }

  if (failing.has("pages") && facts.kind === "pdf" && requirement.maxPages) {
    actions.push({
      kind: "limit-pages",
      label: `Keep first ${requirement.maxPages} page${requirement.maxPages === 1 ? "" : "s"}`,
      pages: requirement.maxPages,
      reason: "Drop the pages beyond the limit.",
    });
  }

  return actions;
}
