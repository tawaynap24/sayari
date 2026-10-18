import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "playwright";
await fs.mkdir("evidence/calculator", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const values = [];
  page.on("console", (msg) => {
    if (msg.type() === "log" && /^\d+(\.\d+)?$/.test(msg.text()))
      values.push(Number(msg.text()));
  });
  await page.goto("http://127.0.0.1:5173/game/zenless-zone-zero");
  await page.getByText("Name: Piper", { exact: true }).waitFor();
  const before = await page.locator(".default-card").evaluateAll((els) =>
    els.map((el) => ({
      text: el.textContent,
      inputs: [...el.querySelectorAll("input")].map((i) => i.value),
    })),
  );
  const card = page
    .locator(".default-card")
    .filter({ has: page.getByText("Name: Piper", { exact: true }) })
    .first();
  await card.locator("input").nth(0).fill("20");
  await card.locator("input").nth(1).fill("1000");
  const after = {
    text: await card.textContent(),
    inputs: await card
      .locator("input")
      .evaluateAll((els) => els.map((i) => i.value)),
  };
  const data = {
    before,
    after,
    values: [...new Set(values)].sort((a, b) => a - b),
  };
  const file = "tests/fixtures/calculator-baseline.json";
  if (process.argv.includes("--baseline"))
    await fs.writeFile(file, JSON.stringify(data, null, 2));
  else
    assert.deepEqual(
      data,
      JSON.parse(await fs.readFile(file, "utf8")),
      "Calculator behavior drift",
    );
  await page.screenshot({
    path: `evidence/calculator/calculator-${process.argv.includes("--baseline") ? "before" : "after"}.png`,
    fullPage: true,
  });
  const result = {
    at: new Date().toISOString(),
    calculator: "PASS",
    baseline: process.argv.includes("--baseline"),
  };
  await fs.writeFile(
    "evidence/calculator/preservation.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
