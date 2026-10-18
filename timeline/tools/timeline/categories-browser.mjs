import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const origin = process.env.TIMELINE_TEST_ORIGIN || "http://127.0.0.1:5174";
const errors = [], results = [];
page.on("pageerror", e => errors.push(e.message));
async function check(name, work) {
  try { await work(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: "FAIL", error: e.stack }); console.error(`FAIL ${name}: ${e.message}`); }
}
async function cards(expected) {
  await page.waitForFunction(n => document.querySelectorAll(".tl-topic-card").length === n, expected.length);
  assert.deepEqual((await page.locator(".tl-topic-card h2").allTextContents()).sort(), expected.sort());
  assert.equal(await page.getByText(/SYNTHETIC|หัวข้อทดสอบ/).count(), 0);
  for (const label of await page.locator(".tl-topic-card .tl-eyebrow").allTextContents())
    assert.ok(label.trim(), "Every topic has a category label");
}
try {
  await page.goto(`${origin}/timeline`);
  await page.locator(".tl-categories").waitFor();
  await check("all categories display exactly three original topics without synthetic fixtures", async () => {
    assert.deepEqual(await page.locator(".tl-categories button").allTextContents(), ["ทุกหมวด", "เกม", "เรื่องราวทั่วไป"]);
    await cards(["เรื่องราวของชุมชน", "Genshin Impact", "Zenless Zone Zero"]);
    const grid = await page.locator(".tl-topics").boundingBox();
    const last = await page.locator(".tl-topic-card").last().boundingBox();
    assert.ok(Math.abs(grid.width - last.width) < 1, "Odd final topic fills its row without an empty grey cell");
  });
  await check("game and general filters show only their matching topics", async () => {
    await page.getByRole("button", { name: "เกม", exact: true }).click();
    await cards(["Genshin Impact", "Zenless Zone Zero"]);
    assert.equal(await page.getByRole("button", { name: "เกม", exact: true }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "เรื่องราวทั่วไป", exact: true }).click();
    await cards(["เรื่องราวของชุมชน"]);
    assert.ok(Math.abs((await page.locator(".tl-topics").boundingBox()).width - (await page.locator(".tl-topic-card").boundingBox()).width) < 1);
    await page.getByRole("button", { name: "ทุกหมวด", exact: true }).click();
    await cards(["เรื่องราวของชุมชน", "Genshin Impact", "Zenless Zone Zero"]);
    await page.screenshot({ path: "evidence/timeline/categories-1440.png", fullPage: true });
  });
  await check("each topic links to its own route and mobile filters fit the screen", async () => {
    const links = await page.locator(".tl-topic-card").evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
    assert.deepEqual(links.sort(), ["/timeline/community", "/timeline/genshin-impact", "/timeline/zenless-zone-zero"]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "เกม", exact: true }).click();
    await cards(["Genshin Impact", "Zenless Zone Zero"]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: "evidence/timeline/categories-390.png", fullPage: true });
    assert.deepEqual(errors, []);
  });
} finally {
  await browser.close();
  await fs.mkdir("evidence/timeline", { recursive: true });
  await fs.writeFile("evidence/timeline/categories-browser.json", JSON.stringify({ at: new Date().toISOString(), origin, results, errors }, null, 2));
}
if (results.some(r => r.status !== "PASS")) process.exitCode = 1;
