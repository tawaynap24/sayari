import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app"), { getFirestore } = require("firebase-admin/firestore");
Object.assign(process.env, { GCLOUD_PROJECT: "demo-timeline", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" });
initializeApp({ projectId: "demo-timeline" });
const db = getFirestore();
const before = (await db.doc("siteStats/online").get()).data() || { total: 0, signedIn: 0 };
const browser = await chromium.launch({ channel: "msedge", headless: true });
const contexts = [], results = [], errors = [];
const origin = process.env.TIMELINE_TEST_ORIGIN || "http://127.0.0.1:5174";
await fs.mkdir("evidence/timeline", { recursive: true });
async function run(name, callback) {
  try { await callback(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: "FAIL", error: e.stack }); throw e; }
}
async function page(context) {
  const p = await context.newPage(); p.on("pageerror", e => errors.push(e.message));
  await p.goto(`${origin}/timeline`); return p;
}
async function counts(p, total, signedIn) {
  await p.waitForFunction(({ total, signedIn }) => {
    const value = selector => Number.parseInt(document.querySelector(selector)?.textContent || "", 10);
    return document.querySelector('[data-presence-status="live"]') && value("[data-online-total]") === total && value("[data-online-members]") === signedIn;
  }, { total: before.total + total, signedIn: before.signedIn + signedIn }, { timeout: 35000 });
}
async function login(p, email, password) {
  await p.locator(".tl-header").getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  const form = p.getByRole("dialog").locator("form");
  await form.locator('input[type="email"]').fill(email);
  await form.locator('input[type="password"]').fill(password);
  await form.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
}
async function leave(p) {
  if (!p.isClosed()) { await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide"))); }
}
try {
  const c1 = await browser.newContext(), c2 = await browser.newContext(); contexts.push(c1, c2);
  const p1 = await page(c1);
  await run("guest appears in left header with zero signed-in delta", async () => {
    await counts(p1, 1, 0);
    const positions = await p1.locator(".tl-header").evaluate(el => ({ stats: el.querySelector(".tl-presence").getBoundingClientRect().x, nav: el.querySelector("nav").getBoundingClientRect().x }));
    assert.ok(positions.stats < positions.nav);
  });
  const p2 = await page(c1);
  await run("second tab shares one browser visitor", async () => { await counts(p2, 1, 0); await counts(p1, 1, 0); });
  const p3 = await page(c2);
  await run("separate browser visitor updates all open tabs", async () => { await counts(p3, 2, 0); await counts(p1, 2, 0); });
  const email = `online-browser-${randomUUID()}@example.test`, password = "Test-local-12345";
  const account = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  assert.equal(account.status, 200);
  await run("login changes member count without increasing total", async () => { await login(p1, email, password); await counts(p1, 2, 1); await counts(p2, 2, 1); });
  await run("same account in another browser is counted once", async () => { await login(p3, email, password); await counts(p1, 1, 1); await counts(p3, 1, 1); });
  await run("last tab in one browser can close while another browser keeps account online", async () => {
    await leave(p1); await leave(p2); await p1.close(); await p2.close(); await counts(p3, 1, 1);
  });
  await run("logout changes member to guest without changing total", async () => {
    await p3.locator(".tl-header").getByRole("button", { name: "ออกจากระบบ", exact: true }).click(); await counts(p3, 1, 0);
  });
  await run("offline state hides stale numbers and reconnect does not double count", async () => {
    await c2.setOffline(true);
    await p3.locator('[data-presence-status="connecting"]').waitFor();
    await c2.setOffline(false); await counts(p3, 1, 0);
  });
  await run("desktop and mobile header fit without the old brand or footer", async () => {
    for (const width of [1440, 390]) {
      await p3.setViewportSize({ width, height: 900 });
      assert.equal(await p3.locator(".tl-brand, .tl-footer").count(), 0);
      assert.equal(await p3.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await p3.locator(".tl-header").screenshot({ path: `evidence/timeline/presence-header-${width}.png` });
    }
    assert.deepEqual(errors, []);
  });
  await leave(p3);
  await run("closing the final visitor removes its contribution", async () => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const current = (await db.doc("siteStats/online").get()).data();
      if (current.total === before.total && current.signedIn === before.signedIn) return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.fail("Final visitor was not removed");
  });
} finally {
  for (const c of contexts) for (const p of c.pages()) await leave(p).catch(() => {});
  await browser.close(); await db.terminate();
  await fs.writeFile("evidence/timeline/presence-browser.json", JSON.stringify({ at: new Date().toISOString(), baseline: before, results, errors }, null, 2));
}
console.log(`${results.length} presence browser scenarios PASS`);
