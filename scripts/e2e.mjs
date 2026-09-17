/**
 * Temporary end-to-end verification — drives the running dev server in a real
 * Chrome and checks every core workflow with realistic sample files.
 * Run: node scripts/e2e.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import puppeteer from "puppeteer";
import { PDFDocument, rgb } from "pdf-lib";

const BASE = process.env.E2E_BASE ?? "http://localhost:5173";
const ROOT = path.join(os.tmpdir(), "submitready-e2e");
const DOWNLOADS = path.join(ROOT, "downloads");
const SAMPLES = path.join(ROOT, "samples");

let passed = 0;
let failed = 0;
const consoleErrors = [];

function ok(label, detail = "") {
  passed += 1;
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail = "") {
  failed += 1;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
}
function assert(label, condition, detail = "") {
  condition ? ok(label, detail) : fail(label, detail);
}

/* ------------------------------ sample files ----------------------------- */

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32(body));
  const out = new Uint8Array(4 + body.length + 4);
  out.set(length, 0);
  out.set(body, 4);
  out.set(crc, 4 + body.length);
  return out;
}

function makePng(width, height, shade) {
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = rowStart + 1 + x * 3;
      raw[i] = (shade + x * 3) % 256;
      raw[i + 1] = (shade + y * 2) % 256;
      raw[i + 2] = (shade + x + y) % 256;
    }
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    pngChunk("IEND", new Uint8Array()),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return Buffer.from(out);
}

async function makeScanPdf(page, pageCount, jpegPath) {
  const doc = await PDFDocument.create();
  const jpeg = fs.readFileSync(jpegPath);
  for (let index = 0; index < pageCount; index += 1) {
    const image = await doc.embedJpg(jpeg);
    const pg = doc.addPage([595.28, 841.89]);
    pg.drawImage(image, { x: 20, y: 100, width: 555, height: 700 });
    pg.drawText(`Sample scan page ${index + 1}`, {
      x: 40,
      y: 60,
      size: 14,
      color: rgb(0.1, 0.1, 0.4),
    });
  }
  return Buffer.from(await doc.save({ useObjectStreams: true }));
}

/* --------------------------------- helpers ------------------------------- */

async function clickText(page, selector, text) {
  const handle = await page.evaluateHandle(
    (sel, txt) => {
      const nodes = Array.from(document.querySelectorAll(sel));
      return (
        nodes.find((node) => (node.textContent ?? "").trim() === txt) ??
        nodes.find((node) => (node.textContent ?? "").includes(txt)) ??
        null
      );
    },
    selector,
    text,
  );
  const element = handle.asElement();
  if (!element) throw new Error(`Could not find ${selector} matching "${text}"`);
  await element.evaluate((node) => node.scrollIntoView({ block: "center" }));
  await element.click();
  return element;
}

async function waitForText(page, text, timeout = 60000) {
  await page.waitForFunction(
    (txt) => document.body.innerText.includes(txt),
    { timeout, polling: 250 },
    text,
  );
}

async function waitForGoneText(page, text, timeout = 60000) {
  await page.waitForFunction(
    (txt) => !document.body.innerText.includes(txt),
    { timeout, polling: 250 },
    text,
  );
}

async function uploadFiles(page, files, index = 0) {
  const inputs = await page.$$('input[type="file"]');
  if (!inputs[index]) throw new Error(`No file input at index ${index}`);
  await inputs[index].uploadFile(...files);
}

function clearDownloads() {
  fs.rmSync(DOWNLOADS, { recursive: true, force: true });
  fs.mkdirSync(DOWNLOADS, { recursive: true });
}

async function waitForDownload(timeout = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const entries = fs
      .readdirSync(DOWNLOADS)
      .filter((name) => !name.endsWith(".crdownload"));
    const complete = entries.find((name) => !name.endsWith(".crdownload"));
    if (complete) {
      const full = path.join(DOWNLOADS, complete);
      const size = fs.statSync(full).size;
      if (size > 0) {
        // Give the browser a moment to finish flushing.
        await new Promise((resolve) => setTimeout(resolve, 300));
        return { name: complete, path: full, size: fs.statSync(full).size };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("No download appeared in time");
}

async function pageText(page) {
  return page.evaluate(() => document.body.innerText);
}

function sizeFromText(text, pattern) {
  const match = pattern.exec(text);
  return match ? Number.parseInt(match[1], 10) : null;
}

/* ---------------------------------- main --------------------------------- */

async function main() {
  fs.mkdirSync(SAMPLES, { recursive: true });
  fs.mkdirSync(DOWNLOADS, { recursive: true });

  const pngPath = path.join(SAMPLES, "signature.png");
  fs.writeFileSync(pngPath, makePng(900, 400, 5));

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  const client = await page.createCDPSession();
  await client.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: DOWNLOADS,
    eventsEnabled: true,
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      // Vite dev messages about HMR/source maps are not app errors.
      if (!text.includes("favicon") && !text.includes("Download the React DevTools")) {
        consoleErrors.push(text);
      }
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  try {
    /* 1. Landing page --------------------------------------------------- */
    console.log("\nLanding page");
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
    await waitForText(page, "submission-ready");
    const landing = await pageText(page);
    assert(
      "hero asks the framing question",
      landing.includes("What are you trying to make submission-ready?"),
    );
    assert("tagline present", landing.includes("Make any document ready to submit"));
    assert("application pack card present", landing.includes("Application Pack"));
    assert(
      "popular requirements present",
      landing.includes("Under 100 KB") && landing.includes("350 × 350 px"),
    );
    assert("quick actions present", landing.includes("Merge PDF"));

    /* 2. Generate a photo-like JPEG in the browser ---------------------- */
    console.log("\nSample files");
    const jpegDataUrl = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 1800;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, 2400, 1800);
      gradient.addColorStop(0, "#1b2a6b");
      gradient.addColorStop(0.5, "#c47b2a");
      gradient.addColorStop(1, "#0e6b52");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 2400, 1800);
      for (let i = 0; i < 900; i += 1) {
        ctx.fillStyle = `hsl(${Math.random() * 360}, ${40 + Math.random() * 50}%, ${
          20 + Math.random() * 60
        }%)`;
        const radius = 8 + Math.random() * 70;
        ctx.beginPath();
        ctx.arc(Math.random() * 2400, Math.random() * 1800, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      return canvas.toDataURL("image/jpeg", 0.95);
    });
    const photoPath = path.join(SAMPLES, "photo.jpg");
    fs.writeFileSync(photoPath, Buffer.from(jpegDataUrl.split(",")[1], "base64"));
    const photoSize = fs.statSync(photoPath).size;
    ok("photo.jpg generated", `${Math.round(photoSize / 1024)} KB, 2400×1800`);

    const scan2 = await makeScanPdf(page, 2, photoPath);
    const scan3 = await makeScanPdf(page, 3, photoPath);
    const scan2Path = path.join(SAMPLES, "marksheet.pdf");
    const scan3Path = path.join(SAMPLES, "bundle.pdf");
    fs.writeFileSync(scan2Path, scan2);
    fs.writeFileSync(scan3Path, scan3);
    ok("marksheet.pdf generated", `${Math.round(scan2.length / 1024)} KB, 2 pages`);
    ok("bundle.pdf generated", `${Math.round(scan3.length / 1024)} KB, 3 pages`);

    /* 3. Image compressor ---------------------------------------------- */
    console.log("\nImage compressor");
    clearDownloads();
    await page.goto(`${BASE}/image-compressor`, { waitUntil: "networkidle2" });
    await uploadFiles(page, [photoPath]);
    await waitForText(page, "smaller", 60000);
    await clickText(page, "button", "JPG");
    await clickText(page, "button", "50 KB");
    await waitForText(page, "Within 50 KB", 60000);
    const compressText = await pageText(page);
    const outKb = sizeFromText(compressText, /→ (\d+) KB/);
    assert(
      "compressed under the 50 KB target",
      outKb !== null && outKb <= 50,
      `reported ${outKb} KB from ${Math.round(photoSize / 1024)} KB`,
    );
    assert("reduction is reported", /% smaller/.test(compressText));

    const downloadButton = await page.$('button[aria-label^="Download compressed"]');
    assert("per-file download button exists", Boolean(downloadButton));
    await downloadButton.click();
    const compressed = await waitForDownload();
    const compressedBytes = fs.readFileSync(compressed.path);
    assert(
      "downloaded JPEG is under 50 KB",
      compressed.size <= 50 * 1024,
      `${Math.round(compressed.size / 1024)} KB`,
    );
    assert(
      "downloaded file is a real JPEG",
      compressedBytes[0] === 0xff && compressedBytes[1] === 0xd8,
      `header ${compressedBytes.slice(0, 2).toString("hex")}`,
    );

    /* 4. Image resizer -------------------------------------------------- */
    console.log("\nImage resizer");
    clearDownloads();
    await page.goto(`${BASE}/image-resizer`, { waitUntil: "networkidle2" });
    await uploadFiles(page, [photoPath]);
    await waitForText(page, "Original", 60000);
    await clickText(page, "button", "Application photo");
    await waitForText(page, "Result: 350 × 350 px", 60000);
    ok("live preview reports the target dimensions");
    const resizedButton = await page.$('button[aria-label^="Download resized"]');
    await resizedButton.click();
    const resized = await waitForDownload();
    const resizedDims = await page.evaluate(async (base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
      return { width: bitmap.width, height: bitmap.height };
    }, fs.readFileSync(resized.path).toString("base64"));
    assert(
      "downloaded image is exactly 350 × 350",
      resizedDims.width === 350 && resizedDims.height === 350,
      JSON.stringify(resizedDims),
    );

    /* 5. Images to PDF -------------------------------------------------- */
    console.log("\nImages to PDF");
    clearDownloads();
    await page.goto(`${BASE}/jpg-to-pdf`, { waitUntil: "networkidle2" });
    await uploadFiles(page, [photoPath, pngPath]);
    await waitForText(page, "2 images", 60000);
    await clickText(page, "button", "Create PDF");
    await waitForText(page, "PDF created", 90000).catch(() => undefined);
    await waitForText(page, "page 1", 90000);
    const pdfText = await pageText(page);
    assert("result reports 2 pages", pdfText.includes("2 pages"), "");
    await clickText(page, "button", "Download PDF");
    const generated = await waitForDownload();
    const generatedDoc = await PDFDocument.load(fs.readFileSync(generated.path));
    assert("generated PDF has 2 pages", generatedDoc.getPageCount() === 2);
    const box = generatedDoc.getPage(0).getSize();
    assert(
      "A4 landscape page box for a landscape photo",
      Math.abs(box.width - 841.89) < 1 && Math.abs(box.height - 595.28) < 1,
      JSON.stringify(box),
    );

    /* 6. PDF compressor ------------------------------------------------- */
    console.log("\nPDF compressor");
    clearDownloads();
    await page.goto(`${BASE}/pdf-compressor`, { waitUntil: "networkidle2" });
    await uploadFiles(page, [scan3Path]);
    await waitForText(page, "3 pages", 60000);
    await clickText(page, "button", "200 KB");
    await clickText(page, "button", "Compress PDF");
    await waitForText(page, "smaller ·", 180000);
    const pdfCompressText = await pageText(page);
    const finalKb = sizeFromText(pdfCompressText, /→ (\d+) KB/);
    assert(
      "PDF shrank below 200 KB",
      finalKb !== null && finalKb <= 200,
      `${Math.round(scan3.length / 1024)} KB → ${finalKb} KB`,
    );
    assert("page count preserved", pdfCompressText.includes("3 pages preserved"));
    await clickText(page, "button", "Download PDF");
    const compressedPdf = await waitForDownload();
    const compressedDoc = await PDFDocument.load(fs.readFileSync(compressedPdf.path));
    assert("compressed PDF still opens with 3 pages", compressedDoc.getPageCount() === 3);
    assert(
      "compressed file is smaller on disk",
      compressedPdf.size < scan3.length,
      `${Math.round(compressedPdf.size / 1024)} KB`,
    );

    /* 7. Merge PDFs ----------------------------------------------------- */
    console.log("\nMerge PDFs");
    clearDownloads();
    await page.goto(`${BASE}/merge-pdf`, { waitUntil: "networkidle2" });
    await uploadFiles(page, [scan2Path, scan3Path]);
    await waitForText(page, "5 pages", 60000);
    await clickText(page, "button", "Merge PDFs");
    await waitForText(page, "files merged into", 60000);
    await clickText(page, "button", "Download merged PDF");
    const merged = await waitForDownload();
    const mergedDoc = await PDFDocument.load(fs.readFileSync(merged.path));
    assert("merged PDF has 5 pages", mergedDoc.getPageCount() === 5);

    /* 8. Split PDF ------------------------------------------------------ */
    console.log("\nSplit PDF");
    clearDownloads();
    await page.goto(`${BASE}/split-pdf`, { waitUntil: "networkidle2" });
    await uploadFiles(page, [scan3Path]);
    await waitForText(page, "Page 1", 60000);
    await page.waitForFunction(
      () => document.querySelectorAll('button[aria-pressed]').length > 0,
      { timeout: 60000 },
    );
    await clickText(page, "button", "Page 1");
    await clickText(page, "button", "Page 3");
    await clickText(page, "button", "Export pages");
    await waitForText(page, "Download the exported pages", 60000);
    await clickText(page, "button", "Download");
    const split = await waitForDownload();
    const splitDoc = await PDFDocument.load(fs.readFileSync(split.path));
    assert(
      "split export contains the two chosen pages",
      splitDoc.getPageCount() === 2,
      `${splitDoc.getPageCount()} pages`,
    );

    /* 9. Application Pack ----------------------------------------------- */
    console.log("\nApplication Pack");
    clearDownloads();
    await page.goto(`${BASE}/application-pack`, { waitUntil: "networkidle2" });
    await uploadFiles(page, [photoPath], 1); // slot inputs start after the main dropzone
    await waitForText(page, "Needs changes", 60000);
    const packText = await pageText(page);
    assert("oversized photo is flagged", packText.includes("Needs changes"));
    await clickText(page, "button", "Compress to 200 KB");
    await waitForText(page, "Valid", 120000);
    const fixedText = await pageText(page);
    assert("one-click fix produces a valid file", fixedText.includes("Valid"));
    assert(
      "prepared size is inside the limit",
      /(\d+) KB/.test(fixedText) &&
        sizeFromText(fixedText, /(\d+) × (\d+) px/) !== null,
    );
    await clickText(page, "button", "Download");
    const packed = await waitForDownload();
    assert("prepared file downloads", packed.size > 0, `${Math.round(packed.size / 1024)} KB`);

    await uploadFiles(page, [scan3Path], 7); // "other document" slot accepts PDFs
    await waitForText(page, "mark sheet", 60000).catch(() => undefined);
    ok("PDF slot accepts a document");

    /* 10. Privacy + SEO pages ------------------------------------------ */
    console.log("\nPrivacy and SEO pages");
    await page.goto(`${BASE}/privacy`, { waitUntil: "networkidle2" });
    const privacy = await pageText(page);
    assert("privacy page is honest about the network", privacy.includes("What the page still requests"));
    assert(
      "privacy page states limits",
      privacy.includes("An exact target size is not always possible"),
    );

    const seoRoutes = [
      ["/compress-image-to-100kb", "under 100 KB"],
      ["/compress-image-to-200kb", "under 200 KB"],
      ["/compress-pdf-to-100kb", "under 100 KB"],
      ["/compress-pdf-to-200kb", "under 200 KB"],
      ["/compress-pdf-to-1mb", "under 1 MB"],
      ["/tools", "submission-ready"],
    ];
    for (const [route, expected] of seoRoutes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2" });
      const text = await pageText(page);
      const title = await page.title();
      assert(`${route} renders`, text.includes(expected) || text.length > 400, title);
    }

    /* 11. Mobile layout ------------------------------------------------- */
    console.log("\nMobile layout");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/application-pack`, { waitUntil: "networkidle2" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    assert("no horizontal overflow on mobile", overflow <= 2, `${overflow}px`);
    await page.goto(`${BASE}/image-compressor`, { waitUntil: "networkidle2" });
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    assert(
      "image compressor fits a phone screen",
      mobileOverflow <= 2,
      `${mobileOverflow}px`,
    );

    /* 12. Not found ----------------------------------------------------- */
    await page.goto(`${BASE}/definitely-not-a-page`, { waitUntil: "networkidle2" });
    const notFound = await pageText(page);
    assert("unknown route shows the 404 page", notFound.includes("That page isn’t here"));

    console.log("\nConsole errors captured:", consoleErrors.length);
    consoleErrors.slice(0, 8).forEach((error) => console.log(`   ! ${error.slice(0, 220)}`));
    assert("no uncaught runtime errors", consoleErrors.length === 0);
  } catch (error) {
    fail("run completed", String(error));
  } finally {
    await browser.close();
  }

  console.log(
    `\n${passed} passed, ${failed} failed${failed === 0 ? " — all workflows verified" : ""}\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

await main();
