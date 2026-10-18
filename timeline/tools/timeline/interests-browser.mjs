import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { cleanupTopicFixtures } from "./fixtures.mjs";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app"), { getFirestore } = require("firebase-admin/firestore"), { getAuth } = require("firebase-admin/auth");
const { InterestService } = require("./lib/interests.js");
Object.assign(process.env, { GCLOUD_PROJECT: "demo-timeline", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" });
initializeApp({ projectId: "demo-timeline" });
const db = getFirestore(), interests = new InterestService(db), runId = Date.now().toString(36);
const topics = ["a", "b"].map(n => `browser-${runId}${n}`), email = `interest-browser-${runId}@example.test`, password = "Local-only-12345";
const origin = process.env.TIMELINE_TEST_ORIGIN || "http://127.0.0.1:5174";
if (origin !== "http://127.0.0.1:5174") throw Error("Interest browser fixtures require local Vite and demo emulators");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await context.newPage();
await page.clock.install();
await page.addInitScript(() => {
  window.__interestHidden = false;
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => window.__interestHidden ? "hidden" : "visible" });
});
const errors = [], results = [], activityCalls = [];
page.on("pageerror", e => errors.push(e.message));
page.on("request", r => { if (r.method() === "POST" && r.url().endsWith("/timelineTopicActivity")) activityCalls.push(JSON.parse(r.postData()).data); });
const followButton = () => page.getByRole("button", { name: "สนใจหัวข้อนี้", exact: true });
const addButton = () => page.getByRole("button", { name: "＋ เพิ่มเรื่องราว", exact: true });
let uid, observer;
const member = id => db.doc(`topics/${id}/interests/${uid}`);
const visit = async id => {
  const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/timelineTopicActivity") && r.status() === 200);
  await page.goto(`${origin}/timeline/${id}`); await response;
};
async function poll(read, matches) {
  for (let i = 0; i < 80; i++) { const value = await read(); if (matches(value)) return value; await new Promise(r => setTimeout(r, 100)); }
  throw Error("Timed out waiting for membership state");
}
async function check(name, work) {
  try { await work(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: "FAIL", error: e.stack }); throw e; }
}
async function visible(value) {
  await page.evaluate(v => { window.__interestHidden = !v; document.dispatchEvent(new Event("visibilitychange")); }, value);
}
try {
  await fs.mkdir("evidence/timeline", { recursive: true });
  for (const id of topics) {
    await db.doc(`topics/${id}`).set({ id, slug: id, categoryId: "test", displayNames: { "th-TH": "Interest test" }, descriptionTh: "SYNTHETIC — Emulator only", calendar: { id: "browser-symbolic" }, publishedCount: 0, interestCount: 0 });
    await db.doc(`topicStats/${id}`).set({ interestCount: 0, graphVersion: 0 });
  }
  const signup = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const account = await signup.json(); uid = account.localId; assert.ok(uid);
  await page.goto(`${origin}/timeline/${topics[0]}`);
  await page.locator(".tl-header").getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await page.locator('input[name="username"]').fill(email); await page.locator('input[name="password"]').fill(password);
  await page.getByRole("dialog").locator('button[type="submit"]').click();
  await page.locator(".tl-header").getByRole("button", { name: "ออกจากระบบ", exact: true }).waitFor();
  await check("visiting a non-followed topic never auto-enrolls; explicit confirmation creates a seven-day lease", async () => {
    await followButton().waitFor(); assert.equal(activityCalls.length, 0);
    await followButton().click(); await addButton().waitFor();
    const data = (await member(topics[0]).get()).data(); assert.equal(data.expiresAt - data.lastActiveAt, 604800000);
    await page.goto(`${origin}/timeline/${topics[1]}`); await followButton().waitFor(); await followButton().click(); await addButton().waitFor();
  });
  await check("returning to one topic renews it without renewing the other selected topic", async () => {
    const other = (await member(topics[1]).get()).data();
    const old = Date.now() - 3600000; await member(topics[0]).update({ lastActiveAt: old, expiresAt: old + 604800000 });
    await visit(topics[0]); await addButton().waitFor();
    await poll(() => member(topics[0]).get(), d => d.get("lastActiveAt") > old);
    assert.equal((await member(topics[1]).get()).get("expiresAt"), other.expiresAt);
  });
  await check("background topic tabs send no renewal on timer or focus; returning to visibility resumes renewal", async () => {
    await visible(false);
    const old = Date.now() - 3600000; await member(topics[0]).update({ lastActiveAt: old, expiresAt: old + 604800000 });
    const before = activityCalls.length;
    await page.clock.fastForward(5 * 60000);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await new Promise(r => setTimeout(r, 300));
    assert.equal(activityCalls.length, before);
    assert.equal((await member(topics[0]).get()).get("lastActiveAt"), old);
    await visible(true);
    await poll(() => member(topics[0]).get(), d => d.get("lastActiveAt") > old);
    assert.equal(activityCalls.length, before + 1);
  });
  await check("expiry unmounts member controls; returning after expiry requires explicit interest confirmation", async () => {
    await visible(false);
    await member(topics[0]).update({ expiresAt: Date.now() - 1 });
    await followButton().waitFor(); assert.equal(await addButton().count(), 0);
    // A full foreground revisit checks the server deadline, removes the old
    // membership, and must leave the confirmation button visible.
    await visit(topics[0]); await followButton().waitFor();
    await poll(() => member(topics[0]).get(), d => !d.exists);
    assert.equal((await db.doc(`topics/${topics[0]}`).get()).get("interestCount"), 0);
    assert.equal((await db.doc(`topicStats/${topics[0]}`).get()).get("interestCount"), 0);
    await page.screenshot({ path: "evidence/timeline/interest-expired.png" });
    await followButton().click(); await addButton().waitFor();
    assert.equal((await db.doc(`topics/${topics[0]}`).get()).get("interestCount"), 1);
  });
  await check("sweeping a different inactive topic updates its public card live without changing Timeline content time", async () => {
    const catalog = JSON.parse(await fs.readFile("src/features/timeline/gameCatalog.json", "utf8")); catalog[0].id = topics[1];
    observer = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await observer.route("**/src/features/timeline/gameCatalog.json*", route => route.fulfill({ contentType: "application/javascript", body: `export default ${JSON.stringify(catalog)};` }));
    await observer.goto(`${origin}/timeline`);
    const card = observer.locator(`.tl-topic-card[href="/timeline/${topics[1]}"]`);
    await card.waitFor(); assert.equal(await card.locator(".tl-topic-interest-count dd").innerText(), "1 คน");
    await member(topics[1]).update({ expiresAt: Date.now() - 1 });
    await interests.expireMember(topics[1], uid);
    await observer.waitForFunction(id => document.querySelector(`.tl-topic-card[href="/timeline/${id}"] .tl-topic-interest-count dd`)?.textContent === "0 คน", topics[1]);
    assert.equal(await card.locator(".tl-topic-timeline-updated").count(), 0);
    assert.equal((await member(topics[0]).get()).exists, true);
    assert.deepEqual(errors, []);
  });
} catch (e) {
  console.error(e.stack);
  await page.screenshot({ path: "evidence/timeline/interests-browser-fail.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await observer?.close(); await context.close(); await browser.close();
  await cleanupTopicFixtures(db, topics);
  if (uid) {
    await db.recursiveDelete(db.doc(`users/${uid}`)); await db.doc(`writeLimits/${uid}`).delete();
    const audits = await db.collection("auditLog").where("actorUid", "==", uid).get(); for (const audit of audits.docs) await audit.ref.delete();
    await getAuth().deleteUser(uid);
  }
  await fs.writeFile("evidence/timeline/interests-browser.json", JSON.stringify({ at: new Date().toISOString(), results, errors, activityCalls }, null, 2));
  await db.terminate();
}
console.log(`${results.filter(r => r.status === "PASS").length}/${results.length} interest browser scenarios PASS`);
