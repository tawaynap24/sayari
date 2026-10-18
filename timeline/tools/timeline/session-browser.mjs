import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app"), { getFirestore } = require("firebase-admin/firestore");
Object.assign(process.env, { GCLOUD_PROJECT: "demo-timeline", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" });
initializeApp({ projectId: "demo-timeline" });
const db = getFirestore(), runId = randomUUID();
const profile = path.resolve(`.timeline/session-browser-${runId}`);
const allowed = path.resolve(".timeline") + path.sep;
assert.ok(profile.startsWith(allowed));
const origin = process.env.TIMELINE_TEST_ORIGIN || "http://127.0.0.1:5174";
const options = { channel: "msedge", headless: true, viewport: { width: 1280, height: 900 } };
const results = [], errors = [];
let context;
async function open() {
  context = await chromium.launchPersistentContext(profile, options);
  const p = context.pages()[0] || await context.newPage();
  p.on("pageerror", e => errors.push(e.message));
  await p.goto(`${origin}/timeline`); return p;
}
const loggedIn = p => p.locator(".tl-header").getByRole("button", { name: "ออกจากระบบ", exact: true });
const loggedOut = p => p.locator(".tl-header").getByRole("button", { name: "เข้าสู่ระบบ", exact: true });
async function currentLease(p) {
  return p.evaluate(() => JSON.parse(localStorage.getItem("timeline.session") || "null"));
}
async function run(name, fn) {
  try { await fn(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: "FAIL", error: e.stack }); throw e; }
}
try {
  const email = `session-browser-${runId}@example.test`, password = "Local-test-12345";
  const created = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  assert.equal(created.status, 200);
  let page = await open();
  await run("login uses persistent Firebase storage and obtains a three-day server lease", async () => {
    await loggedOut(page).click();
    const form = page.getByRole("dialog").locator("form");
    await form.locator('input[type="email"]').fill(email);
    await form.locator('input[type="password"]').fill(password);
    await form.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    await loggedIn(page).waitFor({ timeout: 25000 });
    const lease = await currentLease(page);
    assert.ok(lease && Math.abs(lease.expiresAt - Date.now() - 259200000) < 10000);
  });
  await run("reload restores login and renews the expiry without asking for credentials", async () => {
    const before = await currentLease(page);
    await page.reload(); await loggedIn(page).waitFor({ timeout: 25000 });
    const after = await currentLease(page);
    assert.equal(after.uid, before.uid);
    assert.equal(after.authTime, before.authTime);
    assert.ok(after.expiresAt >= before.expiresAt);
  });
  await run("closing and reopening the browser profile restores the same login", async () => {
    const before = await currentLease(page);
    await context.close(); context = undefined;
    page = await open(); await loggedIn(page).waitFor({ timeout: 25000 });
    const after = await currentLease(page);
    assert.equal(after.uid, before.uid);
    assert.equal(after.authTime, before.authTime);
    assert.ok(after.expiresAt >= before.expiresAt);
  });
  await run("new tab restores login and a return to the tab advances the shared expiry", async () => {
    const second = await context.newPage();
    await second.goto(`${origin}/timeline`); await loggedIn(second).waitFor({ timeout: 25000 });
    const before = await currentLease(page);
    await new Promise(resolve => setTimeout(resolve, 50));
    await second.evaluate(() => window.dispatchEvent(new Event("focus")));
    await second.waitForFunction(old => JSON.parse(localStorage.getItem("timeline.session") || "null")?.expiresAt > old, before.expiresAt);
    await second.close();
  });
  await run("Firebase token refresh alone does not extend the idle session", async () => {
    const before = await currentLease(page);
    await page.evaluate(async () => {
      const moduleUrl = performance.getEntriesByType("resource").map(e => e.name).find(url => new URL(url).pathname.endsWith("/features/timeline/client.ts"));
      if (!moduleUrl) throw Error("Vite client module not found");
      const { auth } = await import(moduleUrl);
      await auth.currentUser.getIdToken(true);
    });
    const after = await currentLease(page);
    assert.equal(after.expiresAt, before.expiresAt);
  });
  await run("expired server lease logs out and cannot be revived by reloading", async () => {
    const lease = await currentLease(page);
    await db.doc(`users/${lease.uid}/authSessions/${lease.authTime}`).update({ expiresAt: Date.now() - 1 });
    await loggedOut(page).waitFor({ timeout: 20000 });
    assert.equal(await currentLease(page), null);
    await page.reload(); await loggedOut(page).waitFor();
  });
  await run("fresh credential login opens a new session and logout clears all tabs", async () => {
    // auth_time is measured in whole seconds: ensure the new login is distinct.
    await new Promise(resolve => setTimeout(resolve, 1100));
    await loggedOut(page).click();
    const form = page.getByRole("dialog").locator("form");
    await form.locator('input[type="email"]').fill(email);
    await form.locator('input[type="password"]').fill(password);
    await form.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    await loggedIn(page).waitFor({ timeout: 25000 });
    const second = await context.newPage(); await second.goto(`${origin}/timeline`); await loggedIn(second).waitFor({ timeout: 25000 });
    await loggedIn(page).click();
    await loggedOut(page).waitFor(); await loggedOut(second).waitFor();
    await page.reload(); await loggedOut(page).waitFor();
    assert.equal(await currentLease(page), null); assert.deepEqual(errors, []);
  });
} finally {
  await context?.close(); await db.terminate();
  await fs.mkdir("evidence/timeline", { recursive: true });
  await fs.writeFile("evidence/timeline/session-browser.json", JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 2));
}
console.log(`${results.length} session browser scenarios PASS`);
