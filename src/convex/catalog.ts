/**
 * Seed data for the SubmitReady catalog. Kept in one place so the admin console,
 * the first-run bootstrap and the marketing pages agree with each other.
 */

export interface SeedTool {
  slug: string;
  name: string;
  tagline: string;
  accepts: string;
  badge: string;
  order: number;
}

export const SEED_TOOLS: SeedTool[] = [
  {
    slug: "image-compress",
    name: "Image Compressor",
    tagline: "Hit an exact file size for photos and signatures, in batches.",
    accepts: "JPG · PNG · WebP",
    badge: "exact target",
    order: 1,
  },
  {
    slug: "image-resize",
    name: "Image Resizer",
    tagline: "Exact pixels, percentages or crop-to-fit, with photo presets.",
    accepts: "JPG · PNG · WebP",
    badge: "pixel exact",
    order: 2,
  },
  {
    slug: "images-to-pdf",
    name: "Images to PDF",
    tagline: "Turn photos and scans into one ordered multi-page PDF.",
    accepts: "JPG · PNG · WebP",
    badge: "multi-page",
    order: 3,
  },
  {
    slug: "pdf-compress",
    name: "PDF Compressor",
    tagline: "Lossless rebuild first, then page-level re-encoding to a budget.",
    accepts: "PDF",
    badge: "target presets",
    order: 4,
  },
  {
    slug: "pdf-merge",
    name: "Merge PDF",
    tagline: "Concatenate certificates, mark sheets and IDs in a set order.",
    accepts: "PDF",
    badge: "lossless",
    order: 5,
  },
  {
    slug: "pdf-split",
    name: "Split PDF",
    tagline: "Preview every page, then export the pages that matter.",
    accepts: "PDF",
    badge: "page picker",
    order: 6,
  },
  {
    slug: "application-pack",
    name: "Application Pack",
    tagline: "Validate a whole application against its upload rules.",
    accepts: "Photos · Signatures · PDFs",
    badge: "flagship",
    order: 7,
  },
];

export interface SeedPreset {
  name: string;
  description: string;
  slotId: string;
  extensions: string[];
  minBytes?: number;
  maxBytes?: number;
  exactWidth?: number;
  exactHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxPages?: number;
}

const KB = 1024;
const MB = 1024 * 1024;

/** Global defaults every visitor gets until an admin edits them. */
export const SEED_PRESETS: SeedPreset[] = [
  {
    name: "Application photograph",
    description:
      "The default photo slot: JPG or PNG, 10 KB minimum, 200 KB maximum, 350 × 350 px recommended.",
    slotId: "photograph",
    extensions: ["jpg", "jpeg", "png"],
    minBytes: 10 * KB,
    maxBytes: 200 * KB,
    maxWidth: 2000,
    maxHeight: 2000,
  },
  {
    name: "Scanned signature",
    description:
      "Signature on plain paper: 5 KB minimum, 100 KB maximum, 140 × 60 px recommended.",
    slotId: "signature",
    extensions: ["jpg", "jpeg", "png"],
    minBytes: 5 * KB,
    maxBytes: 100 * KB,
    maxWidth: 1200,
    maxHeight: 600,
  },
  {
    name: "Resume or CV",
    description: "Single PDF, up to 3 pages, under 1 MB.",
    slotId: "resume",
    extensions: ["pdf"],
    maxBytes: 1 * MB,
    maxPages: 3,
  },
  {
    name: "Identity proof",
    description:
      "Aadhaar, PAN, passport or driving licence, front and back in one file, under 2 MB.",
    slotId: "id-proof",
    extensions: ["pdf", "jpg", "jpeg", "png"],
    maxBytes: 2 * MB,
    maxPages: 2,
  },
  {
    name: "Certificate",
    description: "Degree, marks or experience certificate as a PDF under 2 MB.",
    slotId: "certificate",
    extensions: ["pdf"],
    maxBytes: 2 * MB,
    maxPages: 4,
  },
  {
    name: "Mark sheet",
    description: "Consolidated mark sheet or transcript, PDF under 2 MB.",
    slotId: "mark-sheet",
    extensions: ["pdf"],
    maxBytes: 2 * MB,
    maxPages: 4,
  },
  {
    name: "Other document",
    description: "Anything else the form asks for, under 2 MB.",
    slotId: "other",
    extensions: ["pdf", "jpg", "jpeg", "png"],
    maxBytes: 2 * MB,
  },
];

export const SITE_SETTINGS_KEY = "site";
