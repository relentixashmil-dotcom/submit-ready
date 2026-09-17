import { KB, MB } from "./format";
import type { CompressionLevel } from "./pdf-compress";

export type ToolKind =
  | "image-compress"
  | "image-resize"
  | "images-to-pdf"
  | "pdf-compress"
  | "pdf-merge"
  | "pdf-split"
  | "application-pack";

export interface ToolMeta {
  kind: ToolKind;
  path: string;
  name: string;
  /** One-line description used on cards and in navigation. */
  blurb: string;
  accepts: string;
  /** Short label for the quick-action rail. */
  shortName: string;
}

export const TOOLS: Record<ToolKind, ToolMeta> = {
  "image-compress": {
    kind: "image-compress",
    path: "/image-compressor",
    name: "Image Compressor",
    shortName: "Compress image",
    blurb:
      "Hit an exact file size for photos and signatures. Batch friendly, with honest results.",
    accepts: "JPG · PNG · WebP",
  },
  "image-resize": {
    kind: "image-resize",
    path: "/image-resizer",
    name: "Image Resizer",
    shortName: "Resize image",
    blurb:
      "Exact pixels, percentages or crop-to-fit — with application photo presets built in.",
    accepts: "JPG · PNG · WebP",
  },
  "images-to-pdf": {
    kind: "images-to-pdf",
    path: "/jpg-to-pdf",
    name: "Images to PDF",
    shortName: "JPG to PDF",
    blurb:
      "Turn photos and scans into one tidy multi-page PDF. Reorder, set margins, choose A4 or Letter.",
    accepts: "JPG · PNG · WebP",
  },
  "pdf-compress": {
    kind: "pdf-compress",
    path: "/pdf-compressor",
    name: "PDF Compressor",
    shortName: "Compress PDF",
    blurb:
      "Shrink scanned and image-heavy PDFs, with target-size presets and clear expectations.",
    accepts: "PDF",
  },
  "pdf-merge": {
    kind: "pdf-merge",
    path: "/merge-pdf",
    name: "Merge PDF",
    shortName: "Merge PDF",
    blurb:
      "Combine certificates, mark sheets and ID proofs into one upload-ready file.",
    accepts: "PDF",
  },
  "pdf-split": {
    kind: "pdf-split",
    path: "/split-pdf",
    name: "Split PDF",
    shortName: "Split PDF",
    blurb:
      "Preview every page, then export the pages you need — as one file or several.",
    accepts: "PDF",
  },
  "application-pack": {
    kind: "application-pack",
    path: "/application-pack",
    name: "Application Pack",
    shortName: "Application Pack",
    blurb:
      "Check a whole application against its upload rules and fix every file in one place.",
    accepts: "Photos · Signatures · PDFs",
  },
};

export const PRIMARY_TOOL_ORDER: ToolKind[] = [
  "image-compress",
  "image-resize",
  "images-to-pdf",
  "pdf-compress",
  "pdf-merge",
  "application-pack",
];

export interface FaqItem {
  q: string;
  a: string;
}

export interface SeoSection {
  heading: string;
  body: string[];
}

export interface SeoPage {
  slug: string;
  path: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  tool: ToolKind;
  preset?: {
    targetBytes?: number;
    width?: number;
    height?: number;
    compressLevel?: CompressionLevel;
  };
  badge: string;
  sections: SeoSection[];
  faqs: FaqItem[];
  related: string[];
}

export const SEO_PAGES: SeoPage[] = [
  {
    slug: "image-compressor",
    path: "/image-compressor",
    title: "Image Compressor — compress JPG, PNG and WebP to an exact size",
    description:
      "Compress JPG, PNG and WebP images to 50 KB, 100 KB, 200 KB or any custom size in your browser. Batch support, no uploads, real before/after sizes.",
    h1: "Compress images to the size the form asks for",
    lede:
      "Drop in a photo or a whole batch of scans, pick a target size, and see exactly what came out. Everything runs on your device — your files are never uploaded.",
    tool: "image-compress",
    badge: "Works offline after first load",
    sections: [
      {
        heading: "How target-size compression actually works",
        body: [
          "Most compressors only give you a quality slider and leave you guessing. SubmitReady works backwards from the number the upload form gave you: it reduces JPEG or WebP quality, and when quality alone isn't enough it steps the pixel dimensions down too. Each attempt is measured, so the result you download is verified against your target instead of estimated.",
          "When an exact target genuinely cannot be reached — a 4000 px photo squeezed to 20 KB, for example — you'll be told plainly and given the smallest version the browser could produce, still with its real output size.",
        ],
      },
      {
        heading: "What works well, and what to watch",
        body: [
          "JPG and WebP respond very well to compression and are the right choice for photographs and signatures. PNG is lossless: there is no quality dial, so reaching a small size usually means reducing dimensions, and the tool says so rather than silently degrading your file.",
          "Transparent PNGs are flattened onto white when you ask for JPG — which is what most government and exam portals expect for scanned documents.",
        ],
      },
    ],
    faqs: [
      {
        q: "Are my images uploaded anywhere?",
        a: "No. Compression runs in your browser using the canvas API. Nothing leaves your device, and the tool keeps working if your connection drops mid-session.",
      },
      {
        q: "Why is my PNG still large after compressing?",
        a: "PNG stores pixels losslessly, so a quality setting does nothing. SubmitReady reduces dimensions instead and tells you when it did — if you need a much smaller file, choose JPG output.",
      },
      {
        q: "Will my photo still look right after compression?",
        a: "Use the before/after preview and the output size readout. For photos, targets of 100–300 KB usually keep plenty of detail. Signatures usually survive 20–50 KB because they are mostly white space.",
      },
    ],
    related: ["/compress-image-to-100kb", "/compress-image-to-200kb", "/image-resizer"],
  },
  {
    slug: "image-resizer",
    path: "/image-resizer",
    title: "Image Resizer — exact pixels, percentages and photo presets",
    description:
      "Resize images to exact width and height, by percentage, or crop to fit application photo and signature dimensions. Preview before downloading. No uploads.",
    h1: "Resize images to exact pixel dimensions",
    lede:
      "Type the width and height a portal demands, or start from a preset like 350 × 350 px for a photo and 140 × 60 px for a signature. Preview the result before you download it.",
    tool: "image-resize",
    badge: "Presets for photos and signatures",
    sections: [
      {
        heading: "Fit or fill — the choice that decides how a photo looks",
        body: [
          "Keep aspect ratio and the image is scaled down inside your box, so nothing is cut off but the output can be slightly smaller than the box on one side. Turn on crop-to-fill and the image is scaled to cover the box completely, with the overflow trimmed evenly from both edges — the right choice when a form demands exactly 350 × 350 px.",
          "Percentage resizing is for quick reductions, and the longest-edge mode is useful when you only care that a photo is, say, no wider than 1600 px.",
        ],
      },
      {
        heading: "Why resizing often fixes an upload rejection",
        body: [
          "Portals reject files for two different reasons: too many bytes, or the wrong pixel dimensions. Resizing handles the second — and because fewer pixels usually means fewer bytes, it often helps with the first as well.",
          "If the file is still too big after resizing, send it straight to the image compressor with a target size and you'll have a submission-ready file in one more step.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does resizing improve quality?",
        a: "No. Enlarging an image cannot add detail. Resizing is for matching a required size; always start from the highest-resolution original you have.",
      },
      {
        q: "What size should an application photo or signature be?",
        a: "The presets use sizes that appear most often on exam and government portals: 350 × 350 px and 200 × 230 px photos, 140 × 60 px and 300 × 80 px signatures. Check your form's instructions and use custom dimensions if they differ.",
      },
      {
        q: "Can I resize several images at once?",
        a: "Yes. Add multiple files and the same dimensions are applied to each one, with individual downloads or a single ZIP.",
      },
    ],
    related: ["/image-compressor", "/jpg-to-pdf", "/application-pack"],
  },
  {
    slug: "jpg-to-pdf",
    path: "/jpg-to-pdf",
    title: "JPG to PDF — combine photos and scans into one multi-page PDF",
    description:
      "Convert JPG, PNG and WebP images into a single multi-page PDF in your browser. Reorder pages, choose A4 or Letter, set margins and image quality.",
    h1: "Turn images into one clean, multi-page PDF",
    lede:
      "The classic job: a pile of phone photos that a portal insists on receiving as a single PDF. Add the images, drag them into order, pick a page size and download.",
    tool: "images-to-pdf",
    badge: "A4 · Letter · image-size pages",
    sections: [
      {
        heading: "Order, page size and margins",
        body: [
          "Page order is the whole point when a document has multiple sides. Drag any image to a new position, or use the arrow buttons on touch screens. Each image becomes one page, and pages can be removed before you generate the PDF.",
          "A4 and Letter suit documents that will be printed or read on a desktop. The image-size option keeps the original proportions so a scan isn't stretched. Margins are set in millimetres, which is how most form instructions describe them, and images are always scaled to fit inside the margin box without distortion.",
        ],
      },
      {
        heading: "Keeping the PDF small enough to upload",
        body: [
          "Image quality decides the final file size. 85% is a good default for scans and documents; drop to 65–70% if the portal has a tight limit, and use the image compressor first when a single photo is oversized.",
          "Images are capped at 2400 px on the longest edge while converting, which keeps a 12-photo PDF comfortably inside typical upload limits without visibly softening text.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the text in my scans still readable?",
        a: "Yes — each image is embedded at its captured resolution (up to 2400 px on the longest edge) and scaled to fit the page without stretching, so document text stays legible.",
      },
      {
        q: "Can I mix JPG and PNG files in one PDF?",
        a: "Yes. Add any mix of JPG, PNG and WebP images, and they are combined in the order you arrange them.",
      },
      {
        q: "Do I need to install anything?",
        a: "No. The PDF is assembled in your browser with a WebAssembly-free JavaScript PDF library, so it works on phones and locked-down office computers alike.",
      },
    ],
    related: ["/image-compressor", "/merge-pdf", "/pdf-compressor"],
  },
  {
    slug: "pdf-compressor",
    path: "/pdf-compressor",
    title: "PDF Compressor — reduce PDF size in your browser, with target presets",
    description:
      "Compress PDFs to 100 KB, 200 KB, 500 KB, 1 MB or 2 MB without uploading them. Choose a compression level, see original and final size, and download instantly.",
    h1: "Compress a PDF down to the upload limit",
    lede:
      "Two passes, applied honestly. First the file structure is rebuilt losslessly — text stays selectable. If that isn't enough, pages are re-encoded as images at a resolution that fits your target.",
    tool: "pdf-compress",
    badge: "Exact target presets",
    sections: [
      {
        heading: "Why PDF compression is uncertain by nature",
        body: [
          "A PDF is a container, and what's inside decides how much can be saved. A born-digital PDF with embedded fonts may already be near its limit; a 20 MB scan of 40 pages usually shrinks dramatically because the scans are the size. That's why SubmitReady reports the real result instead of promising a fixed percentage.",
          "You choose the trade-off. Light rebuilds the structure and keeps everything selectable. Balanced and Strong re-render pages as JPEGs at 150 DPI and 120 DPI — excellent for scans, but text stops being selectable. Extreme drops to 96 DPI for the tightest limits.",
        ],
      },
      {
        heading: "What you should check after compressing",
        body: [
          "Open the result and confirm that small print, stamps and signatures are still legible, and that page numbers still line up. If a file must remain fillable or text-searchable, keep the level at Light and try compressing the source images before converting.",
          "Passwords stay a blocker: an encrypted PDF can't be processed locally, and the tool tells you so instead of producing a broken file.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can you guarantee my PDF will hit 100 KB exactly?",
        a: "No, and be wary of tools that claim otherwise. SubmitReady works page by page against a per-page budget, so most files land at or under the target. If a file is already optimised, you'll see its real size and a clear explanation instead of a failed upload later.",
      },
      {
        q: "Does compressing remove pages or blank them out?",
        a: "Never. Page count, order and page dimensions are preserved. At higher levels page content is re-rendered as an image, so vector text becomes pixels.",
      },
      {
        q: "Is there a file size limit?",
        a: "The practical limit is your device's memory rather than the tool. Files up to roughly 100 MB work on modern desktop browsers; on a phone, stay under about 25 MB and close other tabs.",
      },
    ],
    related: ["/compress-pdf-to-100kb", "/compress-pdf-to-200kb", "/compress-pdf-to-1mb"],
  },
  {
    slug: "merge-pdf",
    path: "/merge-pdf",
    title: "Merge PDF — combine multiple PDFs into one file in your browser",
    description:
      "Combine two or more PDFs into a single document, in the order you choose. See page and file counts before and after, and keep everything on your device.",
    h1: "Merge PDFs into one upload",
    lede:
      "Portals rarely accept four separate documents. Stack them in the right order, merge, and upload a single file.",
    tool: "pdf-merge",
    badge: "Unlimited files in one pass",
    sections: [
      {
        heading: "Order matters more than you think",
        body: [
          "Most application checklists expect a specific sequence — ID first, then mark sheets, then certificates. Drag the cards into that order before merging; the output follows the list exactly, and each card shows the page count it contributes.",
          "Page sizes are preserved per page, so a landscape certificate inside an otherwise portrait file stays landscape rather than being squashed.",
        ],
      },
      {
        heading: "Common uses",
        body: [
          "Attaching ID proof front and back as one file, combining semester mark sheets, and assembling a single portfolio PDF from separately exported designs.",
          "If the merged file exceeds an upload limit, send it straight to the PDF compressor — merging rarely changes total size, so the same bytes still need squeezing.",
        ],
      },
    ],
    faqs: [
      {
        q: "How many PDFs can I merge?",
        a: "There's no fixed number; the limit is your device's memory. Dozens of typical documents merge fine on a phone, and hundreds work on a desktop.",
      },
      {
        q: "What happens to password-protected files?",
        a: "Encrypted PDFs are flagged before merging. Pages are copied as-is, so if a file needs a password to display, remove it in the app that created it first.",
      },
      {
        q: "Does merging reduce quality?",
        a: "No. Pages are copied as objects, not re-rendered, so images and text keep their original quality — the merged file equals the sum of its parts.",
      },
    ],
    related: ["/split-pdf", "/pdf-compressor", "/application-pack"],
  },
  {
    slug: "split-pdf",
    path: "/split-pdf",
    title: "Split PDF — extract pages with a visual page picker",
    description:
      "Split a PDF by page ranges or pick individual pages from thumbnails, then export them as one PDF or several. Page previews render locally in your browser.",
    h1: "Pull out exactly the pages you need",
    lede:
      "A 40-page mark sheet bundle usually needs to become a 2-page upload. Preview the pages, tick the ones that matter, and export.",
    tool: "pdf-split",
    badge: "Visual page picker",
    sections: [
      {
        heading: "Three ways to split",
        body: [
          "Tick individual pages and export them as a single PDF, in the order you selected. Type ranges like 1-3, 7, 12-14 to create several separate files at once. Or split every page into its own PDF when each page belongs somewhere different.",
          "Thumbnails are rendered from the actual file, so you can confirm you're picking page 12 and not the page that merely looks like it.",
        ],
      },
      {
        heading: "Typical reasons to split",
        body: [
          "Upload limits that cap the number of pages, privacy when a bundle contains documents for other people, and re-using a single page — a signature page, an embossed certificate — in several applications.",
          "Extracted pages keep their original resolution, and pages you drop are simply not copied into the new document.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do thumbnails mean my PDF is uploaded?",
        a: "No. Page thumbnails are produced by a PDF renderer running in your browser from the file you selected. There is no server round trip.",
      },
      {
        q: "Can I split by range and also pick individual pages?",
        a: "Yes. Use the page grid for individual picks, and the range field when you need several output files from one pass.",
      },
      {
        q: "Why does a huge PDF feel slow here?",
        a: "Rendering hundreds of page previews is real work. SubmitReady renders them progressively and shows which page it's on, and processing continues only for the pages you select.",
      },
    ],
    related: ["/merge-pdf", "/pdf-compressor", "/application-pack"],
  },
  {
    slug: "compress-image-to-100kb",
    path: "/compress-image-to-100kb",
    title: "Compress image to 100 KB — JPG, PNG and WebP",
    description:
      "Make a photo or signature under 100 KB for exam, government and job portals. Runs in your browser, shows the exact output size before you download.",
    h1: "Compress an image to under 100 KB",
    lede:
      "100 KB is the most common image limit on Indian exam and government portals. Your target is pre-set here — just add the file and download the verified result.",
    tool: "image-compress",
    preset: { targetBytes: 100 * KB },
    badge: "Target pre-set to 100 KB",
    sections: [
      {
        heading: "What to expect at 100 KB",
        body: [
          "A 2–4 megapixel photo settles comfortably under 100 KB while still looking sharp on screen and in print at passport size. Signatures on white paper rarely need more than 20–40 KB.",
          "If the source photo is enormous — say 12 megapixels from a recent phone — the compressor may also reduce dimensions. That's expected and it's reported in the output summary, along with the final pixel size.",
        ],
      },
      {
        heading: "Getting the best-looking 100 KB file",
        body: [
          "Start from a good original, crop tightly around the subject, and only then compress. Cropping first means fewer wasted pixels carrying background detail, which is where the bytes go.",
          "Check the before/after view: if edges look smudged, the photo was probably already compressed twice, and resizing from a better original will beat squeezing harder.",
        ],
      },
    ],
    faqs: [
      {
        q: "My file is already under 100 KB. Do I need to compress it?",
        a: "No — but if the portal also demands minimum sizes (10 KB is common), check that too. SubmitReady's Application Pack validates both directions at once.",
      },
      {
        q: "What if the result is 96 KB — is that safe?",
        a: "Yes. Any value at or below 100 KB passes. The tool aims just under the limit rather than exactly at it, because browsers occasionally round an encoded size by a few bytes.",
      },
      {
        q: "Does the 100 KB limit apply to PDFs too?",
        a: "Different tool, same idea — use the PDF compressor with a 100 KB target for documents.",
      },
    ],
    related: ["/compress-image-to-200kb", "/image-compressor", "/application-pack"],
  },
  {
    slug: "compress-image-to-200kb",
    path: "/compress-image-to-200kb",
    title: "Compress image to 200 KB — online, in your browser",
    description:
      "Reduce JPG, PNG or WebP images to 200 KB without uploading them. Handy for photo uploads that allow a little more detail than 100 KB.",
    h1: "Compress an image to under 200 KB",
    lede:
      "The comfortable middle ground: enough headroom for a detailed photograph, still small enough for portals that cap uploads at a couple of hundred kilobytes.",
    tool: "image-compress",
    preset: { targetBytes: 200 * KB },
    badge: "Target pre-set to 200 KB",
    sections: [
      {
        heading: "When 200 KB is the right target",
        body: [
          "Scanned certificates, ID documents and full-length photographs usually look better near 200 KB than at 100 KB, and most portals that ask for 'under 200 KB' have exactly this trade-off in mind.",
          "Because the compressor stops as soon as the target is met, a 200 KB run typically keeps more resolution than a 100 KB run of the same photo — the difference is visible on ID photos that need to stay sharp.",
        ],
      },
      {
        heading: "Two-step workflow that always works",
        body: [
          "If your file needs specific pixel dimensions as well, resize first (350 × 350 px is the usual photo standard) and compress second. That order avoids resizing an already-degraded image.",
          "For a whole application, the Application Pack does both automatically: it reads each requirement, flags mismatches, and offers one-click fixes.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is 200 KB too big for a signature upload?",
        a: "Signature limits are usually 20–100 KB. Use the 100 KB target page or set a custom size instead.",
      },
      {
        q: "Can I compress several photos to 200 KB each?",
        a: "Yes. Add multiple files, and each is compressed independently against the same 200 KB target, with a ZIP download for the whole batch.",
      },
      {
        q: "Will the tool tell me if it couldn't reach 200 KB?",
        a: "It will. You'll see the actual output size, the reduction achieved, and a note explaining that the smallest possible version was kept.",
      },
    ],
    related: ["/compress-image-to-100kb", "/image-resizer", "/jpg-to-pdf"],
  },
  {
    slug: "compress-pdf-to-100kb",
    path: "/compress-pdf-to-100kb",
    title: "Compress PDF to 100 KB — browser-based PDF size reduction",
    description:
      "Reduce a PDF to around 100 KB for strict upload limits. Lossless rebuild first, then page re-encoding, all in your browser with real before/after sizes.",
    h1: "Compress a PDF to under 100 KB",
    lede:
      "100 KB is a tight target for a PDF — usually achievable for a few text pages or a small scan. This page pre-sets the target and explains plainly what happens if the file can't get there.",
    tool: "pdf-compress",
    preset: { targetBytes: 100 * KB, compressLevel: "strong" },
    badge: "Target pre-set to 100 KB",
    sections: [
      {
        heading: "What fits in 100 KB",
        body: [
          "Two to five pages of text with modest embedded fonts typically fit. A single-page ID scan usually fits. A 20-page scanned bundle will not, and no tool can make it — the honest answer is to split it and upload the pages that matter, which is why the splitter sits next to this tool.",
          "Because pages are re-encoded against a per-page budget, a mixed document is handled sensibly: text pages end up tiny, dense photographs get as much of the budget as they need.",
        ],
      },
      {
        heading: "Before you upload",
        body: [
          "Zoom in on the smallest text in the compressed file. If it's still readable, you're done. If not, try the Light level and shrink the source images first — scanned pages resized to 1600 px wide often save more than aggressive PDF re-encoding.",
        ],
      },
    ],
    faqs: [
      {
        q: "Why did my PDF stop at 140 KB?",
        a: "The page content was already close to the smallest JPEG representation the browser can produce. You'll see the closest result achieved and a note saying the target wasn't reachable.",
      },
      {
        q: "Will the compressed PDF still open everywhere?",
        a: "Yes. Output is standard PDF 1.7 with embedded JPEG pages, readable by every common viewer and accepted by government portals.",
      },
      {
        q: "Can I compress a scanned PDF from my phone?",
        a: "Yes, and phone photos of documents compress very well since scans are mostly white space. Keep scanned bundles under roughly 25 MB on a phone.",
      },
    ],
    related: ["/pdf-compressor", "/split-pdf", "/compress-pdf-to-200kb"],
  },
  {
    slug: "compress-pdf-to-200kb",
    path: "/compress-pdf-to-200kb",
    title: "Compress PDF to 200 KB — keep documents readable at a smaller size",
    description:
      "Shrink a PDF to about 200 KB with page-accurate compression. Text stays crisp at higher quality levels, and files never leave your device.",
    h1: "Compress a PDF to under 200 KB",
    lede:
      "The most workable PDF target: enough room for a handful of scanned pages while still passing most size-capped upload forms.",
    tool: "pdf-compress",
    preset: { targetBytes: 200 * KB, compressLevel: "balanced" },
    badge: "Target pre-set to 200 KB",
    sections: [
      {
        heading: "Why 200 KB is usually the sweet spot",
        body: [
          "At 200 KB a scanned certificate stays legible, including seals and handwritten signatures, because the per-page budget allows 150 DPI re-encoding rather than a hard squeeze.",
          "Photos inside the document are the main size driver. If one page is a full-page photograph, the compressor spends most of the budget there and treats text pages almost for free.",
        ],
      },
      {
        heading: "Combine with merging for a single upload",
        body: [
          "Merge your documents first so the compressor works on the final file — that way the 200 KB budget is shared exactly as the portal will see it.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does the text stay selectable?",
        a: "If the lossless rebuild alone reaches 200 KB, yes — nothing is re-rendered. Otherwise pages are re-encoded as images and the result is noted in the output summary.",
      },
      {
        q: "Can I compress to 200 KB and keep A4 page size?",
        a: "Yes. Original page dimensions are preserved page by page; only the pixel content inside them is re-encoded.",
      },
      {
        q: "What if I need an even smaller file?",
        a: "Try the 100 KB target page, or split the PDF and upload the essential pages only.",
      },
    ],
    related: ["/compress-pdf-to-100kb", "/compress-pdf-to-1mb", "/merge-pdf"],
  },
  {
    slug: "compress-pdf-to-1mb",
    path: "/compress-pdf-to-1mb",
    title: "Compress PDF to 1 MB — for portals that allow larger documents",
    description:
      "Bring a large PDF down to 1 MB while keeping scans and photos sharp. Lossless first, then quality-controlled page re-encoding, entirely in your browser.",
    h1: "Compress a PDF to under 1 MB",
    lede:
      "A generous limit that suits multi-page portfolios and scanned bundles. Quality stays high, and most modern documents land well below the target.",
    tool: "pdf-compress",
    preset: { targetBytes: 1 * MB, compressLevel: "balanced" },
    badge: "Target pre-set to 1 MB",
    sections: [
      {
        heading: "When a big PDF is really an image problem",
        body: [
          "A 30 MB PDF is almost always a stack of photos or 600 DPI scans. Bringing it to 1 MB means the pages need roughly 20 times fewer bytes, which is achieved by re-encoding at a sensible resolution rather than by deleting anything.",
          "Check the output for small print and stamps. If they matter — exam hall tickets, certificates with fine print — keep the Balanced level rather than Extreme; 1 MB is usually plenty of room.",
        ],
      },
      {
        heading: "Splitting can beat compressing",
        body: [
          "If only three pages out of forty are required, splitting first produces a far better-looking file than compressing the whole bundle. Use the splitter to isolate the pages, then compress if the result is still above the limit.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is compressing to 1 MB lossless?",
        a: "The first pass is lossless and often enough. At higher levels pages are re-encoded as high-quality JPEGs, which keeps visual fidelity but stops text from being selectable.",
      },
      {
        q: "Will links and form fields survive?",
        a: "Interactive elements are not carried into re-rendered pages. If a PDF must stay fillable, use the Light level and compress its source images instead.",
      },
      {
        q: "Can SubmitReady handle a 50 MB PDF?",
        a: "On desktop, usually yes. On a phone, expect memory pressure — split the file first and process it in sections.",
      },
    ],
    related: ["/pdf-compressor", "/split-pdf", "/compress-pdf-to-200kb"],
  },
  {
    slug: "application-pack",
    path: "/application-pack",
    title: "Application Pack — check every upload against its requirements",
    description:
      "Build a temporary checklist for a photo, signature, resume, ID proof, certificate and mark sheet. Validate each file against its size, dimension and page limits, fix issues in one click.",
    h1: "One checklist for a whole application",
    lede:
      "Applications get rejected for boring reasons: a signature that's 4 KB too large, a photo in the wrong dimensions, a mark sheet with two pages too many. The Application Pack checks all of it before you upload anything.",
    tool: "application-pack",
    badge: "The differentiator",
    sections: [
      {
        heading: "Requirements, then verification",
        body: [
          "Each slot starts with the limits that appear most often on exam, scholarship and government forms — 200 KB photos at 350 × 350 px, 100 KB signatures, three-page resumes. Every value is editable, because the real answer is always the one printed on your form.",
          "Files are inspected as soon as you add them: type, size, pixel dimensions for images, page count for PDFs. Each rule is then marked ✅ met, ⚠️ worth checking, or ❌ not met, with the reason spelled out in numbers.",
        ],
      },
      {
        heading: "One-click fixes, then download everything",
        body: [
          "A failing check comes with the fix attached: compress to the exact size limit, resize to the required dimensions, convert an image to PDF, or keep only the first few pages. Fixes run in your browser against the original file and the result is re-validated immediately.",
          "When every slot is green, download each prepared file or the whole set as a ZIP. Nothing is stored on a server at any point — close the tab and the pack is gone.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is my application data saved anywhere?",
        a: "No. The pack lives in your browser's memory for the session so you can move between tools, and it disappears when you close or reload the tab. There is no account and no server-side storage.",
      },
      {
        q: "Can I use different requirements than the defaults?",
        a: "Yes. Every slot's limits are editable, including allowed file types, minimum and maximum size, pixel dimensions and maximum page count.",
      },
      {
        q: "What if a fix can't meet the requirement?",
        a: "You'll see the actual result and a plain explanation, for example that a file is already at its smallest or that the PDF must be split. No silent failures and no fake success states.",
      },
    ],
    related: ["/image-compressor", "/merge-pdf", "/privacy"],
  },
];

export const SEO_PAGE_BY_SLUG: Record<string, SeoPage> = Object.fromEntries(
  SEO_PAGES.map((page) => [page.slug, page]),
);

export const SITEMAP_PATHS: string[] = [
  "/",
  "/tools",
  "/privacy",
  "/application-pack",
  ...SEO_PAGES.filter((page) => page.slug !== "application-pack").map(
    (page) => page.path,
  ),
];

export interface QuickAction {
  label: string;
  path: string;
  tool: ToolKind;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Compress image", path: "/image-compressor", tool: "image-compress" },
  { label: "Resize image", path: "/image-resizer", tool: "image-resize" },
  { label: "JPG to PDF", path: "/jpg-to-pdf", tool: "images-to-pdf" },
  { label: "Compress PDF", path: "/pdf-compressor", tool: "pdf-compress" },
  { label: "Merge PDF", path: "/merge-pdf", tool: "pdf-merge" },
  { label: "Split PDF", path: "/split-pdf", tool: "pdf-split" },
];

export interface PopularRequirement {
  label: string;
  hint: string;
  path: string;
}

export const POPULAR_REQUIREMENTS: PopularRequirement[] = [
  { label: "Under 100 KB", hint: "images & PDFs", path: "/compress-image-to-100kb" },
  { label: "Under 200 KB", hint: "images & PDFs", path: "/compress-image-to-200kb" },
  { label: "Under 500 KB", hint: "PDF documents", path: "/pdf-compressor" },
  { label: "Under 1 MB", hint: "PDF documents", path: "/compress-pdf-to-1mb" },
  { label: "350 × 350 px", hint: "application photo", path: "/image-resizer" },
  { label: "A4 PDF", hint: "images to document", path: "/jpg-to-pdf" },
];

export const HOME_CARDS: {
  title: string;
  subtitle: string;
  path: string;
  emoji: string;
}[] = [
  {
    title: "Photo",
    subtitle: "Crop to 350 × 350 px and squeeze it under 100 KB.",
    path: "/image-resizer",
    emoji: "📷",
  },
  {
    title: "Signature",
    subtitle: "Clean up a scan and hit the 20–100 KB signature limit.",
    path: "/compress-image-to-100kb",
    emoji: "✍️",
  },
  {
    title: "PDF",
    subtitle: "Compress, merge or split a document before uploading.",
    path: "/pdf-compressor",
    emoji: "📄",
  },
  {
    title: "Images",
    subtitle: "Batch compress or convert photos into a single PDF.",
    path: "/image-compressor",
    emoji: "🖼️",
  },
  {
    title: "Application Pack",
    subtitle: "Check every file against its upload rules in one pass.",
    path: "/application-pack",
    emoji: "✅",
  },
];
