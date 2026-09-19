import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer";

const BASE = "http://localhost:5173";
const ROOT = path.join(os.tmpdir(), "submitready-audit");
const photoPath = path.join(ROOT, "samples", "photo.jpg");

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1360, height: 1000 });
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE ERROR:", m.text().slice(0, 200));
});
page.on("pageerror", (e) => console.log("PAGE ERROR:", String(e).slice(0, 300)));

await page.goto(`${BASE}/image-compressor`, { waitUntil: "networkidle2" });
const inputs = await page.$$('input[type="file"]');
await inputs[0].uploadFile(photoPath);

const click = async (text) => {
  const handle = await page.evaluateHandle((t) => {
    const nodes = Array.from(document.querySelectorAll("button"));
    return nodes.find((n) => (n.textContent ?? "").includes(t)) ?? null;
  }, text);
  const el = handle.asElement();
  if (!el) {
    console.log(`!! no button matching "${text}"`);
    return false;
  }
  await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
  await el.click();
  console.log(`clicked "${text}"`);
  return true;
};

await new Promise((r) => setTimeout(r, 6000));
console.log("--- after default run:", JSON.stringify(await page.evaluate(() => document.body.innerText.match(/→ [\d.]+ \w+/g))));
await click("JPG");
await new Promise((r) => setTimeout(r, 3000));
await click("50 KB");

for (let i = 0; i < 12; i += 1) {
  await new Promise((r) => setTimeout(r, 2500));
  const state = await page.evaluate(() => {
    const text = document.body.innerText;
    const named = Array.from(document.querySelectorAll("button[aria-label]")).map(
      (b) => `${b.getAttribute("aria-label")}${b.disabled ? " [disabled]" : " [ready]"}`,
    );
    return {
      readouts: text.match(/→ [\d.]+ \w+/g),
      targets: text.match(/Within [\d.]+ \w+/g),
      named,
      progress: Array.from(document.querySelectorAll('[role="progressbar"],progress')).length,
      toast: Array.from(document.querySelectorAll("[data-sonner-toast]")).map((n) => n.innerText.replace(/\n/g, " | ")),
    };
  });
  console.log(i, JSON.stringify(state));
}
console.log("--- buttons:", JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll("button")).map((b) => `${b.textContent?.trim().slice(0, 24)}${b.disabled ? "(disabled)" : ""}`))));
await browser.close();
