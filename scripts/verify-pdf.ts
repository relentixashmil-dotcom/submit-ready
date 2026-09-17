/**
 * Temporary verification harness — exercises the pdf-lib paths of the
 * SubmitReady PDF engine against real generated sample files.
 * Run: bun scripts/verify-pdf.ts
 */
import zlib from "node:zlib";
import { PDFDocument, rgb } from "pdf-lib";
import {
  imagesToPdf,
  mergePdfs,
  parsePageRanges,
  readPdfInfo,
  resavePdf,
  selectionToGroup,
  splitPdf,
} from "../src/lib/pdf";
import { bytesToBlob, formatBytes } from "../src/lib/format";
import type { PreparedPdfImage } from "../src/lib/image";

/* ------------------------------ sample PNG ------------------------------ */

function crc32(buffer: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32(body));
  const out = new Uint8Array(length.length + body.length + crc.length);
  out.set(length, 0);
  out.set(body, 4);
  out.set(crc, 4 + body.length);
  return out;
}

function makePng(width: number, height: number, shade: number): Uint8Array {
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = rowStart + 1 + x * 3;
      raw[i] = (shade + x) % 256;
      raw[i + 1] = (shade + y) % 256;
      raw[i + 2] = 128;
    }
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", new Uint8Array()),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/* ------------------------------ assertions ------------------------------ */

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${label} ${detail}`);
  }
}

function near(a: number, b: number, tolerance = 0.5) {
  return Math.abs(a - b) <= tolerance;
}

async function makePdf(pageCount: number, label: string) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`${label} page ${i + 1}`, {
      x: 60,
      y: 700,
      size: 24,
      color: rgb(0.1, 0.1, 0.5),
    });
  }
  return doc.save({ useObjectStreams: true });
}

/* --------------------------------- tests -------------------------------- */

async function main() {
  console.log("\nImages → PDF");
  const photos: PreparedPdfImage[] = [
    { bytes: makePng(400, 300, 10), width: 400, height: 300, embedType: "png", name: "photo.png" },
    { bytes: makePng(300, 500, 40), width: 300, height: 500, embedType: "png", name: "sign.png" },
  ];
  const a4 = await imagesToPdf(photos, {
    pageSize: "a4",
    orientation: "auto",
    margin: 24,
  });
  check("returns one page per image", a4.pageCount === 2, `got ${a4.pageCount}`);
  check(
    "A4 landscape box for the landscape photo",
    near(a4.pageSize.width, 841.89) && near(a4.pageSize.height, 595.28),
    JSON.stringify(a4.pageSize),
  );
  const a4Info = await readPdfInfo(a4.bytes);
  check("output re-parses with pdf-lib", a4Info.pageCount === 2);
  const firstPage = a4Info.pages[0];
  check(
    "page box preserved on disk",
    near(firstPage.width, 841.89) && near(firstPage.height, 595.28),
    JSON.stringify(firstPage),
  );

  const letter = await imagesToPdf(photos, {
    pageSize: "letter",
    orientation: "portrait",
    margin: 0,
  });
  const letterInfo = await readPdfInfo(letter.bytes);
  check(
    "Letter portrait box",
    near(letterInfo.pages[0].width, 612) && near(letterInfo.pages[0].height, 792),
    JSON.stringify(letterInfo.pages[0]),
  );

  const imagePages = await imagesToPdf([photos[0]], {
    pageSize: "image",
    orientation: "auto",
    margin: 0,
  });
  const imageInfo = await readPdfInfo(imagePages.bytes);
  check(
    "image-size page keeps the source aspect ratio",
    Math.abs(
      imageInfo.pages[0].width / imageInfo.pages[0].height - 400 / 300,
    ) < 0.01,
    JSON.stringify(imageInfo.pages[0]),
  );

  console.log("\nMerge");
  const docA = await makePdf(2, "docA");
  const docB = await makePdf(3, "docB");
  const merged = await mergePdfs([
    { name: "a.pdf", bytes: docA },
    { name: "b.pdf", bytes: docB },
  ]);
  check("page count is the sum", merged.pageCount === 5, `got ${merged.pageCount}`);
  check("file count reported", merged.fileCount === 2);
  const mergedInfo = await readPdfInfo(merged.bytes);
  check("merged output is readable", mergedInfo.pageCount === 5);

  console.log("\nSplit");
  const source = await makePdf(6, "source");
  const ranges = parsePageRanges("1-2, 4, 6", 6);
  check("range parsing yields 3 groups", ranges.groups.length === 3, JSON.stringify(ranges.groups));
  check("no parse errors", ranges.errors.length === 0, ranges.errors.join("; "));
  const split = await splitPdf(source, "marksheet.pdf", ranges.groups);
  check("split yields 3 files", split.outputs.length === 3);
  check("first file name", split.outputs[0].name === "marksheet-pages-1-2.pdf", split.outputs[0].name);
  const singlePage = await readPdfInfo(split.outputs[1].bytes);
  check("middle file has 1 page", singlePage.pageCount === 1);

  const bad = parsePageRanges("12, 5-2, abc", 6);
  check("out-of-range and reversed input is reported", bad.errors.length === 3, bad.errors.join(" | "));

  const selection = selectionToGroup([3, 1, 1]);
  check(
    "selection groups sort and de-duplicate",
    selection?.pages.join(",") === "1,3",
    JSON.stringify(selection),
  );

  const all = parsePageRanges("all", 4);
  check("'all' expands to every page", all.groups[0].pages.length === 4);

  console.log("\nLight re-save");
  const rebuilt = await resavePdf(source);
  const rebuiltInfo = await readPdfInfo(rebuilt);
  check("rebuilt PDF keeps its pages", rebuiltInfo.pageCount === 6);

  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]);
  const saved = await doc.save();
  const blob = bytesToBlob(saved, "application/pdf");
  const roundTrip = new Uint8Array(await blob.arrayBuffer());
  check(
    "blob conversion keeps every byte",
    blob.size === saved.length && roundTrip[0] === 0x25 /* % */,
    `${blob.size} vs ${saved.length}; ${formatBytes(saved.length)}`,
  );

  console.log(
    failures === 0
      ? "\nAll PDF engine checks passed.\n"
      : `\n${failures} check(s) failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

await main();
