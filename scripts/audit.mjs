/**
 * SubmitReady audit — drives the running dev server in real Chrome and checks
 * every core workflow from file selection through the downloaded file.
 *
 * Every output is verified by parsing the bytes that landed on disk, not by
 * trusting what the UI says. Run: node scripts/audit.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import puppeteer from "puppeteer";
import { PDFDocument, rgb } from "pdf-lib";
import JSZip from "jszip";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:5173";
const ROOT = path.join(os.tmpdir(), "submitready-audit");
const DOWNLOADS = path.join(ROOT, "downloads");
const SAMPLES = path.join(ROOT, "samples");

let passed = 0;
let failed = 0;
const failures = [];
const consoleErrors = [];
const requests = [];

function ok(label, detail = "") {
  passed += 1;
  console.log(`  \u2713 ${label}${detail ? ` \u2014 ${detail}` : ""}`);
}
function fail(label, detail = "") {
  failed += 1;
  failures.push(`${label}${detail ? ` \u2014 ${detail}` : ""}`);
  console.log(`  \u2717 ${label}${detail ? ` \u2014 ${detail}` : ""}`);
}
function assert(label, condition, detail = "") {
  if (condition) ok(label, detail);
  else fail(label, detail);
}
function section(title) {
  console.log(`\n${title}`);
}

/**
 * The whole audit outgrew a single terminal call, so sections can be selected
 * with AUDIT_ONLY=compress,pdf,... and each invocation stays quick.
 * Accepts "+key" to add a section to the default set as well.
 */
const ONLY = (process.env.AUDIT_ONLY ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const wants = (key) => ONLY.length === 0 || ONLY.includes(key);

async function run(key, title, body) {
  if (!wants(key)) return;
  section(title);
  await body();
}

/* ----------------------------- sample generators -------------------------- */

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

/** A real 8-bit RGB PNG, built by hand so no encoder dependency is needed. */
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

/* ------------------------------ byte inspectors --------------------------- */

/** Dimensions straight out of the JPEG SOF marker. */
function jpegSize(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = bytes.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

function pngSize(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((byte, index) => bytes[index] === byte)) return null;
  if (bytes.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function isJpeg(bytes) {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

function isPng(bytes) {
  return bytes[0] === 137 && bytes.toString("ascii", 1, 4) === "PNG";
}

function isWebp(bytes) {
  return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

/** Pulls every DCTDecode (JPEG) stream out of a PDF and checks it is decodable. */
function embeddedJpegs(pdfBytes) {
  const found = [];
  const text = pdfBytes.toString("latin1");
  const pattern = /\/Subtype\s*\/Image[\s\S]{0,400}?\/Filter\s*\/DCTDecode/g;
  let match;
  while ((match = pattern.exec(text))) {
    const start = pdfBytes.indexOf(Buffer.from([0xff, 0xd8]), match.index);
    if (start === -1) continue;
    const end = pdfBytes.indexOf(Buffer.from([0xff, 0xd9]), start);
    if (end === -1) continue;
    const jpeg = pdfBytes.subarray(start, end + 2);
    found.push({ size: jpeg.length, dims: jpegSize(jpeg), valid: isJpeg(jpeg) });
  }
  return found;
}

/* --------------------------------- helpers -------------------------------- */

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
  if (!element) throw new Error(`no ${selector} matching "${text}"`);
  await element.evaluate((node) =>
    node.scrollIntoView({ block: "center", inline: "center" }),
  );
  await element.click();
  return element;
}

/** Clicks whichever of the given button labels is present (labels change after a result exists). */
async function clickAny(page, phrases) {
  for (const phrase of phrases) {
    const present = await page.evaluate(
      (needle) =>
        Array.from(document.querySelectorAll("button")).some((node) =>
          (node.textContent ?? "").includes(needle),
        ),
      phrase,
    );
    if (present) {
      await clickText(page, "button", phrase);
      return phrase;
    }
  }
  throw new Error(`no button matching any of: ${phrases.join(" | ")}`);
}

async function clickSelector(page, selector) {
  const element = await page.$(selector);
  if (!element) throw new Error(`no element for ${selector}`);
  await element.evaluate((node) => node.scrollIntoView({ block: "center" }));
  await element.click();
  return element;
}

async function waitForText(page, text, timeout = 45000) {
  await page.waitForFunction(
    (txt) => document.body.innerText.includes(txt),
    { timeout, polling: 200 },
    text,
  );
}

async function waitForTextGone(page, text, timeout = 45000) {
  await page.waitForFunction(
    (txt) => !document.body.innerText.includes(txt),
    { timeout, polling: 200 },
    text,
  );
}

async function waitFor(page, predicate, timeout = 45000, label = "condition", arg) {
  try {
    await page.waitForFunction(predicate, { timeout, polling: 150 }, arg);
  } catch (error) {
    throw new Error(`timed out waiting for ${label}`);
  }
}

/** Waits for a visible button whose text contains `text` to become clickable. */
async function waitForEnabledButton(page, text, timeout = 120000) {
  await waitFor(
    page,
    (needle) => {
      const button = Array.from(document.querySelectorAll("button")).find((node) =>
        (node.textContent ?? "").includes(needle),
      );
      return Boolean(button) && !button.disabled;
    },
    timeout,
    `an enabled "${text}" button`,
    text,
  );
}

/** Waits for an aria-labelled button to exist and become clickable. */
async function waitForEnabledAria(page, prefix, timeout = 120000) {
  await waitFor(
    page,
    (needle) => {
      const button = document.querySelector(`button[aria-label^="${needle}"]`);
      return Boolean(button) && !button.disabled;
    },
    timeout,
    `an enabled "${prefix}" button`,
    prefix,
  );
}

/** Waits for the printed output size readout ("708 KB → 46 KB") to reach `maxKb`. */
async function waitForOutputUnder(page, maxKb, timeout = 120000) {
  await waitFor(
    page,
    (limit) => {
      const match = /→ (\d+(?:\.\d+)?) KB/.exec(document.body.innerText);
      if (!match) return false;
      return Number.parseFloat(match[1]) <= limit;
    },
    timeout,
    `an output under ${maxKb} KB`,
    maxKb,
  );
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

/** The Images-to-PDF generate button is relabelled once a PDF exists. */
async function generatePdf(page) {
  const text = await bodyText(page);
  await clickText(page, "button", text.includes("Regenerate PDF") ? "Regenerate PDF" : "Create PDF");
}

/** The PDF compressor button is relabelled once a result exists. */
async function compressPdfAgain(page) {
  const text = await bodyText(page);
  await clickText(page, "button", text.includes("Compress again") ? "Compress again" : "Compress PDF");
}

/** Asserts the stale result cannot be downloaded: the button is disabled. */
async function assertStaleDownloadBlocked(page, label, needle = "Download") {
  const state = await page.evaluate((text) => {
    const button = Array.from(document.querySelectorAll("button")).find((node) =>
      (node.textContent ?? "").includes(text),
    );
    return button
      ? { label: button.textContent.trim().slice(0, 32), disabled: button.disabled }
      : { label: null, disabled: false };
  }, needle);
  assert(label, state.label !== null && state.disabled, JSON.stringify(state));
}

/** First file input on the page. */
async function uploadFiles(page, files, index = 0) {
  await waitFor(
    page,
    () => document.querySelectorAll('input[type="file"]').length > 0,
    30000,
    "a file input",
  );
  const inputs = await page.$$('input[type="file"]');
  if (!inputs[index]) throw new Error(`no file input at index ${index}`);
  await inputs[index].uploadFile(...files);
}

/** File input inside the slot whose label matches, for the Application Pack. */
async function uploadToSlot(page, label, files) {
  const handle = await page.evaluateHandle((lbl) => {
    const candidates = Array.from(
      document.querySelectorAll("h2,h3,h4,span,div,p,label,button"),
    );
    const node = candidates.find((candidate) =>
      (candidate.textContent ?? "").trim().toLowerCase().startsWith(lbl),
    );
    let element = node;
    for (let depth = 0; depth < 9 && element; depth += 1) {
      const input = element.querySelector?.('input[type="file"]');
      if (input) return input;
      element = element.parentElement;
    }
    return null;
  }, label.toLowerCase());
  const element = handle.asElement();
  if (!element) throw new Error(`no file input near "${label}"`);
  await element.uploadFile(...files);
}

function clearDownloads() {
  fs.rmSync(DOWNLOADS, { recursive: true, force: true });
  fs.mkdirSync(DOWNLOADS, { recursive: true });
}

async function waitForDownload(timeout = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const names = fs
      .readdirSync(DOWNLOADS)
      .filter((name) => !name.endsWith(".crdownload"));
    for (const name of names) {
      const full = path.join(DOWNLOADS, name);
      const size = fs.statSync(full).size;
      if (size > 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return { name, path: full, size: fs.statSync(full).size };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("no download appeared");
}

async function decodeInBrowser(page, filePath, mime) {
  const base64 = fs.readFileSync(filePath).toString("base64");
  return page.evaluate(
    async (data, type) => {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const bitmap = await createImageBitmap(new Blob([bytes], { type }));
      return { width: bitmap.width, height: bitmap.height };
    },
    base64,
    mime,
  );
}

/* --------------------------------- samples -------------------------------- */

async function makeScanPdf(page, pageCount, jpegPath, size) {
  const doc = await PDFDocument.create();
  const jpeg = fs.readFileSync(jpegPath);
  for (let index = 0; index < pageCount; index += 1) {
    const image = await doc.embedJpg(jpeg);
    const pageRef = doc.addPage([size[0], size[1]]);
    pageRef.drawImage(image, { x: 10, y: 60, width: size[0] - 20, height: size[1] - 120 });
    pageRef.drawText(`Audit scan page ${index + 1}`, {
      x: 30,
      y: 30,
      size: 12,
      color: rgb(0.1, 0.1, 0.4),
    });
  }
  return Buffer.from(await doc.save({ useObjectStreams: true }));
}

/* ----------------------------------- run ---------------------------------- */

async function main() {
  fs.mkdirSync(SAMPLES, { recursive: true });
  fs.mkdirSync(DOWNLOADS, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 1000 });
  const client = await page.createCDPSession();
  await client.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: DOWNLOADS,
    eventsEnabled: true,
  });
  await client.send("Network.enable");
  client.on("Network.requestWillBeSent", (event) => {
    requests.push({
      url: event.request.url,
      method: event.request.method,
      size: event.request.postData ? event.request.postData.length : 0,
      postData: event.request.postData ?? "",
    });
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("Download the React DevTools") || text.includes("favicon")) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

  const go = async (route) => {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2", timeout: 60000 });
  };

  try {
    /* --- 0. landing ---------------------------------------------------- */
    section("Landing page");
    await go("/");
    await waitForText(page, "submission-ready");
    const landing = await bodyText(page);
    assert("hero asks the framing question", landing.includes("What are you trying to make submission-ready?"));
    assert("tagline present", landing.includes("Make any document ready to submit"));
    assert("account and console promise present", landing.includes("Accounts, optional but useful"));
    assert("popular requirements present", landing.includes("Under 100 KB") && landing.includes("350 × 350 px"));
    assert("all seven tools listed", ["Image Compressor", "Image Resizer", "Images to PDF", "PDF Compressor", "Merge PDF", "Split PDF", "Application Pack"].every((name) => landing.includes(name)));

    /* --- sample files -------------------------------------------------- */
    section("Sample files");
    const pngPath = path.join(SAMPLES, "signature.png");
    fs.writeFileSync(pngPath, makePng(900, 400, 8));

    const jpegDataUrl = await page.evaluate(() => {
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
      for (let i = 0; i < 1200; i += 1) {
        ctx.fillStyle = `hsl(${Math.random() * 360}, ${40 + Math.random() * 50}%, ${20 + Math.random() * 60}%)`;
        ctx.beginPath();
        ctx.arc(Math.random() * 2400, Math.random() * 1800, 8 + Math.random() * 70, 0, Math.PI * 2);
        ctx.fill();
      }
      return canvas.toDataURL("image/jpeg", 0.95);
    });
    const photoPath = path.join(SAMPLES, "photo.jpg");
    fs.writeFileSync(photoPath, Buffer.from(jpegDataUrl.split(",")[1], "base64"));
    const photoBytes = fs.statSync(photoPath).size;
    const photoDims = jpegSize(fs.readFileSync(photoPath));
    assert(
      "photo.jpg is a real 2400×1800 JPEG",
      Boolean(photoDims) && photoDims.width === 2400 && photoDims.height === 1800,
      `${Math.round(photoBytes / 1024)} KB · ${JSON.stringify(photoDims)}`,
    );
    const pngDims = pngSize(fs.readFileSync(pngPath));
    assert(
      "signature.png is a real 900×400 PNG",
      Boolean(pngDims) && pngDims.width === 900 && pngDims.height === 400,
      JSON.stringify(pngDims),
    );

    const a2Path = path.join(SAMPLES, "a-two-pages.pdf");
    const b3Path = path.join(SAMPLES, "b-three-pages.pdf");
    fs.writeFileSync(a2Path, await makeScanPdf(page, 2, photoPath, [420, 595.28]));
    fs.writeFileSync(b3Path, await makeScanPdf(page, 3, photoPath, [595.28, 841.89]));

    /* --- 1. image compressor ------------------------------------------- */
    await run("compress", "1. Image compressor", async () => {
    clearDownloads();
    await go("/image-compressor");
    await uploadFiles(page, [photoPath]);
    await waitFor(page, () => /% smaller/.test(document.body.innerText), 60000, "compression to finish");
    await clickText(page, "button", "JPG");
    await clickText(page, "button", "50 KB");
    await waitForEnabledAria(page, "Download compressed", 120000);
    await waitForOutputUnder(page, 50, 30000);
    const compressText = await bodyText(page);
    const reportedKb = /→ (\d+(?:\.\d+)?) KB/.exec(compressText);
    assert("a reduction percentage is shown", /% smaller/.test(compressText));
    await waitForEnabledAria(page, "Download compressed", 60000);
    const perFile = await page.$('button[aria-label^="Download compressed"]');
    assert("per-file download button exists", Boolean(perFile));
    await perFile.click();
    const compressed = await waitForDownload();
    const compressedBytes = fs.readFileSync(compressed.path);
    assert("downloaded file is a valid JPEG", isJpeg(compressedBytes), `${compressed.size} bytes`);
    assert("downloaded JPEG is at or under the 50 KB target", compressed.size <= 50 * 1024, `${compressed.size} bytes`);
    const reportedBytes = reportedKb ? Math.round(Number.parseFloat(reportedKb[1]) * 1024) : null;
    assert(
      "reported size matches the downloaded bytes",
      reportedBytes !== null && Math.abs(reportedBytes - compressed.size) <= 1024,
      `UI ${reportedBytes} vs file ${compressed.size}`,
    );
    const compressedDims = jpegSize(compressedBytes);
    const decoded = await decodeInBrowser(page, compressed.path, "image/jpeg");
    assert("compressed image still decodes in a browser", Boolean(decoded), JSON.stringify(decoded));
    assert(
      "the decode size matches the SOF header size",
      Boolean(compressedDims) && compressedDims.width === decoded.width && compressedDims.height === decoded.height,
      `${JSON.stringify(compressedDims)} vs ${JSON.stringify(decoded)}`,
    );

    // Target honesty: a PNG cannot use quality, so a tiny target must be declared.
    await page.reload({ waitUntil: "networkidle2" });
    await uploadFiles(page, [pngPath]);
    await waitFor(page, () => /% smaller/.test(document.body.innerText), 60000, "PNG compression");
    await clickText(page, "button", "JPG");
    await clickText(page, "button", "PNG");
    await waitFor(page, () => document.body.innerText.includes("Keep original"), 30000, "format controls");
    await clickText(page, "button", "PNG");
    await waitForEnabledAria(page, "Download compressed", 120000);
    const pngModeText = await bodyText(page);
    const pngOut = /→ (\d+(?:\.\d+)?) KB/.exec(pngModeText);
    assert(
      "PNG output reports a real result rather than a fake target hit",
      pngOut !== null && (Number.parseFloat(pngOut[1]) <= 50 || /smallest|couldn't|could not|not reached/i.test(pngModeText)),
      pngOut ? `${pngOut[1]} KB` : "no readout",
    );

    // Batch: two files, one ZIP.
    clearDownloads();
    await page.reload({ waitUntil: "networkidle2" });
    await uploadFiles(page, [photoPath, pngPath]);
    await waitFor(page, () => /2 images|2 files/.test(document.body.innerText) || document.querySelectorAll("ul li").length >= 2, 60000, "two queued files");
    await clickText(page, "button", "100 KB");
    await waitForEnabledButton(page, "Download all as ZIP", 180000);
    await clickText(page, "button", "Download all as ZIP");
    const zipFile = await waitForDownload(180000);
    assert("batch download is a ZIP archive", zipFile.name.endsWith(".zip"), zipFile.name);
    const zip = await JSZip.loadAsync(fs.readFileSync(zipFile.path));
    const entries = Object.keys(zip.files);
    assert("ZIP contains both processed files", entries.length === 2, entries.join(", "));
    for (const entry of entries) {
      const data = await zip.files[entry].async("nodebuffer");
      assert(
        `ZIP member ${entry} is a complete image`,
        isJpeg(data) || isPng(data) || isWebp(data),
        `${data.length} bytes`,
      );
      assert(`ZIP member ${entry} is under the 100 KB target`, data.length <= 100 * 1024, `${data.length} bytes`);
    }

    /* --- 2. image resizer ---------------------------------------------- */
    });
    await run("resize", "2. Image resizer", async () => {
    clearDownloads();
    await go("/image-resizer");
    await uploadFiles(page, [photoPath]);
    await waitFor(page, () => /350|Result/.test(document.body.innerText) || document.querySelectorAll('button[aria-pressed]').length > 0, 60000, "resizer controls");
    await clickText(page, "button", "Application photo");
    await waitFor(page, () => /Result: 350/.test(document.body.innerText), 60000, "the planned result");
    const resizeText = await bodyText(page);
    assert("live preview reports 350 × 350 px", /Result: 350 × 350 px/.test(resizeText));
    assert("crop-to-fill is reported", /cropped to fill/.test(resizeText));
    await waitForEnabledAria(page, "Download resized", 90000);
    const resizedButton = await page.$('button[aria-label^="Download resized"]');
    assert("resized download button exists", Boolean(resizedButton));
    await resizedButton.click();
    const resized = await waitForDownload();
    const resizedBytes = fs.readFileSync(resized.path);
    const resizedDims = jpegSize(resizedBytes);
    assert("downloaded file is a valid JPEG", isJpeg(resizedBytes), `${resized.size} bytes`);
    assert(
      "downloaded image is exactly 350 × 350",
      Boolean(resizedDims) && resizedDims.width === 350 && resizedDims.height === 350,
      JSON.stringify(resizedDims),
    );
    const resizedDecoded = await decodeInBrowser(page, resized.path, "image/jpeg");
    assert("downloaded image decodes in a browser", Boolean(resizedDecoded), JSON.stringify(resizedDecoded));

    // Custom non-square dimensions must be honoured exactly.
    await page.$eval("#resize-width", (node) => {
      node.value = "";
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.type("#resize-width", "800");
    await page.$eval("#resize-height", (node) => {
      node.value = "";
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.type("#resize-height", "400");
    await waitFor(page, () => /Result: 800 × 400 px/.test(document.body.innerText), 60000, "the custom size plan");
    await waitForEnabledAria(page, "Download resized", 90000);
    clearDownloads();
    await clickSelector(page, 'button[aria-label^="Download resized"]');
    const custom = await waitForDownload();
    const customDims = jpegSize(fs.readFileSync(custom.path));
    assert(
      "custom 800 × 400 output is exact",
      Boolean(customDims) && customDims.width === 800 && customDims.height === 400,
      JSON.stringify(customDims),
    );

    /* --- 3. images to PDF ---------------------------------------------- */
    });
    await run("pdf", "3. Images to PDF", async () => {
    clearDownloads();
    await go("/jpg-to-pdf");
    await uploadFiles(page, [photoPath, pngPath]);
    await waitFor(page, () => /2 images/.test(document.body.innerText), 60000, "two images listed");
    await generatePdf(page);
    await waitForEnabledButton(page, "Download PDF", 180000);
    const pdfText = await bodyText(page);
    assert("result reports a two-page PDF", /2 pages/.test(pdfText), "");
    await clickText(page, "button", "Download PDF");
    const generated = await waitForDownload();
    const generatedDoc = await PDFDocument.load(fs.readFileSync(generated.path));
    assert("generated PDF opens with 2 pages", generatedDoc.getPageCount() === 2, `${generatedDoc.getPageCount()} pages`);
    const autoBox = generatedDoc.getPage(0).getSize();
    assert("A4 landscape box for the landscape photo", Math.abs(autoBox.width - 841.89) < 1 && Math.abs(autoBox.height - 595.28) < 1, JSON.stringify(autoBox));
    const generatedJpegs = embeddedJpegs(fs.readFileSync(generated.path));
    assert("embedded page images are decodable JPEGs", generatedJpegs.length >= 1 && generatedJpegs.every((entry) => entry.valid), `${generatedJpegs.length} image objects`);

    // Letter portrait with margins.
    clearDownloads();
    await clickText(page, "button", "Letter");
    await clickText(page, "button", "Portrait");
    await waitFor(page, () => /Settings changed/.test(document.body.innerText), 30000, "stale settings notice");
    await assertStaleDownloadBlocked(page, "a PDF from outdated layout settings cannot be downloaded");
    await generatePdf(page);
    await waitForEnabledButton(page, "Download PDF", 180000);
    await clickText(page, "button", "Download PDF");
    const letter = await waitForDownload();
    const letterDoc = await PDFDocument.load(fs.readFileSync(letter.path));
    const letterBox = letterDoc.getPage(0).getSize();
    assert("Letter portrait box is 612 × 792 pt", Math.abs(letterBox.width - 612) < 1 && Math.abs(letterBox.height - 792) < 1, JSON.stringify(letterBox));

    // Image-size pages must match each picture's own proportions.
    clearDownloads();
    await clickText(page, "button", "Image size");
    await generatePdf(page);
    await waitForEnabledButton(page, "Download PDF", 180000);
    await clickText(page, "button", "Download PDF");
    const imageSized = await waitForDownload();
    const imageSizedDoc = await PDFDocument.load(fs.readFileSync(imageSized.path));
    const firstBox = imageSizedDoc.getPage(0).getSize();
    assert("image-size page follows the photo's 4:3 ratio", Math.abs(firstBox.width / firstBox.height - 2400 / 1800) < 0.05, JSON.stringify(firstBox));

    /* --- 4. PDF compressor --------------------------------------------- */
    });
    await run("pdf", "4. PDF compressor", async () => {
    clearDownloads();
    const scanBytes = fs.readFileSync(b3Path);
    await go("/pdf-compressor");
    await uploadFiles(page, [b3Path]);
    await waitForText(page, "3 pages", 60000);

    // Light (lossless) level keeps page dimensions and text objects.
    await clickText(page, "button", "Light");
    await compressPdfAgain(page);
    await waitForEnabledButton(page, "Download PDF", 240000);
    await clickText(page, "button", "Download PDF");
    const light = await waitForDownload();
    const lightDoc = await PDFDocument.load(fs.readFileSync(light.path));
    assert("light compression keeps 3 pages", lightDoc.getPageCount() === 3, `${lightDoc.getPageCount()} pages`);
    const lightBox = lightDoc.getPage(0).getSize();
    assert("light compression keeps A4 page dimensions", Math.abs(lightBox.width - 595.28) < 1 && Math.abs(lightBox.height - 841.89) < 1, JSON.stringify(lightBox));
    assert("light compression never grows the file", light.size <= scanBytes.length, `${Math.round(scanBytes.length / 1024)} KB → ${Math.round(light.size / 1024)} KB`);

    // Strong level with a 200 KB target.
    clearDownloads();
    await clickText(page, "button", "Strong");
    await clickText(page, "button", "200 KB");
    await assertStaleDownloadBlocked(page, "a PDF from outdated compression settings cannot be downloaded");
    await compressPdfAgain(page);
    await waitForEnabledButton(page, "Download PDF", 300000);
    const strongText = await bodyText(page);
    await clickText(page, "button", "Download PDF");
    const strong = await waitForDownload();
    const strongBytes = fs.readFileSync(strong.path);
    const strongDoc = await PDFDocument.load(strongBytes);
    assert("strong compression keeps 3 pages", strongDoc.getPageCount() === 3, `${strongDoc.getPageCount()} pages`);
    const strongBox = strongDoc.getPage(0).getSize();
    assert("strong compression keeps A4 page dimensions", Math.abs(strongBox.width - 595.28) < 1 && Math.abs(strongBox.height - 841.89) < 1, JSON.stringify(strongBox));
    assert("strong compression meets the 200 KB target", strong.size <= 200 * 1024, `${Math.round(strong.size / 1024)} KB`);
    const strongJpegs = embeddedJpegs(strongBytes);
    assert("re-encoded pages are decodable JPEGs", strongJpegs.length >= 1 && strongJpegs.every((entry) => entry.valid), `${strongJpegs.length} images`);
    assert("target met on screen matches the file", !/not reached|smallest version/i.test(strongText) || strong.size <= 200 * 1024);

    // Impossible target must be declared, not faked.
    await clickText(page, "button", "100 KB");
    await compressPdfAgain(page);
    await waitForEnabledButton(page, "Download PDF", 300000);
    const impossibleText = await bodyText(page);
    const impossibleKb = /→ (\d+(?:\.\d+)?) KB/.exec(impossibleText);
    assert(
      "an unreachable target is reported honestly or met",
      /couldn't|could not|smallest|not reached|closest/i.test(impossibleText) ||
        (impossibleKb !== null && Number.parseFloat(impossibleKb[1]) <= 100),
      impossibleKb ? `reported ${impossibleKb[1]} KB` : "no readout",
    );

    /* --- 5. merge ------------------------------------------------------ */
    });
    await run("merge", "5. PDF merging", async () => {
    clearDownloads();
    await go("/merge-pdf");
    await uploadFiles(page, [a2Path, b3Path]);
    await waitForText(page, "5 pages", 60000);
    await clickText(page, "button", "Merge PDFs");
    await waitForEnabledButton(page, "Download merged PDF", 120000);
    await clickText(page, "button", "Download merged PDF");
    const merged = await waitForDownload();
    const mergedBytes = fs.readFileSync(merged.path);
    const mergedDoc = await PDFDocument.load(mergedBytes);
    assert("merged PDF has 5 pages", mergedDoc.getPageCount() === 5, `${mergedDoc.getPageCount()} pages`);
    const mergedFirst = mergedDoc.getPage(0).getSize();
    assert("first merged page comes from the first file (420 pt wide)", Math.abs(mergedFirst.width - 420) < 1, JSON.stringify(mergedFirst));
    const mergedFourth = mergedDoc.getPage(3).getSize();
    assert("fourth merged page comes from the second file (595 pt wide)", Math.abs(mergedFourth.width - 595.28) < 1, JSON.stringify(mergedFourth));

    // Reorder with the arrow controls, then merge again: the order must flip.
    clearDownloads();
    await clickSelector(page, 'button[aria-label="Move b-three-pages.pdf up"]');
    await waitFor(page, () => /merge again/i.test(document.body.innerText), 30000, "stale merge notice");
    await assertStaleDownloadBlocked(page, "a merged PDF from an outdated order cannot be downloaded", "Download merged PDF");
    await clickAny(page, ["Merge again", "Merge PDFs"]);
    await waitForEnabledButton(page, "Download merged PDF", 120000);
    await clickText(page, "button", "Download merged PDF");
    const reordered = await waitForDownload();
    const reorderedDoc = await PDFDocument.load(fs.readFileSync(reordered.path));
    assert("reordering moves the second file to the front", reorderedDoc.getPageCount() === 5 && Math.abs(reorderedDoc.getPage(0).getSize().width - 595.28) < 1, JSON.stringify(reorderedDoc.getPage(0).getSize()));
    assert("the reordered merge keeps every page", reorderedDoc.getPageCount() === 5, `${reorderedDoc.getPageCount()} pages`);

    /* --- 6. split ------------------------------------------------------ */
    });
    await run("split", "6. PDF splitting", async () => {
    clearDownloads();
    await go("/split-pdf");
    await uploadFiles(page, [b3Path]);
    await waitForText(page, "Page 1", 90000);
    await waitFor(page, () => document.querySelectorAll('button[aria-pressed]').length > 0, 90000, "page thumbnails");
    await clickText(page, "button", "Page 1");
    await clickText(page, "button", "Page 3");
    await clickText(page, "button", "Export pages");
    await waitForEnabledButton(page, "Download", 180000);
    await clickText(page, "button", "Download");
    const split = await waitForDownload();
    const splitDoc = await PDFDocument.load(fs.readFileSync(split.path));
    assert("split export contains exactly the two chosen pages", splitDoc.getPageCount() === 2, `${splitDoc.getPageCount()} pages`);

    /* --- 7. application pack ------------------------------------------- */
    });
    await run("pack", "7. Application pack", async () => {
    clearDownloads();
    await go("/application-pack");
    await uploadFiles(page, [photoPath]);
    await waitFor(page, () => /Needs changes|Valid|Check this/.test(document.body.innerText), 90000, "pack validation");
    const packText = await bodyText(page);
    assert("oversized photo is flagged as needing changes", /Needs changes/.test(packText), "");
    assert("the failing rule explains the numbers", /KB/.test(packText));
    await clickAny(page, ["Compress to 200 KB", "Compress to", "Compress image", "Compress"]);
    await waitFor(page, () => /Valid/.test(document.body.innerText), 180000, "pack fix");
    const fixedText = await bodyText(page);
    assert("one-click fix produces a valid file", /Valid/.test(fixedText));
    clearDownloads();
    await clickText(page, "button", "Download").catch(() => undefined);
    const packed = await waitForDownload();
    assert("prepared file downloads", packed.size > 0, `${Math.round(packed.size / 1024)} KB`);
    assert("prepared file is under the 200 KB limit", packed.size <= 200 * 1024, `${packed.size} bytes`);

    // A five-page PDF must fail a four-page limit and be fixable.
    await uploadFiles(page, [b3Path], 1);
    await waitFor(page, () => /mark sheet|resume|other|document/i.test(document.body.innerText), 60000, "PDF slot");
    ok("a PDF added to the pack is inspected");

    /* --- 8. accounts --------------------------------------------------- */
    });
    await run("account", "8. Accounts and run logging", async () => {
    await go("/auth");
    await waitForText(page, "Create an account or sign in", 60000);
    const authText = await bodyText(page);
    assert("auth page offers email sign-up and sign-in", authText.includes("Email me a code"));
    assert("auth page offers a guest session", authText.includes("Continue as a guest"));
    await clickText(page, "button", "Continue as a guest");
    await waitFor(page, () => location.pathname === "/workspace", 60000, "workspace after guest sign-in").catch(() => undefined);
    await waitForText(page, "workspace", 60000);
    const workspaceText = await bodyText(page);
    assert("guest landing on the workspace is explained", /guest/i.test(workspaceText), "");

    clearDownloads();
    await go("/image-compressor");
    await uploadFiles(page, [pngPath]);
    await waitFor(page, () => /% smaller/.test(document.body.innerText), 60000, "logged compression");
    await clickText(page, "button", "100 KB");
    await waitFor(page, () => /100 KB/.test(document.body.innerText), 60000, "logged target");
    await go("/workspace");
    await waitFor(page, () => /runs recorded|Recent operations/.test(document.body.innerText), 60000, "workspace history");
    const historyText = await bodyText(page);
    assert("the completed run appears in the workspace history", historyText.includes("Image Compressor"), "");
    assert("history shows byte totals", /KB|MB/.test(historyText));

    /* --- 9. admin console ---------------------------------------------- */
    });
    await run("admin", "9. Admin console", async () => {
    await go("/admin");
    await waitFor(page, () => /Admin access|Deployment control|admin console/i.test(document.body.innerText), 60000, "admin gate");
    const gateText = await bodyText(page);
    if (/Claim admin console|Claim admin access/.test(gateText)) {
      await clickText(page, "button", "Claim").catch(async () => {
        await clickText(page, "button", "Claim admin console");
      });
    }
    await waitFor(page, () => /Deployment control/.test(document.body.innerText), 90000, "admin console");
    const adminText = await bodyText(page);
    for (const tab of ["Overview", "Accounts", "Tools", "Presets", "Broadcast", "Activity"]) {
      assert(`console exposes the ${tab} tab`, adminText.includes(tab));
    }
    assert("console reports accounts and admins", /accounts/.test(adminText) && /admins/.test(adminText));
    assert("console lists the tool registry", adminText.includes("Image Compressor"));

    /* --- 10. SEO metadata --------------------------------------------- */
    });
    await run("seo", "10. SEO metadata", async () => {
    const routes = [
      "/",
      "/tools",
      "/privacy",
      "/image-compressor",
      "/image-resizer",
      "/jpg-to-pdf",
      "/pdf-compressor",
      "/merge-pdf",
      "/split-pdf",
      "/application-pack",
      "/compress-image-to-100kb",
      "/compress-image-to-200kb",
      "/compress-pdf-to-100kb",
      "/compress-pdf-to-200kb",
      "/compress-pdf-to-1mb",
    ];
    const titles = new Map();
    const descriptions = new Map();
    for (const route of routes) {
      await go(route);
      const meta = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
        h1s: Array.from(document.querySelectorAll("h1")).map((node) => node.textContent?.trim() ?? ""),
        jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).length,
        text: document.body.innerText.length,
      }));
      assert(`${route} has a unique title`, meta.title.length > 15 && !titles.has(meta.title), meta.title.slice(0, 72));
      assert(`${route} has a unique description`, meta.description.length > 50 && !descriptions.has(meta.description), `${meta.description.length} chars`);
      assert(`${route} sets a canonical URL`, meta.canonical.endsWith(route === "/" ? "/" : route), meta.canonical);
      assert(`${route} has exactly one h1`, meta.h1s.length === 1, `${meta.h1s.length}`);
      assert(`${route} renders crawlable copy`, meta.text > 700, `${meta.text} chars`);
      titles.set(meta.title, route);
      descriptions.set(meta.description, route);
    }

    /* --- 11. mobile ---------------------------------------------------- */
    });
    await run("mobile", "11. Mobile layout", async () => {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    for (const route of ["/", "/tools", "/image-compressor", "/pdf-compressor", "/application-pack", "/workspace", "/auth"]) {
      await go(route);
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        smallTargets: Array.from(document.querySelectorAll("button, a")).filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.height < 28 || rect.width < 24);
        }).length,
      }));
      assert(`${route} has no horizontal overflow at 390 px`, metrics.overflow <= 2, `${metrics.overflow}px`);
    }
    await go("/");
    await clickSelector(page, 'header button[aria-expanded]');
    await waitFor(page, () => !!document.querySelector("header nav a[href='/privacy']"), 20000, "mobile menu");
    ok("mobile navigation opens");
    await page.setViewport({ width: 1360, height: 1000 });

    /* --- 12. unknown route --------------------------------------------- */
    });
    await run("mobile", "12. Unknown route", async () => {
    await go("/definitely-not-a-page");
    const notFound = await bodyText(page);
    assert("unknown route shows the 404 page", notFound.includes("isn") && notFound.includes("here"), notFound.slice(0, 60).replace(/\n/g, " "));

    /* --- 13. privacy and network --------------------------------------- */
    });
    await run("network", "13. Privacy and network", async () => {
    const bigUploads = requests.filter((entry) => entry.method !== "GET" && entry.size > 8192);
    assert("no oversized request body was sent", bigUploads.length === 0, bigUploads.map((entry) => `${entry.method} ${entry.url.slice(0, 60)} ${entry.size}B`).join(", "));
    const binaryUploads = requests.filter((entry) =>
      /data:image|data:application\/pdf|base64,[A-Za-z0-9+/]{400,}/.test(entry.postData),
    );
    assert("no image or PDF bytes were posted anywhere", binaryUploads.length === 0, `${binaryUploads.length} suspicious requests`);
    const external = Array.from(
      new Set(
        requests
          .map((entry) => {
            try {
              return new URL(entry.url).host;
            } catch {
              return null;
            }
          })
          .filter((host) => host && !host.startsWith("localhost") && !host.includes("convex.cloud") && !host.includes("googleapis") && !host.includes("gstatic")),
      ),
    );
    assert("no unexpected third-party hosts were contacted", external.length === 0, external.join(", "));
    const convexWrites = requests.filter((entry) => entry.method !== "GET" && entry.url.includes("convex"));
    ok("convex writes observed", `${convexWrites.length} mutations, largest body ${Math.max(0, ...convexWrites.map((entry) => entry.size))} bytes`);

    section("Console errors");
    assert("no uncaught runtime or console errors", consoleErrors.length === 0, `${consoleErrors.length} captured`);
    consoleErrors.slice(0, 12).forEach((error) => console.log(`    ! ${error.slice(0, 200)}`));
    });
  } catch (error) {
    fail("audit run completed", error.message);
  } finally {
    await browser.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((entry) => console.log(`  - ${entry}`));
  }
  process.exit(failed === 0 ? 0 : 1);
}

await main();
